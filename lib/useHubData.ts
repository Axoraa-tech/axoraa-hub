"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StorageService } from "./storage";
import { GoogleSheetsService } from "./googleSheetsService";
import type {
  ClientMasterRecord,
  DailyWorkLogEntry,
  DeveloperRosterMember,
  FounderMatrixStats,
  MarketingDeal,
  MarketingInteraction,
  PaymentBillingRecord,
  ProjectProgressRecord,
  RepositoryMapping,
} from "./types";

export type DataSource = "sheet" | "local";

const now = () => new Date().toISOString().replace("T", " ").substring(0, 19);

/**
 * Single source of truth for the hub screens.
 * - Work logs come from the Google Sheet (through /api/sheets) when the server has it configured,
 *   otherwise from this browser's local storage.
 * - `isAdmin` controls who may overwrite the sheet; members only append their own rows.
 */
export function useHubData({ isAdmin }: { isAdmin: boolean }) {
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<DataSource>("local");
  const sourceRef = useRef<DataSource>("local");
  const [syncState, setSyncState] = useState<{ busy: boolean; message?: string; error?: boolean }>({ busy: false });

  const [workLogs, setWorkLogs] = useState<DailyWorkLogEntry[]>([]);
  const [roster, setRoster] = useState<DeveloperRosterMember[]>([]);
  const [repositories, setRepositories] = useState<RepositoryMapping[]>([]);
  const [deals, setDeals] = useState<MarketingDeal[]>([]);
  const [interactions, setInteractions] = useState<MarketingInteraction[]>([]);
  const [clients, setClients] = useState<ClientMasterRecord[]>([]);
  const [projects, setProjects] = useState<ProjectProgressRecord[]>([]);
  const [payments, setPayments] = useState<PaymentBillingRecord[]>([]);
  const [founderMatrix, setFounderMatrix] = useState<FounderMatrixStats[]>([]);

  const loadLocal = useCallback(() => {
    setRoster(StorageService.getRoster());
    setRepositories(StorageService.getRepositories());
    setDeals(StorageService.getMarketingDeals());
    setInteractions(StorageService.getInteractions());
    setClients(StorageService.getClientMaster());
    setProjects(StorageService.getProjectProgress());
    setPayments(StorageService.getPayments());
    setFounderMatrix(StorageService.getFounderMatrix());
  }, []);

  const pullFromSheet = useCallback(async () => {
    setSyncState({ busy: true, message: "Loading from Google Sheet…" });
    const res = await GoogleSheetsService.fetchFromGoogleSheet();
    if (res.success && res.data) {
      setWorkLogs(res.data);
      setSyncState({ busy: false, message: `Synced ${res.data.length} rows · ${new Date().toLocaleTimeString()}` });
    } else {
      setSyncState({ busy: false, message: res.message, error: true });
    }
    return res;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      loadLocal();
      const { configured } = await GoogleSheetsService.status();
      if (cancelled) return;
      if (configured) {
        sourceRef.current = "sheet";
        setSource("sheet");
        await pullFromSheet();
      } else {
        setWorkLogs(StorageService.getWorkLogs());
      }
      if (!cancelled) setReady(true);
    })();

    const onLocalChange = () => {
      loadLocal();
      if (sourceRef.current === "local") setWorkLogs(StorageService.getWorkLogs());
    };
    const events = [
      "axoraa_data_changed",
      "axoraa_deals_changed",
      "axoraa_interactions_changed",
      "axoraa_clients_changed",
      "axoraa_projects_changed",
      "axoraa_payments_changed",
    ];
    events.forEach((e) => window.addEventListener(e, onLocalChange));
    return () => {
      cancelled = true;
      events.forEach((e) => window.removeEventListener(e, onLocalChange));
    };
  }, [loadLocal, pullFromSheet]);

  const pushAll = useCallback(async (rows: DailyWorkLogEntry[]) => {
    setSyncState({ busy: true, message: "Writing to Google Sheet…" });
    const res = await GoogleSheetsService.syncAllToGoogleSheet(rows);
    setSyncState({ busy: false, message: res.message, error: !res.success });
    return res;
  }, []);

  // ---- Work log mutations
  const saveWorkLog = useCallback(
    async (data: Partial<DailyWorkLogEntry>, editingId?: string) => {
      if (source === "local") {
        if (editingId) StorageService.updateWorkLog(editingId, data);
        else StorageService.addWorkLog(data as Omit<DailyWorkLogEntry, "id" | "lastUpdated">);
        setWorkLogs(StorageService.getWorkLogs());
        return;
      }
      if (editingId) {
        if (!isAdmin) return;
        const next = workLogs.map((l) => (l.id === editingId ? { ...l, ...data, lastUpdated: now() } : l));
        setWorkLogs(next);
        await pushAll(next);
        return;
      }
      const entry = { ...(data as DailyWorkLogEntry), id: "log-" + Date.now(), lastUpdated: now() };
      setWorkLogs((prev) => [entry, ...prev]);
      setSyncState({ busy: true, message: "Saving to Google Sheet…" });
      const res = await GoogleSheetsService.appendLogToGoogleSheet(entry);
      setSyncState({ busy: false, message: res.success ? "Saved to Google Sheet" : res.message, error: !res.success });
    },
    [source, isAdmin, workLogs, pushAll]
  );

  const deleteWorkLog = useCallback(
    async (id: string) => {
      if (source === "local") {
        StorageService.deleteWorkLog(id);
        setWorkLogs(StorageService.getWorkLogs());
        return;
      }
      if (!isAdmin) return;
      const next = workLogs.filter((l) => l.id !== id);
      setWorkLogs(next);
      await pushAll(next);
    },
    [source, isAdmin, workLogs, pushAll]
  );

  const updateWorkLogStatus = useCallback(
    (id: string, patch: Partial<DailyWorkLogEntry>) => saveWorkLog(patch, id),
    [saveWorkLog]
  );

  // ---- Marketing mutations (browser storage)
  const saveDeal = useCallback((data: Partial<MarketingDeal>, editingId?: string) => {
    if (editingId) StorageService.updateMarketingDeal(editingId, data);
    else StorageService.addMarketingDeal(data as Omit<MarketingDeal, "id">);
    setDeals(StorageService.getMarketingDeals());
  }, []);

  const saveInteraction = useCallback((data: Partial<MarketingInteraction>) => {
    StorageService.addInteraction(data as Omit<MarketingInteraction, "id">);
    setInteractions(StorageService.getInteractions());
  }, []);

  return {
    ready,
    source,
    syncState,
    pullFromSheet,
    pushAll: () => pushAll(workLogs),
    workLogs,
    roster,
    setRoster,
    repositories,
    deals,
    interactions,
    clients,
    projects,
    payments,
    founderMatrix,
    saveWorkLog,
    deleteWorkLog,
    updateWorkLogStatus,
    saveDeal,
    saveInteraction,
  };
}

export type HubData = ReturnType<typeof useHubData>;
