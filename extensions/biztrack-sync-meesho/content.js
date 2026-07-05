// BizTrack Sync — content script.
// 1. Injects inject.js into the page so network responses can be observed.
// 2. Receives captured JSON payloads, classifies them (orders / returns / ads),
//    maps them into BizTrack row shapes, and stores them in
//    chrome.storage.local until the popup syncs them to Supabase.
//
// CLASSIFICATION STRATEGY (v3):
//   a) Endpoint-aware: check the URL path first against known Meesho API
//      routes and use a dedicated parser for each.
//   b) Regex fallback: for unknown URLs, fall back to heuristic field-name
//      matching (original behaviour).

(function () {
  "use strict";

  const EXTENSION_VERSION = "1.4.0";

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
  // "orders" | "returns_intransit" | "returns_ofd" | "returns_delivered" | "payout" | "payout_detail" | "ads" | "unknown"

  function detectEndpointType(url) {
    const u = String(url).toLowerCase();

    // Returns — detect specific sub-page to route to the correct Supabase table:
    //   returnTracking-intransit           → meesho_returns_in_transit
    //   returnTracking-ofd_reverse         → meesho_returns_out_delivery
    //   returnTracking-completed_delivered → meesho_returns_delivered
    if (/returntracking-intransit/.test(u) || /\/returns\/.*intransit/.test(u)) return "returns_intransit";
    if (/returntracking-ofd/.test(u) || /\/returns\/.*ofd/.test(u)) return "returns_ofd";
    if (/returntracking-completed/.test(u) || /returntracking-delivered/.test(u) || /\/returns\/.*delivered/.test(u)) return "returns_delivered";
    // Generic returns pages (fallback — unknown sub-page, default to in-transit bucket)
    if (
      /\/returns\/returntracking/.test(u) ||
      /\/returns\/list/.test(u) ||
      /\/rto\/list/.test(u) ||
      /\/return.?orders/.test(u) ||
      (/\/returns\//.test(u) && !/returnrate/.test(u))
    ) return "returns_intransit";

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
    product:      [/productname/, /^name$/, /^title$/, /productdetails/],
    image:        [/imageurl/, /productimage/, /^image$/, /thumbnail/, /imagelink/, /primaryimage/],
    sku:          [/^sku$/, /suppliersku/, /skuid/, /seller.?sku/, /productsku/, /sku/],
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
    // Returns-specific
    awb:          [/^awb$/, /awbnumber/, /airwaybill/, /trackingno/, /trackingnumber/],
    courier:      [/courierpartner/, /courier/, /logisticpartner/, /shippingpartner/],
    returnStatus: [/returnstatus/, /^status$/, /deliverystatus/, /rtostatus/],
    returnType:   [/typeofreturn/, /returntype/, /^type$/],
    returnReason: [/returnreason/, /reasonforreturn/, /reason/],
    returnDate:   [/returncreateddate/, /returndate/, /returncreat/],
    expectedDel:  [/expecteddelivery/, /edd/, /expecteddate/],
  };

  // ── Endpoint-aware mappers ────────────────────────────────────────

  /**
   * Maps a raw API row from the Meesho Orders endpoint to a BizTrack order.
   */
  function mapOrderRow(row, capturedAt) {
    const sub = String(row.sub_order_num || row.sub_order_no || pick(row, RE.subOrder) || "").trim();
    if (!sub || !/\d{6,}/.test(sub)) return null;

    const orderDate = toISODate(row.created_iso || row.order_date || pick(row, RE.orderDate));
    if (!orderDate) return null;

    const orderId = sub.includes("_") ? sub.slice(0, sub.lastIndexOf("_")) : sub;

    const sourceRaw = String(row.sub_order_source || row.order_source || pick(row, RE.source) || "").toLowerCase();
    const orderSource = sourceRaw.includes("ad") ? "ad_order" : sourceRaw || "";

    const productName = String(row.name || row.product_name || pick(row, RE.product) || "");
    const sku = String(row.product_sku || row.sku || pick(row, RE.sku) || "");
    const catalogId = String(row.product_id || row.catalog_id || pick(row, RE.catalogId) || "");
    const imageUrl = String(row.image || row.image_url || pick(row, RE.image) || "");
    const size = String(row.variation || row.size || pick(row, RE.size) || "");
    const qty = toNumber(row.quantity ?? row.qty ?? pick(row, RE.qty) ?? 1);
    const dispatchDate = toISODate(row.expected_dispatch_date_iso || row.dispatch_date || pick(row, RE.dispatchDate)) || "";

    return {
      id: sub,
      sub_order_no: sub,
      order_id: orderId,
      order_date: orderDate,
      dispatch_date: dispatchDate,
      status: String(row.status || pick(row, RE.status) || ""),
      product_name: productName,
      image_url: imageUrl,
      sku: sku,
      catalog_id: catalogId,
      packet_id: String(row.packet_id || pick(row, RE.packetId) || ""),
      size: size,
      qty: qty,
      listing_price: toNumber(row.listing_price || pick(row, RE.listPrice) || 0),
      selling_price: toNumber(row.selling_price || pick(row, RE.price) || 0),
      customer_state: String(row.customer_state || pick(row, RE.state) || ""),
      customer_city: String(row.customer_city || pick(row, RE.city) || ""),
      order_source: orderSource,
      data_source: "extension",
      captured_at: capturedAt,
      last_synced_at: capturedAt,
      last_updated_at: capturedAt,
      raw_json: row,
    };
  }

  /**
   * Maps a raw API row from any Meesho Returns tracking endpoint.
   * Handles: returnTracking-intransit, returnTracking-ofd_reverse,
   *          returnTracking-completed_delivered, and generic /returns/ pages.
   */
  function mapReturnRow(row, capturedAt, sourceUrl) {
    // Sub-order number is the primary key — must exist
    const sub = String(
      row.sub_order_num || row.sub_order_no || row.suborder_number || row.subOrderNum ||
      pick(row, RE.subOrder) || ""
    ).trim();
    if (!sub || !/\d{6,}/.test(sub)) return null;

    // Determine return sub-type from URL for auto-classification
    let urlStatus = "";
    const lu = String(sourceUrl).toLowerCase();
    if (/intransit/.test(lu)) urlStatus = "In Transit";
    else if (/ofd|outfordelivery/.test(lu)) urlStatus = "Out for Delivery";
    else if (/completed|delivered/.test(lu)) urlStatus = "Delivered";

    const awb = String(
      row.awb_number || row.awb || row.tracking_number ||
      pick(row, RE.awb) || ""
    ).trim();

    const courier = String(
      row.courier_partner || row.courier || row.logistic_partner ||
      pick(row, RE.courier) || ""
    ).trim();

    const status = String(
      row.status || row.return_status || row.delivery_status ||
      pick(row, RE.returnStatus) || urlStatus || "In Transit"
    ).trim();

    const typeOfReturn = String(
      row.type_of_return || row.return_type || row.typeOfReturn ||
      pick(row, RE.returnType) || ""
    ).trim();

    const returnReason = String(
      row.return_reason || row.reason_for_return || row.reason ||
      pick(row, RE.returnReason) || ""
    ).trim();

    const returnCreatedDate = toISODate(
      row.return_created_date || row.return_date || row.created_at ||
      pick(row, RE.returnDate)
    );

    const expectedDeliveryDate = toISODate(
      row.expected_delivery_date || row.edd || row.expected_date ||
      pick(row, RE.expectedDel)
    );

    const productName = String(
      row.product_name || row.name || pick(row, RE.product) || ""
    ).trim();

    const sku = String(row.sku || pick(row, RE.sku) || "").trim();

    const orderId = sub.includes("_") ? sub.slice(0, sub.lastIndexOf("_")) : sub;

    // Determine return stage from URL for metadata
    let returnStage = "unknown";
    if (/intransit/.test(lu)) returnStage = "in_transit";
    else if (/ofd|outfordelivery/.test(lu)) returnStage = "out_for_delivery";
    else if (/completed|delivered/.test(lu)) returnStage = "delivered";

    // Output uses camelCase to match the existing meesho_returns table schema
    // (which mirrors the MeeshoReturn TypeScript interface in ReturnsTab.tsx)
    return {
      id: sub,
      sNo: "",
      productName: productName,
      sku: sku,
      variation: String(row.variation || row.size || pick(row, RE.size) || "").trim(),
      meeshoPid: String(row.meesho_pid || row.product_id || pick(row, RE.catalogId) || "").trim(),
      category: String(row.category || "").trim(),
      qty: toNumber(row.quantity ?? row.qty ?? pick(row, RE.qty) ?? 1),
      orderNumber: orderId,
      suborderNumber: sub,
      dispatchDate: toISODate(row.dispatch_date || row.dispatched_at || pick(row, RE.dispatchDate)) || "",
      returnCreatedDate: returnCreatedDate,
      typeOfReturn: typeOfReturn,
      subType: String(row.sub_type || row.subtype || "").trim(),
      expectedDeliveryDate: expectedDeliveryDate,
      courierPartner: courier,
      awbNumber: awb,
      status: status,
      attempt: String(row.attempt || "").trim(),
      trackingLink: String(row.tracking_link || row.trackingLink || "").trim(),
      returnPriceType: String(row.return_price_type || row.returnPriceType || "").trim(),
      returnReason: returnReason,
      detailedReturnReason: String(row.detailed_return_reason || row.detailedReturnReason || "").trim(),
      deliveredDate: toISODate(row.delivered_date || row.deliveredDate || "") || "",
      proofOfDelivery: String(row.proof_of_delivery || row.proofOfDelivery || "").trim(),
      otpVerifiedAt: String(row.otp_verified_at || row.otpVerifiedAt || "").trim(),
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

  function classifyAndMap(arr, urlDate, endpointType, capturedAt, sourceUrl) {
    const first = arr[0];
    const keySet = Object.keys(first).map(normKey);
    const keys = keySet.join("|");

    const payments = {};
    const orders = {};
    const ads = {};
    // Three separate buckets — each maps to a distinct Supabase sub-table
    const returns_intransit = {};
    const returns_ofd = {};
    const returns_delivered = {};

    // Helper to route a parsed return row into the right bucket
    const routeReturn = (rec) => {
      if (!rec) return;
      if (endpointType === "returns_ofd") { returns_ofd[rec.id] = rec; return; }
      if (endpointType === "returns_delivered") { returns_delivered[rec.id] = rec; return; }
      // Default: in-transit bucket
      returns_intransit[rec.id] = rec;
    };

    // ── Endpoint-aware path ──

    // Returns — stage-specific tracking pages
    if (endpointType === "returns_intransit" || endpointType === "returns_ofd" || endpointType === "returns_delivered") {
      for (const row of arr) {
        routeReturn(mapReturnRow(row, capturedAt, sourceUrl));
      }
      return { payments, orders, ads, returns_intransit, returns_ofd, returns_delivered };
    }

    if (endpointType === "orders") {
      for (const row of arr) {
        const rec = mapOrderRow(row, capturedAt);
        if (rec) orders[rec.id] = rec;
      }
      return { payments, orders, ads, returns_intransit, returns_ofd, returns_delivered };
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
      return { payments, orders, ads, returns };
    }

    if (endpointType === "ads") {
      for (const row of arr) {
        const rec = mapAdsRow(row);
        if (rec) ads[rec.id] = rec;
      }
      return { payments, orders, ads, returns_intransit, returns_ofd, returns_delivered };
    }

    // ── Regex fallback (unknown endpoints) ───────────────────────
    const hasSub = /suborder/.test(keys);

    // Heuristic: detect return tracking responses even from unknown URLs
    const isReturn =
      hasSub &&
      /(awb|awbnumber|returnstatus|returnreason|typeofreturn|returntype|courierpartner|returncreated)/.test(keys);


    const isPayment =
      hasSub &&
      !isReturn &&
      /(finalsettlement|settlementamount|settlementdate|paymentdate|netamount|payableamount|netorderamount|orderamount)/.test(keys);
    const isOrder =
      hasSub &&
      !isPayment &&
      !isReturn &&
      /(orderdate|createdat|createdon|ordercreat|creatediso|orderts|productname|productdetails|reasonforcredit)/.test(keys);
    const isAds = /campaign/.test(keys) && /(cost|spend|deduction|amount)/.test(keys);
    const isPayout =
      !hasSub &&
      !isAds &&
      keySet.includes("netamount") &&
      (keySet.includes("dateiso") || keySet.includes("paymentdate") || keySet.includes("date"));

    if (isReturn) {
      // Unknown URL — classify by status field value
      for (const row of arr) {
        const rec = mapReturnRow(row, capturedAt, sourceUrl);
        if (!rec) continue;
        const st = String(rec.status || "").toLowerCase();
        if (st.includes("out") || st.includes("ofd")) returns_ofd[rec.id] = rec;
        else if (st === "delivered" || st === "returned") returns_delivered[rec.id] = rec;
        else returns_intransit[rec.id] = rec;
      }
    } else if (isPayout) {
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

    return { payments, orders, ads, returns_intransit, returns_ofd, returns_delivered };
  }

  // ── Buffered storage writes ───────────────────────────────────────

  let pending = { payments: {}, orders: {}, ads: {}, returns_intransit: {}, returns_ofd: {}, returns_delivered: {} };
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
    pending = { payments: {}, orders: {}, ads: {}, returns_intransit: {}, returns_ofd: {}, returns_delivered: {} };
    rawSamples = [];

    const storageKeys = ["bt_payments", "bt_orders", "bt_ads", "bt_returns_intransit", "bt_returns_ofd", "bt_returns_delivered", "bt_samples"];
    chrome.storage.local.get(storageKeys, (cur) => {
      const merged = {
        bt_payments:           Object.assign({}, cur.bt_payments || {},           toMerge.payments),
        bt_orders:             Object.assign({}, cur.bt_orders || {},             toMerge.orders),
        bt_ads:                Object.assign({}, cur.bt_ads || {},                toMerge.ads),
        bt_returns_intransit:  Object.assign({}, cur.bt_returns_intransit || {}, toMerge.returns_intransit),
        bt_returns_ofd:        Object.assign({}, cur.bt_returns_ofd || {},        toMerge.returns_ofd),
        bt_returns_delivered:  Object.assign({}, cur.bt_returns_delivered || {}, toMerge.returns_delivered),
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
      const { payments, orders, ads, returns_intransit, returns_ofd, returns_delivered } = classifyAndMap(entry.arr, urlDate, endpointType, capturedAt, msg.url);
      const nP = Object.keys(payments).length;
      const nO = Object.keys(orders).length;
      const nA = Object.keys(ads).length;
      const nR = Object.keys(returns_intransit).length + Object.keys(returns_ofd).length + Object.keys(returns_delivered).length;
      entry.matched = nP + nO + nA + nR > 0;
      if (entry.matched) {
        Object.assign(pending.payments, payments);
        Object.assign(pending.orders, orders);
        Object.assign(pending.ads, ads);
        Object.assign(pending.returns_intransit, returns_intransit);
        Object.assign(pending.returns_ofd, returns_ofd);
        Object.assign(pending.returns_delivered, returns_delivered);
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
