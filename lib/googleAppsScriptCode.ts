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
 * 8. Set Who has access: "Anyone" (allows Axoraa frontend to communicate without complex OAuth).
 * 9. Click Deploy, copy the "Web app URL" (ending in /exec), and paste it into Axoraa Settings!
 */

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * AXORAA Operations Engine - Google Apps Script Bridge
 * Connects Axoraa Frontend directly to your Google Sheets Workbook
 */

function doGet(e) {
  try {
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
    var action = payload.action;
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
`;
