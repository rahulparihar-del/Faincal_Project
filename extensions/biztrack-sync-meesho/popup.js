// BizTrack Sync — popup: settings, captured counts, sync to Supabase.

"use strict";

const $ = (id) => document.getElementById(id);

const TABLES = [
  // Returns — three stage-specific sub-tables matching the ReturnsTab sub-tabs
  { storageKey: "bt_returns_intransit", table: "meesho_returns_in_transit",  label: "in-transit returns"  },
  { storageKey: "bt_returns_ofd",       table: "meesho_returns_out_delivery", label: "OFD returns"          },
  { storageKey: "bt_returns_delivered", table: "meesho_returns_delivered",    label: "delivered returns"    },
  // Orders
  { storageKey: "bt_orders",   table: "meesho_orders",   label: "orders"   },
  // Payments & Ads (still captured, just not shown on the main UI tab)
  { storageKey: "bt_ads",      table: "meesho_ads",      label: "ads rows" },
  { storageKey: "bt_payments", table: "meesho_payments", label: "payments" },
];

const RETURN_KEYS = ["bt_returns_intransit", "bt_returns_ofd", "bt_returns_delivered"];
const ALL_STORAGE_KEYS = [...TABLES.map(t => t.storageKey), "bt_samples", "bt_lastCapture"];

function setStatus(kind, msg) {
  const el = $("status");
  el.className = kind;
  el.textContent = msg;
}

function refreshCounts() {
  chrome.storage.local.get([...TABLES.map(t => t.storageKey), "bt_lastCapture"], (d) => {
    // Returns counter = sum of all 3 stage buckets
    const totalReturns =
      Object.keys(d.bt_returns_intransit || {}).length +
      Object.keys(d.bt_returns_ofd       || {}).length +
      Object.keys(d.bt_returns_delivered || {}).length;
    $("cReturns").textContent  = totalReturns;
    $("cOrders").textContent   = Object.keys(d.bt_orders   || {}).length;
    $("cAds").textContent      = Object.keys(d.bt_ads      || {}).length;
    $("cPayments").textContent = Object.keys(d.bt_payments || {}).length;
    if (d.bt_lastCapture) {
      $("lastCapture").textContent = "Last capture: " + new Date(d.bt_lastCapture).toLocaleString("en-IN");
    }
  });
}

function refreshConnDot() {
  const ok = $("sbUrl").value.trim().startsWith("https://") && $("sbKey").value.trim().length > 10;
  $("connDot").className = ok ? "dot ok" : "dot";
  $("connDot").title = ok ? "Supabase configured" : "Supabase not configured";
}

// ── settings ──
chrome.storage.sync.get(["sbUrl", "sbKey"], (d) => {
  if (d.sbUrl) $("sbUrl").value = d.sbUrl;
  if (d.sbKey) $("sbKey").value = d.sbKey;
  refreshConnDot();
});
for (const id of ["sbUrl", "sbKey"]) {
  $(id).addEventListener("change", () => {
    chrome.storage.sync.set({ sbUrl: $("sbUrl").value.trim(), sbKey: $("sbKey").value.trim() });
    refreshConnDot();
  });
}

// ── sync ──
async function upsertChunk(baseUrl, key, table, rows) {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${table}: HTTP ${res.status} — ${text.slice(0, 180)}`);
  }
}

$("syncBtn").addEventListener("click", async () => {
  const baseUrl = $("sbUrl").value.trim().replace(/\/$/, "");
  const key = $("sbKey").value.trim();
  if (!baseUrl.startsWith("https://") || key.length < 10) {
    setStatus("err", "Enter your Supabase URL and publishable key first (same values as BizTrack's .env.local).");
    return;
  }

  $("syncBtn").disabled = true;
  setStatus("ok", "Syncing…");

  try {
    const data = await chrome.storage.local.get(TABLES.map(t => t.storageKey));
    const parts = [];

    for (const t of TABLES) {
      const map = data[t.storageKey] || {};
      const records = Object.values(map).map((r) => {
        // meesho_orders uses flat structured columns (schema-matched).
        // All return sub-tables + payments + ads use { id, data: JSONB }.
        if (t.table === "meesho_orders") return r;
        return { id: r.id, data: r };
      });
      if (records.length === 0) continue;
      for (let i = 0; i < records.length; i += 400) {
        await upsertChunk(baseUrl, key, t.table, records.slice(i, i + 400));
      }
      parts.push(`${records.length} ${t.label}`);
    }

    if (parts.length === 0) {
      setStatus("err", "Nothing captured yet. Browse Orders / Returns tracking pages on the supplier panel, then try again.");
    } else {
      // Clear local storage buffers upon successful sync
      chrome.storage.local.remove(TABLES.map(t => t.storageKey), () => {
        refreshCounts();
        setStatus("ok", `Synced ✓ ${parts.join(" · ")}. Local cache cleared. Reload BizTrack to see the update.`);
      });
    }
  } catch (err) {
    setStatus("err", "Sync failed — " + (err && err.message ? err.message : String(err)));
  } finally {
    $("syncBtn").disabled = false;
  }
});

// ── export (debugging aid) ──
$("exportBtn").addEventListener("click", async () => {
  const d = await chrome.storage.local.get([...TABLES.map(t => t.storageKey), "bt_samples"]);
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `biztrack-sync-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── clear ──
$("clearBtn").addEventListener("click", () => {
  chrome.storage.local.remove(ALL_STORAGE_KEYS, () => {
    refreshCounts();
    $("lastCapture").textContent = "Captured data cleared.";
    setStatus("ok", "Local captured data cleared. (Nothing was deleted from Supabase.)");
  });
});

refreshCounts();
setInterval(refreshCounts, 1500);
