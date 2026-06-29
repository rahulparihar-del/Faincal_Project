"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MMOrder,
  MMReturn,
  MMClaim,
  MMAdCampaign,
  MMPaymentCycle,
  MMSettings,
  MMInventoryItem,
  ImportRecord,
  MMNotification,
  BSSnapshot,
  DateFilter
} from "./types";
import { repository } from "@/lib/data/repository";

export function filterByDate<T extends { date?: string; cycleDate?: string; startDate?: string }>(
  items: T[],
  filter: DateFilter
): T[] {
  const fromTime = filter.from ? new Date(filter.from + "T00:00:00").getTime() : 0;
  const toTime = filter.to ? new Date(filter.to + "T23:59:59").getTime() : Infinity;

  return items.filter((item) => {
    const dateStr = item.date || item.cycleDate || item.startDate;
    if (!dateStr) return false;
    const itemTime = new Date(dateStr + "T12:00:00").getTime();
    return itemTime >= fromTime && itemTime <= toTime;
  });
}

export function useMMData() {
  const [orders, setOrdersState] = useState<MMOrder[]>([]);
  const [returns, setReturnsState] = useState<MMReturn[]>([]);
  const [claims, setClaimsState] = useState<MMClaim[]>([]);
  const [adCampaigns, setAdCampaignsState] = useState<MMAdCampaign[]>([]);
  const [paymentCycles, setPaymentCyclesState] = useState<MMPaymentCycle[]>([]);
  const [settings, setSettingsState] = useState<MMSettings>(repository.getSettings());
  const [inventory, setInventoryState] = useState<MMInventoryItem[]>([]);
  const [notifications, setNotificationsState] = useState<MMNotification[]>([]);
  const [imports, setImportsState] = useState<ImportRecord[]>([]);
  const [snapshots, setSnapshotsState] = useState<BSSnapshot[]>([]);
  const [syncStatus, setSyncStatusState] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadData() {
      await repository.init();
      setOrdersState(repository.getOrders());
      setReturnsState(repository.getReturns());
      setClaimsState(repository.getClaims());
      setAdCampaignsState(repository.getAdCampaigns());
      setPaymentCyclesState(repository.getPaymentCycles());
      setSettingsState(repository.getSettings());
      setInventoryState(repository.getInventory());
      setNotificationsState(repository.getNotifications());
      setImportsState(repository.getImportHistory());
      setSnapshotsState(repository.getSnapshots());
      setSyncStatusState(repository.getSyncStatus());
      setIsLoaded(true);
    }
    loadData();
  }, []);

  const setOrders = useCallback((data: MMOrder[] | ((prev: MMOrder[]) => MMOrder[])) => {
    setOrdersState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      repository.saveOrders(next);
      return next;
    });
    // Trigger snapshot update for today's date
    setTimeout(() => {
      const todayStr = new Date().toISOString().split("T")[0];
      repository.createDailySnapshot(todayStr).then(() => {
        setSnapshotsState(repository.getSnapshots());
      });
    }, 100);
  }, []);

  const setReturns = useCallback((data: MMReturn[] | ((prev: MMReturn[]) => MMReturn[])) => {
    setReturnsState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      repository.saveReturns(next);
      return next;
    });
  }, []);

  const setClaims = useCallback((data: MMClaim[] | ((prev: MMClaim[]) => MMClaim[])) => {
    setClaimsState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      repository.saveClaims(next);
      return next;
    });
  }, []);

  const setAdCampaigns = useCallback((data: MMAdCampaign[] | ((prev: MMAdCampaign[]) => MMAdCampaign[])) => {
    setAdCampaignsState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      repository.saveAdCampaigns(next);
      return next;
    });
  }, []);

  const setPaymentCycles = useCallback((data: MMPaymentCycle[] | ((prev: MMPaymentCycle[]) => MMPaymentCycle[])) => {
    setPaymentCyclesState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      repository.savePaymentCycles(next);
      return next;
    });
  }, []);

  const setSettings = useCallback((data: MMSettings | ((prev: MMSettings) => MMSettings)) => {
    setSettingsState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      repository.saveSettings(next);
      return next;
    });
  }, []);

  const saveInventory = useCallback((data: MMInventoryItem[]) => {
    repository.saveInventory(data).then(() => {
      setInventoryState(repository.getInventory());
      setNotificationsState(repository.getNotifications());
    });
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    const next = repository.getNotifications().map(n => ({ ...n, read: true }));
    await repository.saveNotifications(next);
    setNotificationsState(next);
  }, []);

  const addNotification = useCallback(async (type: MMNotification['type'], message: string) => {
    await repository.addNotification(type, message);
    setNotificationsState(repository.getNotifications());
  }, []);

  const importCSVData = useCallback(async (type: ImportRecord['type'], fileName: string, csvText: string) => {
    const { MeeshoCSVImporter } = await import("@/lib/data/importer");
    const importer = new MeeshoCSVImporter();

    let imported = 0;
    let failed = 0;
    let duplicate = 0;

    if (type === "orders") {
      const res = importer.parseOrders(csvText, repository.getOrders(), repository.getSettings().cogsMap);
      if (res.success.length > 0) {
        const next = [...res.success, ...repository.getOrders()];
        await repository.saveOrders(next);
        setOrdersState(next);
      }
      imported = res.success.length;
      failed = res.failedCount;
      duplicate = res.duplicateCount;
    } else if (type === "returns") {
      const res = importer.parseReturns(csvText, repository.getReturns(), repository.getOrders());
      if (res.success.length > 0) {
        const next = [...res.success, ...repository.getReturns()];
        await repository.saveReturns(next);
        setReturnsState(next);
      }
      imported = res.success.length;
      failed = res.failedCount;
      duplicate = res.duplicateCount;
    } else if (type === "payments") {
      const res = importer.parsePayments(csvText, repository.getPaymentCycles());
      if (res.success.length > 0) {
        const next = [...res.success, ...repository.getPaymentCycles()];
        await repository.savePaymentCycles(next);
        setPaymentCyclesState(next);
      }
      imported = res.success.length;
      failed = res.failedCount;
      duplicate = res.duplicateCount;
    } else if (type === "ads") {
      const res = importer.parseAds(csvText, repository.getAdCampaigns());
      if (res.success.length > 0) {
        const next = [...res.success, ...repository.getAdCampaigns()];
        await repository.saveAdCampaigns(next);
        setAdCampaignsState(next);
      }
      imported = res.success.length;
      failed = res.failedCount;
      duplicate = res.duplicateCount;
    } else if (type === "claims") {
      const res = importer.parseClaims(csvText, repository.getClaims());
      if (res.success.length > 0) {
        const next = [...res.success, ...repository.getClaims()];
        await repository.saveClaims(next);
        setClaimsState(next);
      }
      imported = res.success.length;
      failed = res.failedCount;
      duplicate = res.duplicateCount;
    } else if (type === "inventory") {
      const res = importer.parseInventory(csvText, repository.getInventory());
      if (res.success.length > 0) {
        const next = res.success;
        await repository.saveInventory(next);
        setInventoryState(next);
      }
      imported = res.success.length;
      failed = res.failedCount;
      duplicate = res.duplicateCount;
    }

    const newLog: ImportRecord = {
      id: "imp_" + Date.now(),
      fileName,
      type,
      importedRows: imported,
      failedRows: failed,
      duplicateRows: duplicate,
      importDate: new Date().toISOString()
    };

    const nextLogs = [newLog, ...repository.getImportHistory()];
    await repository.saveImportHistory(nextLogs);
    setImportsState(nextLogs);

    // Sync snapshot for current date
    const todayStr = new Date().toISOString().split("T")[0];
    await repository.createDailySnapshot(todayStr);

    setSnapshotsState(repository.getSnapshots());
    setSyncStatusState({ ...repository.getSyncStatus() });
    setInventoryState(repository.getInventory());
    setNotificationsState(repository.getNotifications());

    return newLog;
  }, []);

  return {
    orders,
    returns,
    claims,
    adCampaigns,
    paymentCycles,
    settings,
    inventory,
    notifications,
    imports,
    syncStatus,
    snapshots,
    setOrders,
    setReturns,
    setClaims,
    setAdCampaigns,
    setPaymentCycles,
    setSettings,
    saveInventory,
    markAllNotificationsAsRead,
    addNotification,
    importCSVData,
    isLoaded
  };
}
