// BizTrack Sync — popup: settings, captured counts, sync to Supabase.

"use strict";

const $ = (id) => document.getElementById(id);

const TABLES = [
  { storageKey: "bt_payments", table: "meesho_payments", label: "payments" },
  { storageKey: "bt_orders", table: "meesho_order_log", label: "orders" },
  { storageKey: "bt_ads", table: "meesho_ads", label: "ads rows" },
];

function setStatus(kind, msg) {
  const el = $("status");
  el.className = kind;
  el.textContent = msg;
}

function refreshCounts() {
  chrome.storage.local.get(["bt_payments", "bt_orders", "bt_ads", "bt_lastCapture"], (d) => {
    $("cPayments").textContent = Object.keys(d.bt_payments || {}).length;
    $("cOrders").textContent = Object.keys(d.bt_orders || {}).length;
    $("cAds").textContent = Object.keys(d.bt_ads || {}).length;
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
    const data = await chrome.storage.local.get(["bt_payments", "bt_orders", "bt_ads"]);
    const parts = [];

    for (const t of TABLES) {
      const map = data[t.storageKey] || {};
      const records = Object.values(map).map((r) => ({ id: r.id, data: r }));
      if (records.length === 0) continue;
      for (let i = 0; i < records.length; i += 400) {
        await upsertChunk(baseUrl, key, t.table, records.slice(i, i + 400));
      }
      parts.push(`${records.length} ${t.label}`);
    }

    if (parts.length === 0) {
      setStatus("err", "Nothing captured yet. Open the supplier panel and browse your Orders, Payments and Ads pages, then try again.");
    } else {
      setStatus("ok", `Synced ✓ ${parts.join(" · ")}. Reload BizTrack to see the update.`);
    }
  } catch (err) {
    setStatus("err", "Sync failed — " + (err && err.message ? err.message : String(err)));
  } finally {
    $("syncBtn").disabled = false;
  }
});

// ── export (debugging aid) ──
$("exportBtn").addEventListener("click", async () => {
  const d = await chrome.storage.local.get(["bt_payments", "bt_orders", "bt_ads", "bt_samples"]);
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
  chrome.storage.local.remove(["bt_payments", "bt_orders", "bt_ads", "bt_samples", "bt_lastCapture"], () => {
    refreshCounts();
    $("lastCapture").textContent = "Captured data cleared.";
    setStatus("ok", "Local captured data cleared. (Nothing was deleted from Supabase.)");
  });
});

refreshCounts();
setInterval(refreshCounts, 1500);
