// One-off import of wholesale bills into Supabase.
// Run: node --env-file=.env.local scripts/import-wholesale.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase env. Use: node --env-file=.env.local scripts/import-wholesale.mjs");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Source: KiddieKa-Account-Management - Wholesale Account.csv
// billDate normalised to YYYY-MM-DD (the app's date format).
const bills = [
  { billNo: "WHL/2026-27/0007", billDate: "2026-04-17", shop: "Shree Balaji Collection", billAmount: 12600, received: 12600, mode: "Cash" },
  { billNo: "WHL/2026-27/0009", billDate: "2026-04-16", shop: "K Creation Kids Wear",     billAmount: 12240, received: 12240, mode: "UPI"  },
  { billNo: "WHL/2026-27/0012", billDate: "2026-04-19", shop: "Good Luck",                billAmount: 2250,  received: 2250,  mode: "UPI"  },
  { billNo: "WHL/2026-27/0020", billDate: "2026-05-15", shop: "Good Luck",                billAmount: 2340,  received: 0,     mode: "UPI"  },
  { billNo: "WHL/2026-27/0008", billDate: "2026-04-17", shop: "Dwarka Kids & Ladies Wear", billAmount: 2500, received: 2500,  mode: "UPI"  },
];

const records = bills.map((b) => ({
  id: b.billNo.replace(/\//g, "-"), // deterministic -> idempotent upsert
  data: {
    id: b.billNo.replace(/\//g, "-"),
    date: b.billDate,
    retailerName: b.shop.trim(),
    phone: "",
    city: "",
    items: [{ productName: `Bill ${b.billNo}`, qty: 1, rate: b.billAmount }],
    paymentReceived: b.received,
    paymentMode: b.mode,
  },
  created_at: `${b.billDate}T00:00:00Z`,
}));

const { error } = await supabase.from("wholesale_sales").upsert(records, { onConflict: "id" });
if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}

// Verify
const { data: rows, error: selErr } = await supabase.from("wholesale_sales").select("data");
if (selErr) {
  console.error("Verify read failed:", selErr.message);
  process.exit(1);
}

let orders = 0, totalBill = 0, collected = 0;
for (const r of rows) {
  const w = r.data;
  orders += 1;
  totalBill += w.items.reduce((a, i) => a + i.qty * i.rate, 0);
  collected += w.paymentReceived;
}

console.log(`Imported. wholesale_sales now has ${orders} order(s).`);
console.log(`Total bill amount: ₹${totalBill.toLocaleString("en-IN")}  (expected ₹31,930)`);
console.log(`Total received:    ₹${collected.toLocaleString("en-IN")}  (expected ₹29,590)`);
console.log(`Total pending:     ₹${(totalBill - collected).toLocaleString("en-IN")}  (expected ₹2,340)`);
