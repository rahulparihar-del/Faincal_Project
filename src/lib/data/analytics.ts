import {
  MMOrder,
  MMReturn,
  MMClaim,
  MMAdCampaign,
  MMPaymentCycle,
  MMSettings,
  MetricsResult,
  CourierStats,
  SkuStats,
  MMInventoryItem
} from "@/components/meesho/types";

// Helper to filter items by Date Filter
export function filterByDate<T extends { date?: string; cycleDate?: string; startDate?: string }>(
  items: T[],
  filter: { from: string; to: string }
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

// 1. Centralized metrics calculation
export function calculateMetrics(
  orders: MMOrder[],
  returns: MMReturn[],
  claims: MMClaim[]
): MetricsResult & { cogs: number; returnCharges: number; rtoLoss: number; margin: number; totalDeductions: number } {
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
  const pendingOrders = orders.filter((o) => o.status === "packed" || o.status === "shipped").length;
  const returnsCount = returns.filter((r) => !r.isRTO).length;
  const rtoCount = returns.filter((r) => r.isRTO).length;

  // Financial sums
  const revenue = orders
    .filter((o) => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
    .reduce((sum, o) => sum + o.sellingPrice, 0);

  const platformFees = orders.reduce((sum, o) => sum + o.platformFee, 0);
  const shippingCharges = orders.reduce((sum, o) => sum + o.shippingCharge, 0);
  const adsSpend = orders.reduce((sum, o) => sum + o.adSpend, 0);
  const cogs = orders.reduce((sum, o) => sum + o.costOfGoods, 0);

  const returnCharges = returns
    .filter((r) => !r.isRTO)
    .reduce((sum, r) => sum + r.returnShippingCharge, 0);

  const rtoLoss = returns
    .filter((r) => r.isRTO)
    .reduce((sum, r) => sum + r.financialLoss, 0);

  const claimRecovery = claims
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + c.amountApproved, 0);

  const grossProfit = revenue - cogs;
  const netProfit =
    revenue -
    cogs -
    platformFees -
    shippingCharges -
    adsSpend -
    returnCharges -
    rtoLoss +
    claimRecovery;

  const returnRate = totalOrders ? (returnsCount / totalOrders) * 100 : 0;
  const rtoRate = totalOrders ? (rtoCount / totalOrders) * 100 : 0;
  const roas = adsSpend ? revenue / adsSpend : 0;
  const netReceivable = revenue - platformFees - shippingCharges - returnCharges - rtoLoss + claimRecovery;
  const margin = revenue ? (netProfit / revenue) * 100 : 0;
  const totalDeductions = cogs + platformFees + shippingCharges + adsSpend + returnCharges + rtoLoss;

  return {
    revenue,
    grossProfit,
    netProfit,
    totalOrders,
    deliveredOrders,
    pendingOrders,
    returns: returnsCount,
    rto: rtoCount,
    adsSpend,
    platformFees,
    shippingCharges,
    claimRecovery,
    netReceivable,
    returnRate,
    rtoRate,
    roas,
    cogs,
    returnCharges,
    rtoLoss,
    margin,
    totalDeductions
  };
}

// 2. Centralized Courier Intelligence statistics
export function calculateCourierStats(orders: MMOrder[], returns: MMReturn[]): CourierStats[] {
  const couriers: string[] = Array.from(new Set(orders.map((o) => o.courier).filter(Boolean)));
  if (couriers.length === 0) {
    // Fallback to defaults
    couriers.push("Xpressbees", "Delhivery", "Shadowfax", "Ekart", "Bluedart", "Valmo");
  }

  const list: CourierStats[] = couriers.map((courierName) => {
    const cOrders = orders.filter((o) => o.courier === courierName);
    const cReturns = returns.filter((r) => r.courier === courierName);

    const total = cOrders.length;
    const delivered = cOrders.filter((o) => o.status === "delivered").length;
    const rto = cOrders.filter((o) => o.status === "rto").length;
    const returned = cOrders.filter((o) => o.status === "returned").length;
    const failed = rto + returned;

    const successRate = total ? (delivered / total) * 100 : 0;

    const ordersWithDays = cOrders.filter((o) => o.status === "delivered" && o.deliveryDays);
    const avgDeliveryDays = ordersWithDays.length
      ? ordersWithDays.reduce((sum, o) => sum + (o.deliveryDays || 0), 0) / ordersWithDays.length
      : 0;

    const totalCost = cOrders.reduce((sum, o) => sum + o.shippingCharge, 0);
    const financialLoss = cReturns.reduce((sum, r) => sum + r.financialLoss, 0);

    return {
      courier: courierName as any,
      total,
      delivered,
      failed,
      rto,
      returned,
      successRate,
      avgDeliveryDays,
      totalCost,
      financialLoss,
    };
  });

  return list
    .filter((c) => c.total > 0)
    .sort((a, b) => b.successRate - a.successRate);
}

// 3. Centralized SKU stats calculation
export function calculateSkuStats(
  orders: MMOrder[],
  returns: MMReturn[],
  settings: MMSettings,
  campaigns: MMAdCampaign[]
): SkuStats[] {
  const skus = Array.from(new Set(orders.map((o) => o.sku)));
  return skus.map((sku) => {
    const skuOrders = orders.filter((o) => o.sku === sku);
    const skuReturns = returns.filter((r) => r.sku === sku);
    const skuCampaigns = campaigns.filter((c) => c.sku === sku);

    const revenue = skuOrders
      .filter((o) => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + o.sellingPrice, 0);

    const totalOrders = skuOrders.length;
    const returnCount = skuReturns.filter((r) => !r.isRTO).length;
    const rtoCount = skuReturns.filter((r) => r.isRTO).length;

    const adsCost = skuCampaigns.reduce((sum, c) => sum + c.spend, 0) + skuOrders.reduce((sum, o) => sum + (o.adSpend || 0), 0);
    const shippingCost = skuOrders.reduce((sum, o) => sum + o.shippingCharge, 0);
    const platformFees = skuOrders.reduce((sum, o) => sum + o.platformFee, 0);
    const cogs = skuOrders.reduce((sum, o) => sum + o.costOfGoods, 0);

    const returnCharges = skuReturns.filter((r) => !r.isRTO).reduce((sum, r) => sum + r.returnShippingCharge, 0);
    const rtoLoss = skuReturns.filter((r) => r.isRTO).reduce((sum, r) => sum + r.financialLoss, 0);

    const netProfit = revenue - cogs - platformFees - shippingCost - adsCost - returnCharges - rtoLoss;

    const returnRate = totalOrders ? (returnCount / totalOrders) * 100 : 0;
    const rtoRate = totalOrders ? (rtoCount / totalOrders) * 100 : 0;

    // Calculate Health Score for product (0-100)
    let score = 100;
    if (returnRate > 15) score -= 25;
    else if (returnRate > 7) score -= 12;

    if (rtoRate > 20) score -= 25;
    else if (rtoRate > 10) score -= 12;

    const profitMargin = revenue ? (netProfit / revenue) * 100 : 0;
    if (profitMargin < 5) score -= 25;
    else if (profitMargin < 15) score -= 10;

    const resolvedName = skuOrders[0]?.productName || `SKU ${sku}`;

    return {
      sku,
      productName: resolvedName,
      revenue,
      orders: totalOrders,
      returns: returnCount,
      rto: rtoCount,
      adsCost,
      shippingCost,
      platformFees,
      cogs,
      netProfit,
      returnRate,
      rtoRate,
      healthScore: Math.max(0, score),
    };
  });
}

// 4. Executive Today Dashboard metric calculator
export interface TodayMetrics {
  revenue: number;
  profit: number;
  orders: number;
  delivered: number;
  returns: number;
  rto: number;
  adsSpend: number;
  shipping: number;
  fees: number;
  claims: number;
  settlement: number;
  earnings: number;
}

export function calculateTodayMetrics(
  orders: MMOrder[],
  returns: MMReturn[],
  claims: MMClaim[],
  campaigns: MMAdCampaign[],
  payments: MMPaymentCycle[],
  todayStr: string
): TodayMetrics {
  const dayOrders = orders.filter((o) => o.date === todayStr);
  const dayReturns = returns.filter((r) => r.date === todayStr);
  const dayClaims = claims.filter((c) => c.date === todayStr);
  const dayPayments = payments.filter((p) => p.cycleDate === todayStr);

  const ordersCount = dayOrders.length;
  const deliveredCount = dayOrders.filter((o) => o.status === "delivered").length;
  const returnsCount = dayReturns.filter((r) => !r.isRTO).length;
  const rtoCount = dayReturns.filter((r) => r.isRTO).length;

  const revenue = dayOrders
    .filter((o) => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
    .reduce((sum, o) => sum + o.sellingPrice, 0);

  const fees = dayOrders.reduce((sum, o) => sum + o.platformFee, 0);
  const shipping = dayOrders.reduce((sum, o) => sum + o.shippingCharge, 0);
  const adsSpend = dayOrders.reduce((sum, o) => sum + o.adSpend, 0);
  const cogs = dayOrders.reduce((sum, o) => sum + o.costOfGoods, 0);

  const returnCharges = dayReturns.filter((r) => !r.isRTO).reduce((sum, r) => sum + r.returnShippingCharge, 0);
  const rtoLoss = dayReturns.filter((r) => r.isRTO).reduce((sum, r) => sum + r.financialLoss, 0);
  const claimsRecovery = dayClaims.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.amountApproved, 0);

  const profit = revenue - cogs - fees - shipping - adsSpend - returnCharges - rtoLoss + claimsRecovery;

  // Expected settlement: revenue - fees - shipping - returns + claims (or standard gross - deductions)
  const expectedSettlement = Math.max(0, revenue - fees - shipping - returnCharges - rtoLoss + claimsRecovery);

  // Net earnings: settlement (from actual paid cycles settling today)
  const settlement = dayPayments.filter(p => p.status === "settled").reduce((sum, p) => sum + p.netAmount, 0);
  const earnings = profit; // Net earnings today is the actual net profit generated today

  return {
    revenue,
    profit,
    orders: ordersCount,
    delivered: deliveredCount,
    returns: returnsCount,
    rto: rtoCount,
    adsSpend,
    shipping,
    fees,
    claims: claimsRecovery,
    settlement: expectedSettlement,
    earnings,
  };
}
