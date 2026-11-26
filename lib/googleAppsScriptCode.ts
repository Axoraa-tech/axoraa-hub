/**
 * Production-ready Google Apps Script for AXORAA DEV TEAM Workbook.
 * 
 * Instructions for User:
 * 1. Open your Google Sheet ("AXORAA DEV TEAM Workbook").
 * 2. In Google Sheets top menu, click Extensions > Apps Script.
 * 3. Delete any default code in Code.gs, paste this entire script, and click Save (Ctrl+S / Cmd+S).
 * 4. Click Deploy > New deployment.
 * 5. Select type: "Web app".
 * 6. Set Description: "Axoraa Operations Bridge".
 * 7. Set Execute as: "Me" (your Google account).
 * 8. Set Who has access: "Anyone" — requests are still rejected unless they carry the shared token.
 * 9. Project Settings > Script Properties: add AXORAA_TOKEN = a long random string.
 * 10. Put the Web app URL (ending in /exec) in SHEETS_WEBAPP_URL and the same token in SHEETS_API_TOKEN
 *     in the Axoraa server's .env.local. The browser never sees either value.
 *
 * Version 2 adds shared records (deals, visits, clients, projects, invoices, roster, repositories,
 * content, campaigns, drafts, activity, settings) in their own tabs. To upgrade an existing
 * deployment, paste this script over the old one and use Deploy > Manage deployments > Edit >
 * Version: New version, so the /exec URL stays the same. Work logs keep the version 1 behaviour:
 * GET with no action returns the 'Daily Work Log' rows, and ADD_LOG / SYNC_ALL are unchanged.
 *
 * Wire protocol (every request carries the token):
 * - GET action=VERSION -> { success, version: 2 }
 * - GET action=LIST_ALL&tabs=Deals,Visits,... -> { success, tabs: { [tab]: { headers, rows } } }
 *   Activity returns its last 500 rows. Missing tabs are created as plain text with an 'id' header.
 *   Date cells come back as yyyy-MM-dd in Asia/Kolkata.
 * - GET action=LIST&tab=X -> { success, headers, rows }
 * - POST { action: 'UPSERT', tab, row, mode?, sequences?, activity? } -> { success, row, created, skipped }
 * - POST { action: 'BULK_UPSERT', tab, rows (at most 200), mode? } -> { success, upserted, skipped }
 * - POST { action: 'DELETE', tab, id, activity? } -> { success, deleted }
 * Writes take the script lock (20s). Errors -> { success: false, error }.
 */

export const SCRIPT_VERSION = 2;

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * AXORAA Operations Engine - Google Apps Script Bridge
 * Connects Axoraa Frontend directly to your Google Sheets Workbook
 */

function isAuthorized(token) {
  var expected = PropertiesService.getScriptProperties().getProperty("AXORAA_TOKEN");
  return !!expected && token === expected;
}

function doGet(e) {
  try {
    if (!isAuthorized(e && e.parameter ? e.parameter.token : "")) {
      return respondJSON({ success: false, error: "Unauthorized" });
    }
    if (e.parameter.action) {
      var v2Response = handleV2Get(e);
      if (v2Response) return v2Response;
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Daily Work Log") || ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return respondJSON({ success: true, rows: [] });
    }
    
    var headers = data[0];
    var rows = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[1]) continue; // Skip empty rows
      
      rows.push({
        id: "sheet-row-" + (i + 1),
        date: formatDate(row[0]),
        developerName: String(row[1] || ""),
        project: String(row[2] || ""),
        repository: String(row[3] || ""),
        module: String(row[4] || ""),
        workType: String(row[5] || ""),
        taskDescription: String(row[6] || ""),
        githubPr: String(row[7] || ""),
        workStatus: String(row[8] || "In Progress"),
        priority: String(row[9] || "Medium"),
        hours: Number(row[10] || 0),
        isBlocked: String(row[11] || "No"),
        blockerDetails: String(row[12] || ""),
        reviewRequired: String(row[13] || "No"),
        reviewer: String(row[14] || "-"),
        deployment: String(row[15] || "Development"),
        productionImpact: String(row[16] || "None"),
        notes: String(row[17] || ""),
        lastUpdated: String(row[18] || new Date().toISOString())
      });
    }
    
    return respondJSON({ success: true, count: rows.length, rows: rows });
  } catch (err) {
    return respondJSON({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (!isAuthorized(payload.token)) {
      return respondJSON({ success: false, error: "Unauthorized" });
    }
    var action = payload.action;
    if (V2_POST_ACTIONS.indexOf(action) !== -1) return handleV2Post(payload);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Daily Work Log") || ss.getSheets()[0];
    
    if (action === "ADD_LOG") {
      var item = payload.data;
      var newRow = [
        item.date,
        item.developerName,
        item.project,
        item.repository,
        item.module,
        item.workType,
        item.taskDescription,
        item.githubPr,
        item.workStatus,
        item.priority,
        item.hours,
        item.isBlocked,
        item.blockerDetails,
        item.reviewRequired,
        item.reviewer,
        item.deployment,
        item.productionImpact,
        item.notes,
        new Date().toISOString()
      ];
      sheet.appendRow(newRow);
      return respondJSON({ success: true, message: "Row added to Google Sheet successfully" });
    }
    
    if (action === "SYNC_ALL") {
      var items = payload.data; // Array of entries
      // Clear existing data rows except headers
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 19).clearContent();
      }
      
      var rowsToAppend = items.map(function(item) {
        return [
          item.date,
          item.developerName,
          item.project,
          item.repository,
          item.module,
          item.workType,
          item.taskDescription,
          item.githubPr,
          item.workStatus,
          item.priority,
          item.hours,
          item.isBlocked,
          item.blockerDetails,
          item.reviewRequired,
          item.reviewer,
          item.deployment,
          item.productionImpact,
          item.notes,
          item.lastUpdated || new Date().toISOString()
        ];
      });
      
      if (rowsToAppend.length > 0) {
        sheet.getRange(2, 1, rowsToAppend.length, 19).setValues(rowsToAppend);
      }
      return respondJSON({ success: true, count: rowsToAppend.length, message: "Google Sheet synchronized with " + rowsToAppend.length + " rows." });
    }
    
    return respondJSON({ success: false, error: "Unknown action" });
  } catch (err) {
    return respondJSON({ success: false, error: err.toString() });
  }
}

function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var yyyy = val.getFullYear();
    var mm = String(val.getMonth() + 1).padStart(2, '0');
    var dd = String(val.getDate()).padStart(2, '0');
    return yyyy + "-" + mm + "-" + dd;
  }
  return String(val);
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================================
// VERSION 2: shared records (deals, visits, clients, invoices and more)
// Work logs above keep the version 1 behaviour unchanged.
// =====================================================================

var SCRIPT_VERSION = 2;
var V2_TABS = ["Deals", "Visits", "Clients", "Projects", "Invoices", "Roster", "Repositories", "Content", "Campaigns", "Drafts", "Activity", "Settings"];
var V2_POST_ACTIONS = ["UPSERT", "BULK_UPSERT", "DELETE"];
var ACTIVITY_TAB = "Activity";
var ACTIVITY_HEADERS = ["id", "at", "actorId", "actorName", "action", "entity", "entityId", "summary"];
var ACTIVITY_LIMIT = 500;
var MAX_BULK_ROWS = 200;
var LOCK_WAIT_MS = 20000;

function handleV2Get(e) {
  var action = e.parameter.action;
  if (action === "VERSION") {
    return respondJSON({ success: true, version: SCRIPT_VERSION });
  }
  if (action === "LIST_ALL") {
    var names = String(e.parameter.tabs || "").split(",");
    var tabs = {};
    for (var i = 0; i < names.length; i++) {
      var name = names[i].trim();
      if (!name) continue;
      if (V2_TABS.indexOf(name) === -1) return respondJSON({ success: false, error: "Unknown tab: " + name });
      tabs[name] = readTab(getOrCreateTab(name), name === ACTIVITY_TAB ? ACTIVITY_LIMIT : 0);
    }
    return respondJSON({ success: true, tabs: tabs });
  }
  if (action === "LIST") {
    var tab = String(e.parameter.tab || "");
    if (V2_TABS.indexOf(tab) === -1) return respondJSON({ success: false, error: "Unknown tab: " + tab });
    var t = readTab(getOrCreateTab(tab), tab === ACTIVITY_TAB ? ACTIVITY_LIMIT : 0);
    return respondJSON({ success: true, headers: t.headers, rows: t.rows });
  }
  return null; // not a v2 action: fall through to the version 1 response
}

function handleV2Post(payload) {
  var action = payload.action;
  var tab = String(payload.tab || "");
  if (V2_TABS.indexOf(tab) === -1) return respondJSON({ success: false, error: "Unknown tab: " + tab });
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    var result;
    if (action === "UPSERT") result = v2Upsert(tab, payload);
    else if (action === "BULK_UPSERT") result = v2BulkUpsert(tab, payload);
    else if (action === "DELETE") result = v2Delete(tab, payload);
    else result = { success: false, error: "Unknown action" };
    SpreadsheetApp.flush();
    return respondJSON(result);
  } finally {
    lock.releaseLock();
  }
}

// ---- tabs and headers

function getOrCreateTab(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  try {
    sheet = ss.insertSheet(name);
  } catch (err) {
    sheet = ss.getSheetByName(name); // created by a concurrent request
    if (sheet) return sheet;
    throw err;
  }
  // New tabs are plain text so Sheets never turns IDs, phone numbers or dates into other values.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setNumberFormat("@");
  sheet.getRange(1, 1).setValue("id");
  sheet.setFrozenRows(1);
  return sheet;
}

function readHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
}

/** Adds the 'id' header to an empty tab and appends any missing headers. Returns the header row. */
function ensureHeaders(sheet, keys) {
  var headers = readHeaders(sheet);
  var nonEmpty = headers.filter(function (h) { return h !== ""; });
  if (nonEmpty.length === 0) {
    headers = ["id"];
    sheet.getRange(1, 1).setNumberFormat("@").setValue("id");
  }
  var missing = [];
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i] || "").trim();
    if (k && headers.indexOf(k) === -1 && missing.indexOf(k) === -1) missing.push(k);
  }
  if (missing.length > 0) {
    var start = headers.length + 1;
    var needed = start + missing.length - 1;
    if (needed > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
    sheet.getRange(1, start, 1, missing.length).setNumberFormat("@").setValues([missing]);
    headers = headers.concat(missing);
  }
  return headers;
}

function cellOut(val) {
  if (val instanceof Date) return Utilities.formatDate(val, "Asia/Kolkata", "yyyy-MM-dd");
  return val;
}

function rowObject(headers, values) {
  var obj = {};
  for (var c = 0; c < headers.length; c++) {
    if (!headers[c]) continue;
    obj[headers[c]] = cellOut(values[c]);
  }
  return obj;
}

/** Headers and row objects; limit > 0 returns only the last limit rows. */
function readTab(sheet, limit) {
  var headers = readHeaders(sheet);
  var lastRow = sheet.getLastRow();
  if (headers.length === 0 || lastRow < 2) return { headers: headers, rows: [] };
  var first = 2;
  if (limit > 0 && lastRow - 1 > limit) first = lastRow - limit + 1;
  var values = sheet.getRange(first, 1, lastRow - first + 1, headers.length).getValues();
  var rows = [];
  for (var r = 0; r < values.length; r++) {
    var empty = true;
    for (var c = 0; c < values[r].length; c++) {
      if (values[r][c] !== "" && values[r][c] !== null) { empty = false; break; }
    }
    if (!empty) rows.push(rowObject(headers, values[r]));
  }
  return { headers: headers, rows: rows };
}

/** Map of id to sheet row number. */
function idIndex(sheet, headers) {
  var map = {};
  var col = headers.indexOf("id");
  var lastRow = sheet.getLastRow();
  if (col === -1 || lastRow < 2) return map;
  var ids = sheet.getRange(2, col + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0] || "");
    if (id && !map.hasOwnProperty(id)) map[id] = i + 2;
  }
  return map;
}

function writeRowValues(sheet, rowNum, values) {
  sheet.getRange(rowNum, 1, 1, values.length).setNumberFormat("@").setValues([values]);
}

function valuesFor(headers, row, existing) {
  var out = [];
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c];
    if (h && row.hasOwnProperty(h) && row[h] !== null && row[h] !== undefined) out.push(row[h]);
    else out.push(existing ? existing[c] : "");
  }
  return out;
}

// ---- sequences (lead IDs, invoice and quotation numbers)

function isBlankOrAuto(v) {
  if (v === null || v === undefined) return true;
  var s = String(v).trim();
  return s === "" || s.toLowerCase() === "auto";
}

function padNumber(n, pad) {
  var s = String(n);
  while (s.length < pad) s = "0" + s;
  return s;
}

function fillSequences(sheet, headers, row, sequences) {
  if (!sequences || !sequences.length) return;
  var lastRow = sheet.getLastRow();
  for (var i = 0; i < sequences.length; i++) {
    var spec = sequences[i] || {};
    var field = String(spec.field || "");
    var prefix = String(spec.prefix || "");
    var pad = Math.max(0, Math.min(8, Number(spec.pad) || 0));
    var start = Math.max(0, Math.floor(Number(spec.start) || 1));
    if (!field || prefix.length > 24 || !isBlankOrAuto(row[field])) continue;
    var max = start - 1;
    var col = headers.indexOf(field);
    if (col !== -1 && lastRow >= 2) {
      var vals = sheet.getRange(2, col + 1, lastRow - 1, 1).getValues();
      for (var r = 0; r < vals.length; r++) {
        var v = String(vals[r][0] || "").trim();
        if (v.indexOf(prefix) !== 0) continue;
        var rest = v.substring(prefix.length);
        if (!/^\\d+$/.test(rest)) continue;
        var num = Number(rest);
        if (num > max) max = num;
      }
    }
    row[field] = prefix + (pad > 0 ? padNumber(max + 1, pad) : String(max + 1));
  }
}

// ---- activity

function appendActivity(activity) {
  if (!activity || typeof activity !== "object" || !activity.id) return;
  var sheet = getOrCreateTab(ACTIVITY_TAB);
  var headers = ensureHeaders(sheet, ACTIVITY_HEADERS);
  writeRowValues(sheet, sheet.getLastRow() + 1, valuesFor(headers, activity, null));
}

// ---- actions

function v2Upsert(tab, payload) {
  var row = payload.row;
  if (!row || typeof row !== "object" || !row.id) return { success: false, error: "Missing row id" };
  row.id = String(row.id);
  var sheet = getOrCreateTab(tab);
  var keys = Object.keys(row);
  var sequences = payload.sequences || [];
  for (var i = 0; i < sequences.length; i++) if (sequences[i] && sequences[i].field) keys.push(String(sequences[i].field));
  var headers = ensureHeaders(sheet, keys);
  var rowNum = idIndex(sheet, headers)[row.id];
  var existing = rowNum ? sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0] : null;
  if (rowNum && payload.mode === "insert_only") {
    return { success: true, row: rowObject(headers, existing), created: false, skipped: true };
  }
  if (existing) {
    // Sequence fields already numbered in the sheet are kept.
    for (var s = 0; s < sequences.length; s++) {
      var f = sequences[s] && sequences[s].field;
      var col = f ? headers.indexOf(String(f)) : -1;
      if (col !== -1 && isBlankOrAuto(row[f]) && !isBlankOrAuto(existing[col])) row[f] = existing[col];
    }
  }
  fillSequences(sheet, headers, row, sequences);
  var values = valuesFor(headers, row, existing);
  var target = rowNum || sheet.getLastRow() + 1;
  writeRowValues(sheet, target, values);
  if (payload.activity) appendActivity(payload.activity);
  return { success: true, row: rowObject(headers, values), created: !rowNum, skipped: false };
}

function v2BulkUpsert(tab, payload) {
  var rows = payload.rows;
  if (!rows || !rows.length) return { success: true, upserted: 0, skipped: 0 };
  if (rows.length > MAX_BULK_ROWS) return { success: false, error: "At most " + MAX_BULK_ROWS + " rows per call" };
  var sheet = getOrCreateTab(tab);
  var keys = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i] && typeof rows[i] === "object") keys = keys.concat(Object.keys(rows[i]));
  }
  var headers = ensureHeaders(sheet, keys);
  var index = idIndex(sheet, headers);
  var upserted = 0;
  var skipped = 0;
  var appends = [];
  var appendedIds = {};
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!row || typeof row !== "object" || !row.id) { skipped++; continue; }
    var id = String(row.id);
    row.id = id;
    var rowNum = index[id];
    if (rowNum || appendedIds[id]) {
      if (payload.mode === "insert_only" || appendedIds[id]) { skipped++; continue; }
      var existing = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
      writeRowValues(sheet, rowNum, valuesFor(headers, row, existing));
    } else {
      appends.push(valuesFor(headers, row, null));
      appendedIds[id] = true;
    }
    upserted++;
  }
  if (appends.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appends.length, headers.length).setNumberFormat("@").setValues(appends);
  }
  return { success: true, upserted: upserted, skipped: skipped };
}

function v2Delete(tab, payload) {
  var id = String(payload.id || "");
  if (!id) return { success: false, error: "Missing id" };
  var sheet = getOrCreateTab(tab);
  var headers = readHeaders(sheet);
  var rowNum = idIndex(sheet, headers)[id];
  if (!rowNum) return { success: true, deleted: false };
  sheet.deleteRow(rowNum);
  if (payload.activity) appendActivity(payload.activity);
  return { success: true, deleted: true };
}
`;
