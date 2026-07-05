// Growth / loss analytics for the Meesho Payments & Ads tab.
// Pure math over parsed payment/ads/order rows — no AI needed here.

import {
  MeeshoPaymentRow,
  MeeshoAdsRow,
  MeeshoOrderLogRow,
  todayISO,
  resolvePayments,
  isAggregateRow,
} from "./paymentsParser";

export interface PeriodStats {
  key: string; // e.g. "2026-W23" or "2026-06"
  label: string; // "9–15 Jun" or "June 2026"
  start: string; // YYYY-MM-DD
  end: string;
  orders: number;
  orderValue: number;
  delivered: number;
  returned: number; // return + RTO + exchange
  settled: number; // payments with date in period (≤ today)
  upcoming: number; // payments with future date in period
  ads: number;
  net: number; // settled + upcoming − ads
}

export interface GrowthMetric {
  current: number;
  previous: number;
  growthPct: number | null; // null when previous is 0
}

export interface SkuStat {
  sku: string;
  productName: string;
  orders: number;
  delivered: number;
  returned: number;
  settled: number;
  returnRatePct: number;
}

export interface Analytics {
  weekly: PeriodStats[]; // oldest → newest
  monthly: PeriodStats[];
  ordersWoW: GrowthMetric;
  paymentWoW: GrowthMetric;
  ordersMoM: GrowthMetric;
  paymentMoM: GrowthMetric;
  adsMoM: GrowthMetric;
  returnRatePct: number; // overall
  adsPctOfSettled: number; // ads spend as % of settled+upcoming payments
  avgSettlementPerDelivered: number;
  avgDailyOrders: number;
  bestDay: { date: string; orders: number } | null;
  topSkus: SkuStat[]; // by orders desc
  worstSkus: SkuStat[]; // highest return rate (min 3 orders)
  daily: { date: string; orders: number; settled: number; ads: number }[]; // oldest → newest, for charts
}

// ── date helpers ────────────────────────────────────────────────────

function isoWeekKey(iso: string): { key: string; start: string; end: string } {
  const d = new Date(iso + "T00:00:00");
  // Monday-based week start
  const day = (d.getDay() + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { key: fmt(start), start: fmt(start), end: fmt(end) };
}

function weekLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sm = s.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const em = e.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${sm} – ${em}`;
}

function monthLabelOf(key: string): string {
  return new Date(key + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function growth(current: number, previous: number): GrowthMetric {
  return {
    current,
    previous,
    growthPct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

// ── main ────────────────────────────────────────────────────────────

export function buildAnalytics(
  rawPayments: MeeshoPaymentRow[],
  ads: MeeshoAdsRow[],
  orderLog: MeeshoOrderLogRow[]
): Analytics {
  const payments = resolvePayments(rawPayments);
  const today = todayISO();

  // Unified per-order view (unique suborder): orderDate, status, price, sku
  interface OrderView {
    subOrderNo: string;
    orderDate: string;
    status: string;
    value: number;
    sku: string;
    productName: string;
    settled: number;
  }
  const orderMap = new Map<string, OrderView>();
  for (const o of orderLog) {
    if (!o.orderDate) continue;
    orderMap.set(o.subOrderNo, {
      subOrderNo: o.subOrderNo,
      orderDate: o.orderDate,
      status: o.status,
      value: o.price * (o.qty || 1),
      sku: o.sku,
      productName: o.productName,
      settled: 0,
    });
  }
  for (const p of payments) {
    const existing = orderMap.get(p.subOrderNo);
    if (existing) {
      // payment file has authoritative status; keep order-log date
      if (p.liveOrderStatus) existing.status = p.liveOrderStatus;
      if (!existing.sku && p.sku) existing.sku = p.sku;
      if (!existing.productName && p.productName) existing.productName = p.productName;
      existing.settled += p.settlementAmount;
    } else if (p.orderDate) {
      orderMap.set(p.subOrderNo, {
        subOrderNo: p.subOrderNo,
        orderDate: p.orderDate,
        status: p.liveOrderStatus,
        value: p.listingPrice * (p.qty || 1),
        sku: p.sku,
        productName: p.productName,
        settled: p.settlementAmount,
      });
    } else {
      // no order date at all — still track settlement under sku stats
    }
  }
  const orders = Array.from(orderMap.values());

  const isDelivered = (s: string) => s.toLowerCase().includes("deliver");
  const isReturned = (s: string) => {
    const l = s.toLowerCase();
    return l.includes("return") || l.includes("rto") || l.includes("exchange");
  };

  // ── period buckets ──
  const weeklyMap = new Map<string, PeriodStats>();
  const monthlyMap = new Map<string, PeriodStats>();

  const getWeek = (iso: string): PeriodStats => {
    const w = isoWeekKey(iso);
    let s = weeklyMap.get(w.key);
    if (!s) {
      s = {
        key: w.key,
        label: weekLabel(w.start, w.end),
        start: w.start,
        end: w.end,
        orders: 0,
        orderValue: 0,
        delivered: 0,
        returned: 0,
        settled: 0,
        upcoming: 0,
        ads: 0,
        net: 0,
      };
      weeklyMap.set(w.key, s);
    }
    return s;
  };
  const getMonth = (iso: string): PeriodStats => {
    const key = iso.slice(0, 7);
    let s = monthlyMap.get(key);
    if (!s) {
      s = {
        key,
        label: monthLabelOf(key),
        start: `${key}-01`,
        end: `${key}-31`,
        orders: 0,
        orderValue: 0,
        delivered: 0,
        returned: 0,
        settled: 0,
        upcoming: 0,
        ads: 0,
        net: 0,
      };
      monthlyMap.set(key, s);
    }
    return s;
  };

  // Orders & statuses → bucketed by ORDER date
  const dailyOrders = new Map<string, number>();
  for (const o of orders) {
    for (const b of [getWeek(o.orderDate), getMonth(o.orderDate)]) {
      b.orders += 1;
      b.orderValue += o.value;
      if (isDelivered(o.status)) b.delivered += 1;
      else if (isReturned(o.status)) b.returned += 1;
    }
    dailyOrders.set(o.orderDate, (dailyOrders.get(o.orderDate) || 0) + 1);
  }

  // Payments → bucketed by PAYMENT date
  const dailySettled = new Map<string, number>();
  for (const p of payments) {
    if (!p.paymentDate) continue;
    const upcoming = p.paymentDate > today;
    for (const b of [getWeek(p.paymentDate), getMonth(p.paymentDate)]) {
      if (upcoming) b.upcoming += p.settlementAmount;
      else b.settled += p.settlementAmount;
    }
    if (!upcoming) {
      dailySettled.set(p.paymentDate, (dailySettled.get(p.paymentDate) || 0) + p.settlementAmount);
    }
  }

  // Ads → bucketed by spend day
  const dailyAds = new Map<string, number>();
  for (const a of ads) {
    const d = a.deductionDuration || a.deductionDate;
    if (!d) continue;
    getWeek(d).ads += a.totalAdsCost;
    getMonth(d).ads += a.totalAdsCost;
    dailyAds.set(d, (dailyAds.get(d) || 0) + a.totalAdsCost);
  }

  const finalize = (m: Map<string, PeriodStats>): PeriodStats[] => {
    const arr = Array.from(m.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
    for (const s of arr) s.net = s.settled + s.upcoming - s.ads;
    return arr;
  };
  const weekly = finalize(weeklyMap);
  const monthly = finalize(monthlyMap);

  // ── growth metrics: compare the last two complete-ish periods ──
  const lastTwo = (arr: PeriodStats[]): [PeriodStats | undefined, PeriodStats | undefined] => {
    return [arr[arr.length - 1], arr[arr.length - 2]];
  };
  const [wCur, wPrev] = lastTwo(weekly);
  const [mCur, mPrev] = lastTwo(monthly);

  const ordersWoW = growth(wCur?.orders ?? 0, wPrev?.orders ?? 0);
  const paymentWoW = growth(
    (wCur?.settled ?? 0) + (wCur?.upcoming ?? 0),
    (wPrev?.settled ?? 0) + (wPrev?.upcoming ?? 0)
  );
  const ordersMoM = growth(mCur?.orders ?? 0, mPrev?.orders ?? 0);
  const paymentMoM = growth(
    (mCur?.settled ?? 0) + (mCur?.upcoming ?? 0),
    (mPrev?.settled ?? 0) + (mPrev?.upcoming ?? 0)
  );
  const adsMoM = growth(mCur?.ads ?? 0, mPrev?.ads ?? 0);

  // ── overall KPIs ──
  const deliveredCount = orders.filter((o) => isDelivered(o.status)).length;
  const returnedCount = orders.filter((o) => isReturned(o.status)).length;
  const decidedCount = deliveredCount + returnedCount;
  const returnRatePct = decidedCount > 0 ? (returnedCount / decidedCount) * 100 : 0;

  const totalSettled = payments.reduce((s, p) => s + p.settlementAmount, 0);
  const totalAds = ads.reduce((s, a) => s + a.totalAdsCost, 0);
  const adsPctOfSettled = totalSettled > 0 ? (totalAds / totalSettled) * 100 : 0;

  const deliveredSettled = orders
    .filter((o) => isDelivered(o.status))
    .reduce((s, o) => s + o.settled, 0);
  const avgSettlementPerDelivered = deliveredCount > 0 ? deliveredSettled / deliveredCount : 0;

  const orderDays = dailyOrders.size;
  const avgDailyOrders = orderDays > 0 ? orders.length / orderDays : 0;
  let bestDay: { date: string; orders: number } | null = null;
  for (const [date, n] of dailyOrders) {
    if (!bestDay || n > bestDay.orders) bestDay = { date, orders: n };
  }

  // ── SKU stats ──
  const skuMap = new Map<string, SkuStat>();
  for (const o of orders) {
    const key = o.sku || "(no sku)";
    let s = skuMap.get(key);
    if (!s) {
      s = { sku: key, productName: o.productName, orders: 0, delivered: 0, returned: 0, settled: 0, returnRatePct: 0 };
      skuMap.set(key, s);
    }
    s.orders += 1;
    if (isDelivered(o.status)) s.delivered += 1;
    else if (isReturned(o.status)) s.returned += 1;
    s.settled += o.settled;
    if (!s.productName && o.productName) s.productName = o.productName;
  }
  const skus = Array.from(skuMap.values());
  for (const s of skus) {
    const decided = s.delivered + s.returned;
    s.returnRatePct = decided > 0 ? (s.returned / decided) * 100 : 0;
  }
  const topSkus = [...skus].sort((a, b) => b.orders - a.orders).slice(0, 5);
  const worstSkus = skus
    .filter((s) => s.orders >= 3)
    .sort((a, b) => b.returnRatePct - a.returnRatePct)
    .slice(0, 5);

  // ── daily series for charts (union of all dates, oldest → newest) ──
  const allDates = new Set<string>([...dailyOrders.keys(), ...dailySettled.keys(), ...dailyAds.keys()]);
  const daily = Array.from(allDates)
    .sort()
    .map((date) => ({
      date,
      orders: dailyOrders.get(date) || 0,
      settled: dailySettled.get(date) || 0,
      ads: dailyAds.get(date) || 0,
    }));

  return {
    weekly,
    monthly,
    ordersWoW,
    paymentWoW,
    ordersMoM,
    paymentMoM,
    adsMoM,
    returnRatePct,
    adsPctOfSettled,
    avgSettlementPerDelivered,
    avgDailyOrders,
    bestDay,
    topSkus,
    worstSkus,
    daily,
  };
}

// Compact JSON summary sent to the AI insights API (keep it small & anonymous)
export function analyticsToAISummary(a: Analytics): object {
  return {
    weekly: a.weekly.slice(-6).map((w) => ({
      week: w.label,
      orders: w.orders,
      delivered: w.delivered,
      returned: w.returned,
      paymentReceived: Math.round(w.settled),
      paymentUpcoming: Math.round(w.upcoming),
      adsSpend: Math.round(w.ads),
      net: Math.round(w.net),
    })),
    monthly: a.monthly.map((m) => ({
      month: m.label,
      orders: m.orders,
      delivered: m.delivered,
      returned: m.returned,
      paymentReceived: Math.round(m.settled),
      paymentUpcoming: Math.round(m.upcoming),
      adsSpend: Math.round(m.ads),
      net: Math.round(m.net),
    })),
    kpis: {
      returnRatePct: Math.round(a.returnRatePct * 10) / 10,
      adsPctOfPayments: Math.round(a.adsPctOfSettled * 10) / 10,
      avgSettlementPerDeliveredOrder: Math.round(a.avgSettlementPerDelivered),
      avgDailyOrders: Math.round(a.avgDailyOrders * 10) / 10,
      bestDay: a.bestDay,
    },
    topSkusByOrders: a.topSkus.map((s) => ({
      sku: s.sku,
      orders: s.orders,
      returnRatePct: Math.round(s.returnRatePct),
      settled: Math.round(s.settled),
    })),
    highestReturnRateSkus: a.worstSkus.map((s) => ({
      sku: s.sku,
      orders: s.orders,
      returnRatePct: Math.round(s.returnRatePct),
    })),
  };
}
