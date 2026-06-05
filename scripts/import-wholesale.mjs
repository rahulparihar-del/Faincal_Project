// One-off import / migration of wholesale bills into Supabase (bill-based model).
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
// Dates normalised to YYYY-MM-DD.
const bills = [
  { billNo: "WHL/2026-27/0007", billDate: "2026-04-17", shop: "Shree Balaji Collection",   billAmount: 12600, recdDate: "2026-04-21", received: 12600, mode: "Cash" },
  { billNo: "WHL/2026-27/0009", billDate: "2026-04-16", shop: "K Creation Kids Wear",       billAmount: 12240, recdDate: "2026-04-23", received: 12240, mode: "UPI"  },
  { billNo: "WHL/2026-27/0012", billDate: "2026-04-19", shop: "Good Luck",                  billAmount: 2250,  recdDate: "2026-05-13", received: 2250,  mode: "UPI"  },
  { billNo: "WHL/2026-27/0020", billDate: "2026-05-15", shop: "Good Luck",                  billAmount: 2340,  recdDate: "",           received: 0,     mode: "UPI"  },
  { billNo: "WHL/2026-27/0008", billDate: "2026-04-17", shop: "Dwarka Kids & Ladies Wear",  billAmount: 2500,  recdDate: "2026-05-13", received: 2500,  mode: "UPI"  },
];

const records = bills.map((b) => {
  const id = b.billNo.replace(/\//g, "-"); // deterministic -> idempotent upsert
  return {
    id,
    data: {
      id,
      date: b.billDate,
      billNo: b.billNo,
      retailerName: b.shop.trim(),
      phone: "",
      city: "",
      billAmount: b.billAmount,
      receivedDate: b.recdDate,
      paymentReceived: b.received,
      paymentMode: b.mode,
    },
    created_at: `${b.billDate}T00:00:00Z`,
  };
});

const { error } = await supabase.from("wholesale_sales").upsert(records, { onConflict: "id" });
if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}

const { data: rows, error: selErr } = await supabase.from("wholesale_sales").select("data");
if (selErr) {
  console.error("Verify read failed:", selErr.message);
  process.exit(1);
}

let orders = 0, totalBill = 0, collected = 0;
for (const r of rows) {
  const w = r.data;
  orders += 1;
  totalBill += typeof w.billAmount === "number" ? w.billAmount : (w.items ?? []).reduce((a, i) => a + i.qty * i.rate, 0);
  collected += w.paymentReceived;
}

console.log(`Migrated. wholesale_sales now has ${orders} order(s).`);
console.log(`Total bill amount: ₹${totalBill.toLocaleString("en-IN")}  (expected ₹31,930)`);
console.log(`Total received:    ₹${collected.toLocaleString("en-IN")}  (expected ₹29,590)`);
console.log(`Total pending:     ₹${(totalBill - collected).toLocaleString("en-IN")}  (expected ₹2,340)`);
