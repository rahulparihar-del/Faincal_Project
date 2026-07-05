// BizTrack Sync — content script.
// 1. Injects inject.js into the page so network responses can be observed.
// 2. Receives captured JSON payloads, classifies them (orders / payments /
//    ads), maps them into BizTrack row shapes, and stores them in
//    chrome.storage.local until the popup syncs them to Supabase.
//
// CLASSIFICATION STRATEGY (v2):
//   a) Endpoint-aware: check the URL path first against known Meesho API
//      routes and use a dedicated parser for each.
//   b) Regex fallback: for unknown URLs, fall back to heuristic field-name
//      matching (original behaviour).

(function () {
  "use strict";

  const EXTENSION_VERSION = "1.3.0";

  // ── inject the page hook as early as possible ──
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("inject.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn("[BizTrack Sync] inject failed:", e);
  }

  // ── helpers ──────────────────────────────────────────────────────

  const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");

  // Return value of first property whose normalised key matches any regex.
  // Searches two levels deep.
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

  // ── Endpoint detection ────────────────────────────────────────────
  // Returns a type string for known Meesho Supplier Panel API URLs.
  // "orders" | "payments" | "payout" | "ads" | "unknown"

  function detectEndpointType(url) {
    const u = String(url).toLowerCase();
    // Orders — pending, ready-to-ship, shipped, manage-orders
    if (/\/supplier\/orders/.test(u) || /\/manage.?orders/.test(u) || /\/order.?list/.test(u)) return "orders";
    // Per-order payout detail (payment date in URL)
    if (/\/previous.?payment|\/payout.?detail|\/payment.?breakdown/.test(u)) return "payout_detail";
    // Aggregate payment overview / graph
    if (/\/panel.?graph|\/payment.?overview|\/upcoming.?payment|\/previous.?payment/.test(u)) return "payout";
    // Ads / campaign pages
    if (/\/ads|\/campaign|\/advertisement/.test(u)) return "ads";
    return "unknown";
  }

  // ── Regex matchers (fallback) ─────────────────────────────────────

  const RE = {
    subOrder:     [/suborder/],
    orderDate:    [/orderdate/, /ordercreat/, /createdat/, /createdon/, /orderedat/, /creatediso/, /^created$/, /orderts/, /^ts$/],
    dispatchDate: [/dispatchdate/, /sladate/, /promiseddate/, /dispatchby/, /dispatchdeadline/],
    status:       [/reasonforcredit/, /orderstatus/, /liveorderstatus/, /^status$/, /statustype/, /contribution/],
    product:      [/productname/, /^name$/, /title/, /productdetails/],
    image:        [/imageurl/, /productimage/, /^image$/, /thumbnail/, /imagelink/, /primaryimage/],
    sku:          [/^sku$/, /suppliersku/, /skuid/, /seller.?sku/],
    size:         [/^size$/, /variation/, /^sizevariant$/],
    qty:          [/^quantity$/, /^qty$/, /^units$/],
    listPrice:    [/listingprice/, /listedprice/, /^listprice$/, /mrp/],
    price:        [/discountedprice/, /sellingprice/, /totalamount/, /^price$/, /^amount$/, /netsalesprice/],
    state:        [/customerstate/, /^state$/],
    city:         [/customercity/, /^city$/],
    source:       [/ordersource/, /ordertype/, /^source$/, /isadorder/, /adorder/],
    catalogId:    [/catalogid/, /^pid$/, /meeshopid/, /^productid$/, /^catalog$/, /meeshoartid/],
    packetId:     [/packetid/, /^packet$/, /shipmentid/],
    payDate:      [/paymentdate/, /settlementdate/, /disbursementdate/, /payoutdate/],
    settleAmt:    [/finalsettlement/, /settlementamount/, /^netorderamount$/, /^netamount$/, /payableamount/, /settlementvalue/],
    campaign:     [/campaignid/, /^campaign/],
    dedDate:      [/deductiondate/, /debitdate/, /^date$/],
    dedDur:       [/deductionduration/, /duration/, /spenddate/, /addate/],
    adCost:       [/totaladscost/, /totalcost/, /adcost/, /totalspend/, /^cost$/, /^spend$/, /amountwithgst/, /^amount$/],
    gst:          [/^gst$/, /gstamount/],
  };

  // ── Endpoint-aware mappers ────────────────────────────────────────

  /**
   * Maps a raw API row from the Meesho Orders endpoint to a BizTrack order.
   * Field names on this endpoint are relatively consistent.
   */
  function mapOrderRow(row, capturedAt) {
    const sub = String(pick(row, RE.subOrder) ?? "").trim();
    if (!sub || !/\d{6,}/.test(sub)) return null;

    const orderDate = toISODate(pick(row, RE.orderDate));
    if (!orderDate) return null;

    const orderId = sub.includes("_") ? sub.slice(0, sub.lastIndexOf("_")) : sub;

    // Try to detect "ad order" from various fields
    const sourceRaw = String(pick(row, RE.source) ?? "").toLowerCase();
    const orderSource = sourceRaw.includes("ad") ? "ad_order" : sourceRaw || "";

    return {
      id: sub,
      sub_order_no: sub,
      order_id: orderId,
      order_date: orderDate,
      dispatch_date: toISODate(pick(row, RE.dispatchDate)) || "",
      status: String(pick(row, RE.status) ?? ""),
      product_name: String(pick(row, RE.product) ?? ""),
      image_url: String(pick(row, RE.image) ?? ""),
      sku: String(pick(row, RE.sku) ?? ""),
      catalog_id: String(pick(row, RE.catalogId) ?? ""),
      packet_id: String(pick(row, RE.packetId) ?? ""),
      size: String(pick(row, RE.size) ?? ""),
      qty: toNumber(pick(row, RE.qty)) || 1,
      listing_price: toNumber(pick(row, RE.listPrice)),
      selling_price: toNumber(pick(row, RE.price)),
      customer_state: String(pick(row, RE.state) ?? ""),
      customer_city: String(pick(row, RE.city) ?? ""),
      order_source: orderSource,
      data_source: "extension",
      captured_at: capturedAt,
      last_synced_at: capturedAt,
      last_updated_at: capturedAt,
      raw_json: row,
    };
  }

  function mapPaymentRow(row, urlDate) {
    const sub = String(pick(row, RE.subOrder) ?? "").trim();
    if (!sub || !/\d{6,}/.test(sub)) return null;
    const paymentDate = toISODate(pick(row, RE.payDate)) || urlDate || "";
    return {
      id: `${sub}|${paymentDate}`,
      subOrderNo: sub,
      orderDate: toISODate(pick(row, RE.orderDate)),
      dispatchDate: "",
      productName: String(pick(row, RE.product) ?? ""),
      sku: String(pick(row, RE.sku) ?? ""),
      liveOrderStatus: String(pick(row, RE.status) ?? ""),
      listingPrice: toNumber(pick(row, RE.listPrice) ?? pick(row, RE.price)),
      qty: toNumber(pick(row, RE.qty)) || 1,
      transactionId: "",
      paymentDate,
      settlementAmount: toNumber(pick(row, RE.settleAmt)),
      saleAmount: 0,
      returnAmount: 0,
      priceType: "",
    };
  }

  function mapPayoutRow(row) {
    const date = toISODate(
      row.date_iso ?? pick(row, [/^dateiso$/, /^paymentdate$/, /^date$/])
    );
    if (!date) return null;
    const exact = {};
    for (const key of Object.keys(row)) exact[normKey(key)] = row[key];
    const bankNet = toNumber(exact["netamount"]);
    const orderAmount = toNumber(exact["netorderamount"]);
    const recovery = Math.abs(toNumber(exact["netplatformrecovery"]));
    const compensation = toNumber(exact["netplatformcompensation"]);
    if (!bankNet && !orderAmount) return null;
    const transferId = String(pick(row, [/transferid/]) ?? "");
    const settlement = orderAmount || compensation ? orderAmount + compensation : bankNet;
    return {
      payment: {
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
        settlementAmount: settlement,
        saleAmount: bankNet,
        returnAmount: 0,
        priceType: "PAYOUT_AGGREGATE",
      },
      recovery,
      date,
    };
  }

  function mapAdsRow(row) {
    const campaignId = String(pick(row, RE.campaign) ?? "").trim();
    if (!campaignId) return null;
    const deductionDate = toISODate(pick(row, RE.dedDate));
    const deductionDuration = toISODate(pick(row, RE.dedDur));
    const total = Math.abs(toNumber(pick(row, RE.adCost)));
    if (!total) return null;
    return {
      id: `${deductionDuration}|${deductionDate}|${campaignId}`,
      deductionDuration,
      deductionDate: deductionDate || deductionDuration,
      campaignId,
      adCost: total,
      gst: Math.abs(toNumber(pick(row, RE.gst))),
      totalAdsCost: total,
    };
  }

  // ── Main classifier ───────────────────────────────────────────────

  function classifyAndMap(arr, urlDate, endpointType, capturedAt) {
    const first = arr[0];
    const keySet = Object.keys(first).map(normKey);
    const keys = keySet.join("|");

    const payments = {};
    const orders = {};
    const ads = {};

    // ── Endpoint-aware path ──
    if (endpointType === "orders") {
      for (const row of arr) {
        const rec = mapOrderRow(row, capturedAt);
        if (rec) orders[rec.id] = rec;
      }
      return { payments, orders, ads };
    }

    if (endpointType === "payout" || endpointType === "payout_detail") {
      const hasSub = /suborder/.test(keys);
      const isDetail = hasSub && /(finalsettlement|settlementamount|paymentdate|netamount)/.test(keys);

      if (isDetail) {
        for (const row of arr) {
          const rec = mapPaymentRow(row, urlDate);
          if (rec) payments[rec.id] = rec;
        }
      } else {
        for (const row of arr) {
          const mapped = mapPayoutRow(row);
          if (!mapped) continue;
          payments[mapped.payment.id] = mapped.payment;
          if (mapped.recovery > 0) {
            const adRec = {
              id: `payoutads|${mapped.date}`,
              deductionDuration: mapped.date,
              deductionDate: mapped.date,
              campaignId: "PAYOUT_RECOVERY",
              adCost: mapped.recovery,
              gst: 0,
              totalAdsCost: mapped.recovery,
            };
            ads[adRec.id] = adRec;
          }
        }
      }
      return { payments, orders, ads };
    }

    if (endpointType === "ads") {
      for (const row of arr) {
        const rec = mapAdsRow(row);
        if (rec) ads[rec.id] = rec;
      }
      return { payments, orders, ads };
    }

    // ── Regex fallback (unknown endpoints) ───────────────────────
    const hasSub = /suborder/.test(keys);
    const isPayment =
      hasSub &&
      /(finalsettlement|settlementamount|settlementdate|paymentdate|netamount|payableamount|netorderamount|orderamount)/.test(keys);
    const isOrder =
      hasSub &&
      !isPayment &&
      /(orderdate|createdat|createdon|ordercreat|creatediso|orderts|productname|productdetails|reasonforcredit)/.test(keys);
    const isAds = /campaign/.test(keys) && /(cost|spend|deduction|amount)/.test(keys);
    const isPayout =
      !hasSub &&
      !isAds &&
      keySet.includes("netamount") &&
      (keySet.includes("dateiso") || keySet.includes("paymentdate") || keySet.includes("date"));

    if (isPayout) {
      for (const row of arr) {
        const mapped = mapPayoutRow(row);
        if (!mapped) continue;
        payments[mapped.payment.id] = mapped.payment;
        if (mapped.recovery > 0) {
          const adRec = {
            id: `payoutads|${mapped.date}`,
            deductionDuration: mapped.date,
            deductionDate: mapped.date,
            campaignId: "PAYOUT_RECOVERY",
            adCost: mapped.recovery,
            gst: 0,
            totalAdsCost: mapped.recovery,
          };
          ads[adRec.id] = adRec;
        }
      }
    } else if (isPayment) {
      for (const row of arr) {
        const rec = mapPaymentRow(row, urlDate);
        if (rec) payments[rec.id] = rec;
      }
    } else if (isOrder) {
      for (const row of arr) {
        const rec = mapOrderRow(row, capturedAt);
        if (rec) orders[rec.id] = rec;
      }
    } else if (isAds) {
      for (const row of arr) {
        const rec = mapAdsRow(row);
        if (rec) ads[rec.id] = rec;
      }
    }

    return { payments, orders, ads };
  }

  // ── Buffered storage writes ───────────────────────────────────────

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
        bt_extensionVersion: EXTENSION_VERSION,
      };
      chrome.storage.local.set(merged);
    });
  }

  // ── Message listener ──────────────────────────────────────────────

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

    const capturedAt = new Date().toISOString();
    const endpointType = detectEndpointType(msg.url);

    const arrays = [];
    findObjectArrays(json, arrays, 0, "");
    if (arrays.length === 0) return;

    // Extract date from URL (for payout detail pages)
    const urlDateMatch = String(msg.url).match(/(\d{4}-\d{2}-\d{2})/);
    const urlDate = urlDateMatch ? urlDateMatch[1] : "";

    let captured = false;
    for (const entry of arrays) {
      const { payments, orders, ads } = classifyAndMap(entry.arr, urlDate, endpointType, capturedAt);
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

    // Raw samples for debugging (url + endpoint type + field names)
    try {
      rawSamples.push({
        url: String(msg.url).slice(0, 220),
        endpointType,
        matched: captured,
        at: capturedAt,
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
