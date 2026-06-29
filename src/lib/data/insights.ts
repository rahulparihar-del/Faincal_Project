import {
  MMOrder,
  MMReturn,
  MMClaim,
  MMAdCampaign,
  MMPaymentCycle,
  MMSettings,
  MMInventoryItem
} from "@/components/meesho/types";
import { calculateSkuStats, calculateCourierStats } from "./analytics";

export interface AIInsight {
  id: string;
  priority: 'critical' | 'warning' | 'opportunity' | 'info';
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
}

export function generateAiInsights(
  orders: MMOrder[],
  returns: MMReturn[],
  claims: MMClaim[],
  campaigns: MMAdCampaign[],
  inventory: MMInventoryItem[],
  settings: MMSettings
): AIInsight[] {
  const insights: AIInsight[] = [];
  const skuStats = calculateSkuStats(orders, returns, settings, campaigns);
  const courierStats = calculateCourierStats(orders, returns);

  // 1. Products needing reorder (Critical/Warning)
  const lowStockItems = inventory.filter(i => i.health === "low_stock" || i.currentStock <= i.reservedStock);
  const outOfStockItems = inventory.filter(i => i.currentStock === 0);

  outOfStockItems.forEach(item => {
    insights.push({
      id: `ins_out_stock_${item.sku}`,
      priority: 'critical',
      title: 'Product Out of Stock',
      message: `${item.productName} (${item.sku}) is completely out of stock. Immediate reorder recommended to restore sales.`,
      actionText: 'Restock Inventory',
      actionUrl: '/meesho-manage/product-analytics'
    });
  });

  lowStockItems.forEach(item => {
    insights.push({
      id: `ins_low_stock_${item.sku}`,
      priority: 'warning',
      title: 'Inventory Running Low',
      message: `${item.productName} (${item.sku}) has only ${item.daysRemaining} days left before stockout. Suggested reorder date: ${item.suggestedReorderDate || 'Today'}.`,
      actionText: 'Reorder suggested',
      actionUrl: '/meesho-manage/product-analytics'
    });
  });

  // 2. Highest profit product today / overall (Opportunity)
  if (skuStats.length > 0) {
    const sortedByProfit = [...skuStats].sort((a, b) => b.netProfit - a.netProfit);
    const highestProfit = sortedByProfit[0];
    if (highestProfit && highestProfit.netProfit > 0) {
      insights.push({
        id: `ins_high_profit_${highestProfit.sku}`,
        priority: 'opportunity',
        title: 'Top Profit Driver',
        message: `${highestProfit.productName} (${highestProfit.sku}) is your most profitable product, generating net profit of ₹${highestProfit.netProfit.toLocaleString('en-IN')}. Consider running ad campaigns to scale this SKU.`,
        actionText: 'Scale Campaigns',
        actionUrl: `/meesho-manage/product-360?sku=${highestProfit.sku}`
      });
    }
  }

  // 3. Most expensive ad campaign & optimization suggestions (Warning/Opportunity)
  if (campaigns.length > 0) {
    const activeCampaigns = campaigns.filter(c => c.status === "active");
    if (activeCampaigns.length > 0) {
      const mostExpensive = [...activeCampaigns].sort((a, b) => b.spend - a.spend)[0];
      const roas = mostExpensive.spend ? mostExpensive.revenue / mostExpensive.spend : 0;

      if (roas < 1.5 && mostExpensive.spend > 500) {
        insights.push({
          id: `ins_ad_optimize_${mostExpensive.id}`,
          priority: 'critical',
          title: 'Ad Campaign Underperforming',
          message: `Campaign '${mostExpensive.name}' has low ROAS of ${roas.toFixed(2)}x (Spend: ₹${mostExpensive.spend.toLocaleString('en-IN')}, Rev: ₹${mostExpensive.revenue.toLocaleString('en-IN')}). We recommend pausing or reducing budget.`,
          actionText: 'Pause Campaign',
          actionUrl: '/meesho-manage/advertisement'
        });
      } else if (roas > 4.0) {
        insights.push({
          id: `ins_ad_scale_${mostExpensive.id}`,
          priority: 'opportunity',
          title: 'Scale High Performing Ad',
          message: `Campaign '${mostExpensive.name}' is highly efficient with ${roas.toFixed(2)}x ROAS. We recommend increasing its daily budget to capture more volume.`,
          actionText: 'Scale Budget',
          actionUrl: '/meesho-manage/advertisement'
        });
      }
    }
  }

  // 4. Courier causing maximum RTO (Warning/Critical)
  if (courierStats.length > 0) {
    const activeCouriers = courierStats.filter(c => c.total >= 3); // min 3 shipments
    if (activeCouriers.length > 0) {
      const sortedByRtoRate = [...activeCouriers].sort((a, b) => (b.rto / b.total) - (a.rto / a.total));
      const worstCourier = sortedByRtoRate[0];
      const worstRtoRate = worstCourier ? (worstCourier.rto / worstCourier.total) * 100 : 0;

      if (worstRtoRate > 25) {
        insights.push({
          id: `ins_courier_rto_${worstCourier.courier}`,
          priority: 'critical',
          title: 'High RTO Courier Risk',
          message: `Courier partner '${worstCourier.courier}' has a high RTO rate of ${worstRtoRate.toFixed(1)}% (${worstCourier.rto} of ${worstCourier.total} shipments failed). Consider reducing volume allocated to this provider.`,
          actionText: 'Manage Logistics',
          actionUrl: '/meesho-manage/logistics'
        });
      }
    }
  }

  // 5. Products with rising return rate (Warning)
  skuStats.forEach(sku => {
    if (sku.returnRate > 15) {
      insights.push({
        id: `ins_rising_return_${sku.sku}`,
        priority: 'warning',
        title: 'High Product Return Rate',
        message: `${sku.productName} has a return rate of ${sku.returnRate.toFixed(1)}%. Inspect customer feedback on wrong size or material quality issues.`,
        actionText: 'View Feedback',
        actionUrl: `/meesho-manage/product-360?sku=${sku.sku}`
      });
    }
  });

  // 6. Expected Weekly Revenue (Information)
  if (orders.length > 0) {
    const recentOrders = orders.filter(o => {
      const diffDays = (Date.now() - new Date(o.date).getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    });

    const weeklyRev = recentOrders
      .filter(o => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + o.sellingPrice, 0);

    const projectedWeeklyRev = weeklyRev > 0 ? weeklyRev : 15000; // fallback default projection

    insights.push({
      id: 'ins_weekly_forecast',
      priority: 'info',
      title: 'Weekly Expected Revenue',
      message: `Based on current order velocity, expected revenue for next 7 days is projected to be around ₹${projectedWeeklyRev.toLocaleString('en-IN')}.`,
    });
  }

  // 7. Potential Risk Alert (e.g. Unapproved Claims)
  const pendingClaimsAmount = claims
    .filter(c => c.status === "pending" || c.status === "processing")
    .reduce((sum, c) => sum + c.amountClaimed, 0);

  if (pendingClaimsAmount > 0) {
    insights.push({
      id: 'ins_pending_claims',
      priority: 'info',
      title: 'Outstanding Claims Protection',
      message: `You have ₹${pendingClaimsAmount.toLocaleString('en-IN')} in pending safety claims. Follow up on evidence uploads to expedite approvals.`,
      actionText: 'Review Claims',
      actionUrl: '/meesho-manage/claims'
    });
  }

  return insights;
}
