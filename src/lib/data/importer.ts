import {
  MMOrder,
  MMReturn,
  MMClaim,
  MMAdCampaign,
  MMPaymentCycle,
  MMInventoryItem
} from "@/components/meesho/types";

export interface ParseResult<T> {
  success: T[];
  failedCount: number;
  duplicateCount: number;
}

// Robust CSV helper that handles quotes and commas
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip next char
      }
      row.push(cell.trim());
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
        lines.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    lines.push(row);
  }
  return lines;
}

// Marketplace Importer abstraction interface
export interface MarketplaceImporter {
  parseOrders(csvText: string, existing: MMOrder[], cogsMap: Record<string, number>): ParseResult<MMOrder>;
  parseReturns(csvText: string, existing: MMReturn[], orders: MMOrder[]): ParseResult<MMReturn>;
  parsePayments(csvText: string, existing: MMPaymentCycle[]): ParseResult<MMPaymentCycle>;
  parseAds(csvText: string, existing: MMAdCampaign[]): ParseResult<MMAdCampaign>;
  parseClaims(csvText: string, existing: MMClaim[]): ParseResult<MMClaim>;
  parseInventory(csvText: string, existing: MMInventoryItem[]): ParseResult<MMInventoryItem>;
}

// Importer implementation specifically for Meesho format
export class MeeshoCSVImporter implements MarketplaceImporter {
  parseOrders(csvText: string, existing: MMOrder[], cogsMap: Record<string, number>): ParseResult<MMOrder> {
    const rows = parseCSV(csvText);
    if (rows.length < 2) return { success: [], failedCount: 0, duplicateCount: 0 };

    const headers = rows[0].map(h => h.toLowerCase());
    const dataRows = rows.slice(1);

    const parsed: MMOrder[] = [];
    let failedCount = 0;
    let duplicateCount = 0;

    // Header index mappings
    const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const idxDate = getIndex(['date', 'created', 'time']);
    const idxOrderNo = getIndex(['order_no', 'sub_order_no', 'order no', 'order id', 'orderid', 'suborder']);
    const idxSku = getIndex(['sku', 'product_sku', 'sku code', 'variant']);
    const idxProduct = getIndex(['product_name', 'product name', 'title', 'item']);
    const idxQty = getIndex(['qty', 'quantity', 'quantity_ordered']);
    const idxPrice = getIndex(['selling_price', 'price', 'selling price', 'order amount', 'amount']);
    const idxFee = getIndex(['platform_fee', 'commission', 'meesho fee', 'fee']);
    const idxShipping = getIndex(['shipping_charge', 'shipping cost', 'shipping charge', 'shipping']);
    const idxStatus = getIndex(['status', 'order_status', 'state']);
    const idxCourier = getIndex(['courier', 'courier_partner', 'logistics', 'carrier']);
    const idxCity = getIndex(['city', 'delivery_city', 'destination']);
    const idxState = getIndex(['state', 'delivery_state']);
    const idxPayment = getIndex(['payment_type', 'payment_mode', 'prepaid_cod', 'type']);

    dataRows.forEach((row, rowIndex) => {
      try {
        const orderNo = idxOrderNo !== -1 && row[idxOrderNo] ? row[idxOrderNo] : `ME${Date.now()}${rowIndex}`;
        const date = idxDate !== -1 && row[idxDate] ? row[idxDate] : new Date().toISOString().split("T")[0];
        const sku = idxSku !== -1 && row[idxSku] ? row[idxSku] : "SKU001";

        // Check if duplicate
        if (existing.some(o => o.orderNo === orderNo) || parsed.some(o => o.orderNo === orderNo)) {
          duplicateCount++;
          return;
        }

        const qty = idxQty !== -1 && row[idxQty] ? parseInt(row[idxQty], 10) : 1;
        const sellingPrice = idxPrice !== -1 && row[idxPrice] ? parseFloat(row[idxPrice].replace(/[^\d.]/g, '')) : 299;
        const platformFee = idxFee !== -1 && row[idxFee] ? parseFloat(row[idxFee].replace(/[^\d.]/g, '')) : Math.round(sellingPrice * 0.1);
        const shippingCharge = idxShipping !== -1 && row[idxShipping] ? parseFloat(row[idxShipping].replace(/[^\d.]/g, '')) : 80;

        const cogs = cogsMap[sku] || 110;

        parsed.push({
          id: `o_csv_${Date.now()}_${rowIndex}`,
          date,
          orderNo,
          sku,
          productName: idxProduct !== -1 && row[idxProduct] ? row[idxProduct] : "Fitted Cotton T-Shirt",
          qty,
          sellingPrice,
          costOfGoods: cogs * qty,
          platformFee,
          shippingCharge,
          adSpend: 0,
          status: (idxStatus !== -1 && row[idxStatus] ? row[idxStatus].toLowerCase() : "delivered") as any,
          courier: (idxCourier !== -1 && row[idxCourier] ? row[idxCourier] : "Xpressbees") as any,
          city: idxCity !== -1 && row[idxCity] ? row[idxCity] : "Mumbai",
          state: idxState !== -1 && row[idxState] ? row[idxState] : "Maharashtra",
          paymentType: (idxPayment !== -1 && row[idxPayment] && row[idxPayment].toLowerCase().includes("cod") ? "cod" : "prepaid") as any
        });
      } catch (e) {
        failedCount++;
      }
    });

    return { success: parsed, failedCount, duplicateCount };
  }

  parseReturns(csvText: string, existing: MMReturn[], orders: MMOrder[]): ParseResult<MMReturn> {
    const rows = parseCSV(csvText);
    if (rows.length < 2) return { success: [], failedCount: 0, duplicateCount: 0 };

    const headers = rows[0].map(h => h.toLowerCase());
    const dataRows = rows.slice(1);

    const parsed: MMReturn[] = [];
    let failedCount = 0;
    let duplicateCount = 0;

    const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const idxOrderId = getIndex(['order_id', 'order_no', 'sub_order_no', 'order number', 'orderid']);
    const idxDate = getIndex(['date', 'returned_date', 'return date']);
    const idxReason = getIndex(['reason', 'return_reason', 'comments']);
    const idxCourier = getIndex(['courier', 'carrier', 'logistics']);
    const idxCharge = getIndex(['charge', 'return_shipping', 'cost']);
    const idxIsRto = getIndex(['rto', 'undelivered', 'is_rto']);
    const idxLoss = getIndex(['loss', 'financial_loss', 'product_loss']);

    dataRows.forEach((row, rowIndex) => {
      try {
        const orderId = idxOrderId !== -1 ? row[idxOrderId] : "";
        if (!orderId) {
          failedCount++;
          return;
        }

        // Check if duplicate
        if (existing.some(r => r.orderId === orderId) || parsed.some(r => r.orderId === orderId)) {
          duplicateCount++;
          return;
        }

        // Locate matched order
        const matchedOrder = orders.find(o => o.orderNo === orderId || o.id === orderId);

        const date = idxDate !== -1 && row[idxDate] ? row[idxDate] : new Date().toISOString().split("T")[0];
        const isRTO = idxIsRto !== -1 ? row[idxIsRto].toLowerCase().includes("true") || row[idxIsRto].toLowerCase().includes("rto") : false;
        const returnShippingCharge = idxCharge !== -1 && row[idxCharge] ? parseFloat(row[idxCharge].replace(/[^\d.]/g, '')) : 60;
        const financialLoss = idxLoss !== -1 && row[idxLoss] ? parseFloat(row[idxLoss].replace(/[^\d.]/g, '')) : (isRTO ? 60 : matchedOrder ? matchedOrder.sellingPrice : 299);

        parsed.push({
          id: `r_csv_${Date.now()}_${rowIndex}`,
          orderId,
          date,
          sku: matchedOrder ? matchedOrder.sku : "SKU001",
          productName: matchedOrder ? matchedOrder.productName : "Fitted Cotton T-Shirt",
          reason: (idxReason !== -1 && row[idxReason] ? row[idxReason].toLowerCase() : "size_issue") as any,
          courier: (idxCourier !== -1 && row[idxCourier] ? row[idxCourier] : "Shadowfax") as any,
          returnShippingCharge,
          isRTO,
          rtoAttempts: isRTO ? 2 : 0,
          recoveryStatus: "pending",
          financialLoss,
          city: matchedOrder ? matchedOrder.city : "Unknown"
        });
      } catch (e) {
        failedCount++;
      }
    });

    return { success: parsed, failedCount, duplicateCount };
  }

  parsePayments(csvText: string, existing: MMPaymentCycle[]): ParseResult<MMPaymentCycle> {
    const rows = parseCSV(csvText);
    if (rows.length < 2) return { success: [], failedCount: 0, duplicateCount: 0 };

    const headers = rows[0].map(h => h.toLowerCase());
    const dataRows = rows.slice(1);

    const parsed: MMPaymentCycle[] = [];
    let failedCount = 0;
    let duplicateCount = 0;

    const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const idxDate = getIndex(['cycle_date', 'date', 'settlement_date', 'payout_date']);
    const idxFrom = getIndex(['from', 'start']);
    const idxTo = getIndex(['to', 'end']);
    const idxGross = getIndex(['gross', 'amount', 'payout']);
    const idxFees = getIndex(['fee', 'platform_fee', 'commission']);
    const idxTds = getIndex(['tds', 'tax']);
    const idxShipping = getIndex(['shipping', 'deductions']);
    const idxReturn = getIndex(['return', 'refund']);
    const idxStatus = getIndex(['status', 'state']);
    const idxUtr = getIndex(['utr', 'transaction_id', 'utr_no']);

    dataRows.forEach((row, rowIndex) => {
      try {
        const utr = idxUtr !== -1 && row[idxUtr] ? row[idxUtr] : `UTR${Date.now()}${rowIndex}`;

        if (existing.some(p => p.utr === utr) || parsed.some(p => p.utr === utr)) {
          duplicateCount++;
          return;
        }

        const date = idxDate !== -1 && row[idxDate] ? row[idxDate] : new Date().toISOString().split("T")[0];
        const gross = idxGross !== -1 && row[idxGross] ? parseFloat(row[idxGross].replace(/[^\d.]/g, '')) : 10000;
        const fees = idxFees !== -1 && row[idxFees] ? parseFloat(row[idxFees].replace(/[^\d.]/g, '')) : gross * 0.1;
        const tds = idxTds !== -1 && row[idxTds] ? parseFloat(row[idxTds].replace(/[^\d.]/g, '')) : gross * 0.01;
        const shipping = idxShipping !== -1 && row[idxShipping] ? parseFloat(row[idxShipping].replace(/[^\d.]/g, '')) : 800;
        const refund = idxReturn !== -1 && row[idxReturn] ? parseFloat(row[idxReturn].replace(/[^\d.]/g, '')) : 400;

        const net = gross - fees - tds - shipping - refund;

        parsed.push({
          id: `p_csv_${Date.now()}_${rowIndex}`,
          cycleDate: date,
          fromDate: idxFrom !== -1 && row[idxFrom] ? row[idxFrom] : date,
          toDate: idxTo !== -1 && row[idxTo] ? row[idxTo] : date,
          grossAmount: gross,
          platformFees: fees,
          tds,
          shippingDeductions: shipping,
          returnDeductions: refund,
          netAmount: net,
          status: (idxStatus !== -1 && row[idxStatus] ? row[idxStatus].toLowerCase() : "settled") as any,
          utr
        });
      } catch (e) {
        failedCount++;
      }
    });

    return { success: parsed, failedCount, duplicateCount };
  }

  parseAds(csvText: string, existing: MMAdCampaign[]): ParseResult<MMAdCampaign> {
    const rows = parseCSV(csvText);
    if (rows.length < 2) return { success: [], failedCount: 0, duplicateCount: 0 };

    const headers = rows[0].map(h => h.toLowerCase());
    const dataRows = rows.slice(1);

    const parsed: MMAdCampaign[] = [];
    let failedCount = 0;
    let duplicateCount = 0;

    const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const idxName = getIndex(['campaign_name', 'name', 'campaign']);
    const idxStart = getIndex(['start_date', 'start', 'date']);
    const idxEnd = getIndex(['end_date', 'end']);
    const idxStatus = getIndex(['status', 'state']);
    const idxBudget = getIndex(['budget', 'daily_budget']);
    const idxSpend = getIndex(['spend', 'cost', 'actual_spend']);
    const idxImpressions = getIndex(['impressions', 'views']);
    const idxClicks = getIndex(['clicks', 'traffic']);
    const idxOrders = getIndex(['orders', 'conversions']);
    const idxRevenue = getIndex(['revenue', 'sales', 'value']);
    const idxSku = getIndex(['sku', 'product_sku']);

    dataRows.forEach((row, rowIndex) => {
      try {
        const name = idxName !== -1 && row[idxName] ? row[idxName] : `Campaign ${rowIndex + 1}`;

        if (existing.some(c => c.name === name) || parsed.some(c => c.name === name)) {
          duplicateCount++;
          return;
        }

        const spend = idxSpend !== -1 && row[idxSpend] ? parseFloat(row[idxSpend].replace(/[^\d.]/g, '')) : 1000;
        const budget = idxBudget !== -1 && row[idxBudget] ? parseFloat(row[idxBudget].replace(/[^\d.]/g, '')) : spend * 1.5;
        const rev = idxRevenue !== -1 && row[idxRevenue] ? parseFloat(row[idxRevenue].replace(/[^\d.]/g, '')) : spend * 3;

        parsed.push({
          id: `ad_csv_${Date.now()}_${rowIndex}`,
          name,
          startDate: idxStart !== -1 && row[idxStart] ? row[idxStart] : new Date().toISOString().split("T")[0],
          endDate: idxEnd !== -1 && row[idxEnd] ? row[idxEnd] : new Date().toISOString().split("T")[0],
          status: (idxStatus !== -1 && row[idxStatus] ? row[idxStatus].toLowerCase() : "active") as any,
          budget,
          spend,
          impressions: idxImpressions !== -1 && row[idxImpressions] ? parseInt(row[idxImpressions], 10) : 10000,
          clicks: idxClicks !== -1 && row[idxClicks] ? parseInt(row[idxClicks], 10) : 500,
          orders: idxOrders !== -1 && row[idxOrders] ? parseInt(row[idxOrders], 10) : 20,
          revenue: rev,
          sku: idxSku !== -1 && row[idxSku] ? row[idxSku] : "SKU001"
        });
      } catch (e) {
        failedCount++;
      }
    });

    return { success: parsed, failedCount, duplicateCount };
  }

  parseClaims(csvText: string, existing: MMClaim[]): ParseResult<MMClaim> {
    const rows = parseCSV(csvText);
    if (rows.length < 2) return { success: [], failedCount: 0, duplicateCount: 0 };

    const headers = rows[0].map(h => h.toLowerCase());
    const dataRows = rows.slice(1);

    const parsed: MMClaim[] = [];
    let failedCount = 0;
    let duplicateCount = 0;

    const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const idxOrderId = getIndex(['order_id', 'order_no', 'sub_order_no', 'orderid']);
    const idxDate = getIndex(['date', 'filed_date', 'claim_date']);
    const idxType = getIndex(['type', 'claim_type', 'reason']);
    const idxClaimed = getIndex(['claimed', 'amount', 'amount_claimed']);
    const idxApproved = getIndex(['approved', 'approved_amount', 'amount_approved']);
    const idxStatus = getIndex(['status', 'state']);
    const idxNotes = getIndex(['notes', 'comments', 'description']);

    dataRows.forEach((row, rowIndex) => {
      try {
        const orderId = idxOrderId !== -1 ? row[idxOrderId] : "";
        if (!orderId) {
          failedCount++;
          return;
        }

        if (existing.some(c => c.orderId === orderId) || parsed.some(c => c.orderId === orderId)) {
          duplicateCount++;
          return;
        }

        const claimed = idxClaimed !== -1 && row[idxClaimed] ? parseFloat(row[idxClaimed].replace(/[^\d.]/g, '')) : 350;

        parsed.push({
          id: `c_csv_${Date.now()}_${rowIndex}`,
          orderId,
          date: idxDate !== -1 && row[idxDate] ? row[idxDate] : new Date().toISOString().split("T")[0],
          claimType: (idxType !== -1 && row[idxType] ? row[idxType].toLowerCase() : "rto_recovery") as any,
          amountClaimed: claimed,
          amountApproved: idxApproved !== -1 && row[idxApproved] ? parseFloat(row[idxApproved].replace(/[^\d.]/g, '')) : 0,
          status: (idxStatus !== -1 && row[idxStatus] ? row[idxStatus].toLowerCase() : "pending") as any,
          notes: idxNotes !== -1 && row[idxNotes] ? row[idxNotes] : ""
        });
      } catch (e) {
        failedCount++;
      }
    });

    return { success: parsed, failedCount, duplicateCount };
  }

  parseInventory(csvText: string, existing: MMInventoryItem[]): ParseResult<MMInventoryItem> {
    const rows = parseCSV(csvText);
    if (rows.length < 2) return { success: [], failedCount: 0, duplicateCount: 0 };

    const headers = rows[0].map(h => h.toLowerCase());
    const dataRows = rows.slice(1);

    const parsed: MMInventoryItem[] = [];
    let failedCount = 0;
    let duplicateCount = 0;

    const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const idxSku = getIndex(['sku', 'sku_code', 'code']);
    const idxProduct = getIndex(['product_name', 'product', 'title', 'name']);
    const idxStock = getIndex(['stock', 'current_stock', 'quantity', 'qty']);
    const idxReserved = getIndex(['reserved', 'reserved_stock']);
    const idxSales = getIndex(['sales', 'daily_sales', 'average_sales']);

    dataRows.forEach((row, rowIndex) => {
      try {
        const sku = idxSku !== -1 && row[idxSku] ? row[idxSku] : `SKU${rowIndex + 100}`;

        const stock = idxStock !== -1 && row[idxStock] ? parseInt(row[idxStock], 10) : 100;
        const reserved = idxReserved !== -1 && row[idxReserved] ? parseInt(row[idxReserved], 10) : 10;
        const sales = idxSales !== -1 && row[idxSales] ? parseFloat(row[idxSales]) : 2.5;

        const available = Math.max(0, stock - reserved);
        const days = sales > 0 ? available / sales : 999;

        const health = available <= 0 ? "out_of_stock" : days < 7 ? "low_stock" : "healthy";

        parsed.push({
          sku,
          productName: idxProduct !== -1 && row[idxProduct] ? row[idxProduct] : `SKU Product ${sku}`,
          currentStock: stock,
          reservedStock: reserved,
          availableStock: available,
          avgDailySales: sales,
          daysRemaining: Number(days.toFixed(1)),
          health
        });
      } catch (e) {
        failedCount++;
      }
    });

    return { success: parsed, failedCount, duplicateCount };
  }
}
