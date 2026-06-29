import ExcelJS from "exceljs";
import {
  MMOrder,
  MMReturn,
  MMClaim,
  MMAdCampaign,
  MMPaymentCycle
} from "@/components/meesho/types";

export interface ExcelImportResult {
  sellerId: string;
  statementType: string;
  startDate: string;
  endDate: string;
  disclaimer: string;
  orders: MMOrder[];
  ads: MMAdCampaign[];
  claims: MMClaim[];
  payments: MMPaymentCycle[];
  summary: {
    fileName: string;
    totalOrders: number;
    totalAds: number;
    totalClaims: number;
    totalPayments: number;
    deliveredCount: number;
    rtoCount: number;
    returnCount: number;
    cancelledCount: number;
    shippedCount: number;
    exchangeCount: number;
    totalSaleAmount: number;
    totalSettlementAmount: number;
    totalAdsCost: number;
    adOrderCount: number;
    adOrderValue: number;
    organicOrderCount: number;
    organicOrderValue: number;
    topProductsByCount: { name: string; count: number }[];
    topProductsByValue: { name: string; value: number }[];
  };
}

export async function parseMeeshoExcel(
  fileBuffer: ArrayBuffer,
  fileName: string,
  cogsMap: Record<string, number>
): Promise<ExcelImportResult> {
  const filenameClean = fileName.split('/').pop() || '';
  const parts = filenameClean.replace('.xlsx', '').split('_');
  
  const sellerId = parts[0] || 'Unknown';
  let statementType = 'PAYMENT_FILE';
  const typeIndex = parts.indexOf('FILE') + 1;
  if (typeIndex > 0 && typeIndex < parts.length) {
    if (parts[typeIndex + 1] === 'PAYMENT') {
      statementType = `${parts[typeIndex]}_${parts[typeIndex+1]}`;
    } else {
      statementType = parts[typeIndex];
    }
  }
  
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  const dates = filenameClean.match(datePattern) || [];
  const startDate = dates[0] || new Date().toISOString().split('T')[0];
  const endDate = dates[1] || new Date().toISOString().split('T')[0];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  
  // Sheet 1: Disclaimer
  let disclaimer = "";
  const disclaimerSheet = workbook.worksheets[0];
  if (disclaimerSheet) {
    const firstCell = disclaimerSheet.getCell(1, 1).value;
    disclaimer = firstCell ? String(firstCell).trim() : "";
  }

  // Sheet 2: Order Payments
  const orderSheet = workbook.worksheets[1];
  const orders: MMOrder[] = [];
  
  let deliveredCount = 0;
  let rtoCount = 0;
  let returnCount = 0;
  let cancelledCount = 0;
  let shippedCount = 0;
  let exchangeCount = 0;
  let totalSaleAmount = 0;
  let totalSettlementAmount = 0;
  let adOrderCount = 0;
  let adOrderValue = 0;
  let organicOrderCount = 0;
  let organicOrderValue = 0;
  
  const productCountMap: Record<string, number> = {};
  const productValueMap: Record<string, number> = {};

  if (orderSheet) {
    orderSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Row 4 onwards is actual data
      if (rowNumber >= 4) {
        const getValue = (colIdx: number): any => {
          const val = row.getCell(colIdx).value;
          if (val && typeof val === 'object' && 'result' in val) {
            return val.result;
          }
          return val;
        };

        const getFloat = (colIdx: number): number => {
          const val = getValue(colIdx);
          if (val === null || val === undefined) return 0;
          if (typeof val === 'number') return val;
          const parsed = parseFloat(String(val).replace(/[^\d.-]/g, ''));
          return isNaN(parsed) ? 0 : parsed;
        };

        const getString = (colIdx: number): string => {
          const val = getValue(colIdx);
          return val !== null && val !== undefined ? String(val).trim() : '';
        };

        const getInt = (colIdx: number): number => {
          const val = getValue(colIdx);
          if (typeof val === 'number') return Math.round(val);
          const parsed = parseInt(String(val).replace(/[^\d-]/g, ''), 10);
          return isNaN(parsed) ? 0 : parsed;
        };

        const subOrderNo = getString(1);
        if (!subOrderNo) return;

        const orderDateVal = getValue(2);
        let orderDate = '';
        if (orderDateVal instanceof Date) {
          orderDate = orderDateVal.toISOString().split('T')[0];
        } else {
          orderDate = String(orderDateVal).split(' ')[0] || new Date().toISOString().split('T')[0];
        }

        const prodName = getString(4);
        const sku = getString(5) || 'SKU001';
        const orderSource = getString(7);
        const liveStatus = getString(8).toLowerCase();
        const qty = getInt(11) || 1;
        const settlementAmount = getFloat(14);
        const saleAmount = getFloat(16);
        const platformFee = getFloat(23);
        const shippingCharge = getFloat(30);

        if (liveStatus.includes('delivered')) deliveredCount++;
        else if (liveStatus.includes('rto')) rtoCount++;
        else if (liveStatus.includes('return')) returnCount++;
        else if (liveStatus.includes('cancel')) cancelledCount++;
        else if (liveStatus.includes('ship')) shippedCount++;
        else if (liveStatus.includes('exchange')) exchangeCount++;

        totalSaleAmount += saleAmount;
        totalSettlementAmount += settlementAmount;

        const isAdOrder = orderSource.toLowerCase().includes("ad");
        if (isAdOrder) {
          adOrderCount++;
          adOrderValue += settlementAmount;
        } else {
          organicOrderCount++;
          organicOrderValue += settlementAmount;
        }

        productCountMap[prodName] = (productCountMap[prodName] || 0) + qty;
        productValueMap[prodName] = (productValueMap[prodName] || 0) + settlementAmount;

        orders.push({
          id: `o_xlsx_${sellerId}_${subOrderNo}`,
          date: orderDate,
          orderNo: subOrderNo,
          sku,
          productName: prodName,
          qty,
          sellingPrice: saleAmount > 0 ? saleAmount : (settlementAmount > 0 ? settlementAmount : 299),
          costOfGoods: (cogsMap[sku] || 110) * qty,
          platformFee: Math.abs(platformFee),
          shippingCharge: Math.abs(shippingCharge),
          adSpend: isAdOrder ? 30 : 0,
          status: (liveStatus.includes('return') ? 'returned' : liveStatus.includes('rto') ? 'rto' : liveStatus.includes('cancel') ? 'cancelled' : liveStatus.includes('ship') ? 'shipped' : 'delivered') as any,
          courier: 'Xpressbees',
          city: getString(13) || 'Mumbai',
          state: 'Maharashtra',
          paymentType: 'prepaid'
        });
      }
    });
  }

  // Sheet 3: Ads Cost
  const adsSheet = workbook.worksheets[2];
  const ads: MMAdCampaign[] = [];
  let totalAdsCost = 0;

  if (adsSheet) {
    adsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber >= 4) {
        const getValue = (colIdx: number): any => {
          const val = row.getCell(colIdx).value;
          if (val && typeof val === 'object' && 'result' in val) {
            return val.result;
          }
          return val;
        };
        const getFloat = (colIdx: number): number => {
          const val = getValue(colIdx);
          if (val === null || val === undefined) return 0;
          if (typeof val === 'number') return val;
          const parsed = parseFloat(String(val).replace(/[^\d.-]/g, ''));
          return isNaN(parsed) ? 0 : parsed;
        };

        const getString = (colIdx: number): string => {
          const val = getValue(colIdx);
          return val !== null && val !== undefined ? String(val).trim() : '';
        };

        const campaignId = getString(3);
        if (!campaignId) return;

        const adCost = getFloat(8);
        totalAdsCost += adCost;

        ads.push({
          id: `ad_xlsx_${campaignId}`,
          name: `Campaign ${campaignId}`,
          startDate: startDate,
          endDate: endDate,
          status: 'ended',
          budget: Math.abs(adCost) * 1.5,
          spend: Math.abs(adCost),
          impressions: 10000,
          clicks: 300,
          orders: 5,
          revenue: Math.abs(adCost) * 3,
        });
      }
    });
  }

  // Sheet 4: Referral Payments
  const referralSheet = workbook.worksheets[3];
  const payments: MMPaymentCycle[] = [];
  if (referralSheet) {
    let hasReferrals = true;
    const cellValue = String(referralSheet.getCell(1, 1).value || "");
    if (cellValue.includes("No data")) {
      hasReferrals = false;
    }

    if (hasReferrals) {
      referralSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber >= 4) {
          const getValue = (colIdx: number): any => {
            const val = row.getCell(colIdx).value;
            if (val && typeof val === 'object' && 'result' in val) return val.result;
            return val;
          };
          const getFloat = (colIdx: number): number => {
            const val = getValue(colIdx);
            return typeof val === 'number' ? val : 0;
          };
          const getString = (colIdx: number): string => String(getValue(colIdx) || "").trim();

          const rewardId = getString(1);
          if (!rewardId) return;

          payments.push({
            id: `p_xlsx_ref_${rewardId}`,
            cycleDate: getString(2) || startDate,
            fromDate: startDate,
            toDate: endDate,
            grossAmount: getFloat(5),
            platformFees: 0,
            tds: getFloat(6),
            shippingDeductions: 0,
            returnDeductions: 0,
            netAmount: getFloat(5) - getFloat(6),
            status: 'settled',
            utr: `REF_${rewardId}`
          });
        }
      });
    }
  }

  // Sheet 5: Compensation and Recovery
  const compSheet = workbook.worksheets[4];
  const claims: MMClaim[] = [];
  if (compSheet) {
    let hasComp = true;
    const cellValue = String(compSheet.getCell(1, 1).value || "");
    if (cellValue.includes("No data")) {
      hasComp = false;
    }

    if (hasComp) {
      compSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber >= 4) {
          const getValue = (colIdx: number): any => {
            const val = row.getCell(colIdx).value;
            if (val && typeof val === 'object' && 'result' in val) return val.result;
            return val;
          };
          const getFloat = (colIdx: number): number => {
            const val = getValue(colIdx);
            return typeof val === 'number' ? val : 0;
          };
          const getString = (colIdx: number): string => String(getValue(colIdx) || "").trim();

          const claimDate = getString(1);
          if (!claimDate) return;

          claims.push({
            id: `c_xlsx_comp_${rowNumber}`,
            orderId: getString(2) || `XLSX_${rowNumber}`,
            date: claimDate,
            claimType: 'damaged',
            amountClaimed: getFloat(4),
            amountApproved: getFloat(4),
            status: 'approved',
            notes: `Compensation for: ${getString(3)}`
          });
        }
      });
    }
  }

  const topProductsByCount = Object.entries(productCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topProductsByValue = Object.entries(productValueMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  return {
    sellerId,
    statementType,
    startDate,
    endDate,
    disclaimer,
    orders,
    ads,
    claims,
    payments,
    summary: {
      fileName: filenameClean,
      totalOrders: orders.length,
      totalAds: ads.length,
      totalClaims: claims.length,
      totalPayments: payments.length,
      deliveredCount,
      rtoCount,
      returnCount,
      cancelledCount,
      shippedCount,
      exchangeCount,
      totalSaleAmount,
      totalSettlementAmount,
      totalAdsCost,
      adOrderCount,
      adOrderValue,
      organicOrderCount,
      organicOrderValue,
      topProductsByCount,
      topProductsByValue
    }
  };
}
