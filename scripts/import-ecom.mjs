// One-off import of e-commerce sales into Supabase.
// Run: node --env-file=.env.local scripts/import-ecom.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase env. Use: node --env-file=.env.local scripts/import-ecom.mjs");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Source: "Online Account Management" sheet. Date normalised to YYYY-MM-DD (May = 05).
// [date, platform, amount]
const rows = [
  ["2026-05-04", "Meesho", 708],
  ["2026-05-05", "Meesho", 1195],
  ["2026-05-06", "Meesho", 289],
  ["2026-05-07", "Meesho", 812],
  ["2026-05-08", "Flipkart", 424],
  ["2026-05-08", "Meesho", 599],
  ["2026-05-11", "Meesho", 2548],
  ["2026-05-12", "Meesho", 867],
  ["2026-05-13", "Flipkart", 390],
  ["2026-05-13", "Flipkart", 329],
  ["2026-05-13", "Meesho", 2267],
  ["2026-05-14", "Meesho", 3536],
  ["2026-05-15", "Meesho", 3552],
  ["2026-05-15", "Flipkart", 239],
  ["2026-05-18", "Meesho", 6823],
  ["2026-05-19", "Meesho", 339],
  ["2026-05-20", "Meesho", 2566],
  ["2026-05-20", "Flipkart", 628],
  ["2026-05-20", "Flipkart", 235],
  ["2026-05-21", "Meesho", 2026],
  ["2026-05-22", "Meesho", 568],
  ["2026-05-22", "Flipkart", 208],
  ["2026-05-22", "Flipkart", 372],
  ["2026-05-25", "Meesho", 5848],
  ["2026-05-26", "Meesho", 1250],
  ["2026-05-27", "Meesho", 1085],
  ["2026-05-27", "Flipkart", 718],
  ["2026-05-27", "Flipkart", 982],
  ["2026-05-29", "Meesho", 2683],
];

const records = rows.map(([date, platform, amount], idx) => {
  const id = `ecom-import-${String(idx + 1).padStart(2, "0")}`; // deterministic -> idempotent
  return {
    id,
    data: {
      id,
      date,
      platform,
      orderId: "",
      productName: "",
      sellingPrice: amount,
      commissionPercent: 0,
      adSpend: 0,
      isRTO: false,
      rtoLossAmount: 0,
      netPayout: amount,
    },
    created_at: `${date}T00:00:00Z`,
  };
});

const { error } = await supabase.from("ecom_sales").upsert(records, { onConflict: "id" });
if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}

// Verify
const { data: saved, error: selErr } = await supabase.from("ecom_sales").select("data");
if (selErr) {
  console.error("Verify read failed:", selErr.message);
  process.exit(1);
}

let entries = 0, total = 0;
const byPlatform = {};
for (const r of saved) {
  const s = r.data;
  entries += 1;
  total += s.netPayout;
  byPlatform[s.platform] = (byPlatform[s.platform] || 0) + s.netPayout;
}

console.log(`Imported. ecom_sales now has ${entries} entr(ies).`);
console.log(`Total net payout: ₹${total.toLocaleString("en-IN")}  (expected ₹44,086)`);
for (const [p, v] of Object.entries(byPlatform)) {
  console.log(`  ${p}: ₹${v.toLocaleString("en-IN")}`);
}
