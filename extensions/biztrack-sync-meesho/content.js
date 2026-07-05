// BizTrack Sync — content script.
// 1. Injects inject.js into the page so network responses can be observed.
// 2. Receives captured JSON payloads, classifies them (orders / payments /
//    ads), maps them into BizTrack row shapes, and stores them in
//    chrome.storage.local until the popup syncs them to Supabase.

(function () {
  "use strict";

  // ── inject the page hook as early as possible ──
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("inject.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn("[BizTrack Sync] inject failed:", e);
  }

  // ── helpers ──
  const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");

  // Return the value of the first property whose normalised key matches any regex.
  function pick(obj, regexes) {
    for (const key of Object.keys(obj)) {
      const nk = normKey(key);
      for (const re of regexes) {
        if (re.test(nk)) {
          const v = obj[key];
          if (v !== null && v !== undefined && v !== "") return v;
        }
      }
    }
    // one level deep
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const key2 of Object.keys(v)) {
          const nk = normKey(key2);
          for (const re of regexes) {
            if (re.test(nk)) {
              const v2 = v[key2];
              if (v2 !== null && v2 !== undefined && v2 !== "") return v2;
            }
          }
        }
      }
    }
    return undefined;
  }

  function toNumber(v) {
    if (typeof v === "number" && isFinite(v)) return v;
    const n = parseFloat(String(v ?? "").replace(/[₹,\s]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function toISODate(v) {
    if (v === null || v === undefined || v === "") return "";
    // epoch seconds / ms
    if (typeof v === "number") {
      const ms = v > 1e12 ? v : v > 1e9 ? v * 1000 : 0;
      if (!ms) return "";
      const d = new Date(ms);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return "";
  }

  // Recursively collect arrays of plain objects from a JSON payload.
  // Each entry: { arr, path } so debug samples can show where data lives.
  // For nested container arrays (e.g. groups each holding an `orders` array),
  // the inner arrays of ALL items are merged so nothing is missed.
  function findObjectArrays(node, out, depth, path) {
    if (depth > 7 || !node) return;
    if (Array.isArray(node)) {
      if (node.length > 0 && typeof node[0] === "object" && node[0] !== null && !Array.isArray(node[0])) {
        out.push({ arr: node, path });

        // merge same-named nested arrays across ALL items (grouped lists)
        const nestedByKey = {};
        for (const item of node) {
          if (!item || typeof item !== "object") continue;
          for (const k of Object.keys(item)) {
            const v = item[k];
            if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null && !Array.isArray(v[0])) {
              (nestedByKey[k] = nestedByKey[k] || []).push(...v);
            } else if (v && typeof v === "object" && !Array.isArray(v)) {
              findObjectArrays(v, out, depth + 1, `${path}[].${k}`);
            }
          }
        }
        for (const k of Object.keys(nestedByKey)) {
          findObjectArrays(nestedByKey[k], out, depth + 1, `${path}[].${k}`);
        }
        return;
      }
      for (const item of node) findObjectArrays(item, out, depth + 1, `${path}[]`);
      return;
    }
    if (typeof node === "object") {
      for (const k of Object.keys(node)) findObjectArrays(node[k], out, depth + 1, path ? `${path}.${k}` : k);
    }
  }

  const RE = {
    subOrder: [/suborder/],
    orderDate: [/orderdate/, /ordercreat/, /createdat/, /createdon/, /orderedat/, /creatediso/, /^created$/, /orderts/, /^ts$/],
    status: [/reasonforcredit/, /orderstatus/, /liveorderstatus/, /^status$/, /statustype/],
    product: [/productname/, /^name$/, /title/],
    sku: [/^sku$/, /suppliersku/, /skuid/],
    size: [/^size$/, /variation/],
    qty: [/^quantity$/, /^qty$/],
    price: [/discountedprice/, /listingprice/, /sellingprice/, /totalamount/, /^price$/, /^amount$/],
    state: [/customerstate/, /^state$/],
    payDate: [/paymentdate/, /settlementdate/, /disbursementdate/, /payoutdate/],
    settleAmt: [/finalsettlement/, /settlementamount/, /netamount/, /payableamount/, /settlementvalue/],
    campaign: [/campaignid/, /^campaign/],
    dedDate: [/deductiondate/, /debitdate/, /^date$/],
    dedDur: [/deductionduration/, /duration/, /spenddate/, /addate/],
    adCost: [/totaladscost/, /totalcost/, /adcost/, /totalspend/, /^cost$/, /^spend$/, /amountwithgst/, /^amount$/],
    gst: [/^gst$/, /gstamount/],
  };

  function classifyAndMap(arr) {
    const first = arr[0];
    const keySet = Object.keys(first).map(normKey);
    const keys = keySet.join("|");

    const hasSub = /suborder/.test(keys);
    const isPayment = hasSub && /(finalsettlement|settlementamount|settlementdate|paymentdate|netamount|payableamount)/.test(keys);
    const isOrder = hasSub && !isPayment && /(orderdate|createdat|createdon|ordercreat|creatediso|orderts|productname|productdetails|reasonforcredit)/.test(keys);
    const isAds = /campaign/.test(keys) && /(cost|spend|deduction|amount)/.test(keys);
    // Meesho payouts APIs (previous-payments / upcoming-payments / panel-graph-overview):
    // day-level totals like { date_iso, netAmount, transferId } or { payment_date, net_amount }
    const isPayout =
      !hasSub &&
      !isAds &&
      keySet.includes("netamount") &&
      (keySet.includes("dateiso") || keySet.includes("paymentdate") || keySet.includes("date"));

    const payments = {};
    const orders = {};
    const ads = {};

    if (isPayout) {
      for (const row of arr) {
        const date = toISODate(
          row.date_iso ?? pick(row, [/^dateiso$/, /^paymentdate$/, /^date$/])
        );
        if (!date) continue;
        let amount = 0;
        for (const key of Object.keys(row)) {
          if (normKey(key) === "netamount") {
            amount = toNumber(row[key]);
            break;
          }
        }
        if (!amount) continue;
        const transferId = String(pick(row, [/transferid/]) ?? "");
        const rec = {
          id: `payout|${date}`,
          subOrderNo: `PAYOUT_${date}`,
          orderDate: "",
          dispatchDate: "",
          productName: "Meesho payout (daily total)",
          sku: "",
          liveOrderStatus: "",
          listingPrice: 0,
          qty: 1,
          transactionId: transferId,
          paymentDate: date,
          settlementAmount: amount,
          saleAmount: 0,
          returnAmount: 0,
          priceType: "PAYOUT_AGGREGATE",
        };
        payments[rec.id] = rec;
      }
    } else if (isPayment) {
      for (const row of arr) {
        const sub = String(pick(row, RE.subOrder) ?? "").trim();
        if (!sub || !/\d{6,}/.test(sub)) continue;
        const paymentDate = toISODate(pick(row, RE.payDate));
        const rec = {
          id: `${sub}|${paymentDate}`,
          subOrderNo: sub,
          orderDate: toISODate(pick(row, RE.orderDate)),
          dispatchDate: "",
          productName: String(pick(row, RE.product) ?? ""),
          sku: String(pick(row, RE.sku) ?? ""),
          liveOrderStatus: String(pick(row, RE.status) ?? ""),
          listingPrice: toNumber(pick(row, RE.price)),
          qty: toNumber(pick(row, RE.qty)) || 1,
          transactionId: "",
          paymentDate,
          settlementAmount: toNumber(pick(row, RE.settleAmt)),
          saleAmount: 0,
          returnAmount: 0,
          priceType: "",
        };
        payments[rec.id] = rec;
      }
    } else if (isOrder) {
      for (const row of arr) {
        const sub = String(pick(row, RE.subOrder) ?? "").trim();
        if (!sub || !/\d{6,}/.test(sub)) continue;
        const orderDate = toISODate(pick(row, RE.orderDate));
        if (!orderDate) continue;
        const rec = {
          id: sub,
          subOrderNo: sub,
          orderDate,
          status: String(pick(row, RE.status) ?? ""),
          productName: String(pick(row, RE.product) ?? ""),
          sku: String(pick(row, RE.sku) ?? ""),
          size: String(pick(row, RE.size) ?? ""),
          qty: toNumber(pick(row, RE.qty)) || 1,
          price: toNumber(pick(row, RE.price)),
          state: String(pick(row, RE.state) ?? ""),
        };
        orders[rec.id] = rec;
      }
    } else if (isAds) {
      for (const row of arr) {
        const campaignId = String(pick(row, RE.campaign) ?? "").trim();
        if (!campaignId) continue;
        const deductionDate = toISODate(pick(row, RE.dedDate));
        const deductionDuration = toISODate(pick(row, RE.dedDur));
        const total = Math.abs(toNumber(pick(row, RE.adCost)));
        if (!total) continue;
        const rec = {
          id: `${deductionDuration}|${deductionDate}|${campaignId}`,
          deductionDuration,
          deductionDate: deductionDate || deductionDuration,
          campaignId,
          adCost: total,
          gst: Math.abs(toNumber(pick(row, RE.gst))),
          totalAdsCost: total,
        };
        ads[rec.id] = rec;
      }
    }

    return { payments, orders, ads };
  }

  // ── buffered storage writes ──
  let pending = { payments: {}, orders: {}, ads: {} };
  let rawSamples = [];
  let flushTimer = null;

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 800);
  }

  function flush() {
    flushTimer = null;
    const toMerge = pending;
    const samples = rawSamples;
    pending = { payments: {}, orders: {}, ads: {} };
    rawSamples = [];

    chrome.storage.local.get(["bt_payments", "bt_orders", "bt_ads", "bt_samples"], (cur) => {
      const merged = {
        bt_payments: Object.assign({}, cur.bt_payments || {}, toMerge.payments),
        bt_orders: Object.assign({}, cur.bt_orders || {}, toMerge.orders),
        bt_ads: Object.assign({}, cur.bt_ads || {}, toMerge.ads),
        bt_samples: [...(cur.bt_samples || []), ...samples].slice(-25),
        bt_lastCapture: Date.now(),
      };
      chrome.storage.local.set(merged);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== "biztrack-sync" || !msg.body) return;

    let json;
    try {
      json = JSON.parse(msg.body);
    } catch {
      return;
    }

    const arrays = [];
    findObjectArrays(json, arrays, 0, "");
    if (arrays.length === 0) return;

    let captured = false;
    for (const entry of arrays) {
      const { payments, orders, ads } = classifyAndMap(entry.arr);
      const nP = Object.keys(payments).length;
      const nO = Object.keys(orders).length;
      const nA = Object.keys(ads).length;
      entry.matched = nP + nO + nA > 0;
      if (entry.matched) {
        Object.assign(pending.payments, payments);
        Object.assign(pending.orders, orders);
        Object.assign(pending.ads, ads);
        captured = true;
      }
    }

    // keep raw samples of the API shapes seen (url + path + field names only)
    try {
      rawSamples.push({
        url: String(msg.url).slice(0, 220),
        matched: captured,
        at: new Date().toISOString(),
        arrays: arrays.slice(0, 6).map((e) => ({
          path: e.path,
          matched: !!e.matched,
          keys: Object.keys(e.arr[0] || {}).slice(0, 45),
        })),
      });
    } catch {
      /* ignore */
    }

    scheduleFlush();
  });
})();
