---
name: meesho_xlsx_extractor
description: Procedures for extracting and parsing Meesho SP_ORDER_ADS_REFERRAL_PAYMENT XLSX settlement sheet structures, generating summaries, and preserving raw values.
---

# Meesho "SP_ORDER_ADS_REFERRAL_PAYMENT" XLSX File Extraction

Trigger this procedure whenever a file is uploaded matching this pattern:
`<SellerID>_SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_<TYPE>_<StartDate>_<EndDate>.xlsx`

Example: `4114237_SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_PREVIOUS_PAYMENT_2026-05-01_2026-05-31.xlsx`

## Information to Extract from Filename
- **Seller/Store ID**: First numerical block.
- **Statement Type**: E.g., `PREVIOUS_PAYMENT`, `CURRENT_PAYMENT`.
- **Statement Period**: Start date and end date from the last two date blocks.

## Parsing Rules (Golden Rule)
- **No Summarizing or Rounding**: Preserve raw data values, signs, and suffixes.
- Extract every row and column exactly as it appears.

## Workbook Sheet Structure
1. **Disclaimer**: One sentence to capture verbatim.
2. **Order Payments**: Line-item level order settlement data (Row 1: group header [skip], Row 2: column headers [43 columns], Row 3: formula legend [skip], Row 4+: data).
   - *Duplicate Column Names*: Disambiguate duplicate columns (like `Fixed Fee (Incl. GST)` and `Warehousing fee (Incl. GST)`) by column index position.
3. **Ads Cost**: Row 1: title, Row 2: headers, Row 3: legend [skip], Row 4+: data. All values are negative cost deductions.
4. **Referral Payments**: Referral reward IDs and details. Explicitly report if sheet reads "No data is available...".
5. **Compensation and Recovery**: Platform compensations. Explicitly report if sheet reads "No data is available...".

## Required Output Summary Block
- Statement period and actual date range.
- Total row count per sheet.
- Order status breakdown (Delivered, Return, RTO, Shipped, Cancelled, Exchange).
- Totals (Sale Amount, Settlement Payout, Ads Cost).
- "Ad order" vs organic order counts and values.
- Top products by order volume and payout.
- Validation warning if row count/sums mismatch.
