// Connectivity check for Supabase.
// Run with:  node --env-file=.env.local scripts/test-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / key in env. Use: node --env-file=.env.local scripts/test-supabase.mjs");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const tables = [
  "ecom_sales",
  "wholesale_sales",
  "manufacturers",
  "purchases",
  "transactions",
  "personal_finance",
  "finance_config"
];

let allOk = true;
for (const t of tables) {
  const { data, error } = await supabase.from(t).select("id").limit(1);
  if (error) {
    allOk = false;
    console.log(`FAIL  ${t}: ${error.message} (${error.code ?? "n/a"})`);
  } else {
    console.log(`OK    ${t}: reachable (${data?.length ?? 0} sample row(s))`);
  }
}

console.log(allOk ? "\nAll tables reachable. You're set." : "\nSome tables are missing — run supabase/schema.sql in the SQL Editor.");
