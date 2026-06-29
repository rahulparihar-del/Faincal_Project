import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / key in env. Use: node --env-file=.env.local scripts/check-meesho-returns.mjs");
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkTable() {
  console.log("🔍 Checking Supabase connection to:", url);
  
  // 1. Try to query the table directly
  const { data, error, count } = await supabase
    .from("meesho_returns")
    .select("id", { count: "exact", head: true });

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist") || error.message?.includes("relation")) {
      console.log("❌ Table 'meesho_returns' does NOT exist in your Supabase database.");
      console.log("");
      console.log("▶ Run this SQL in Supabase Dashboard → SQL Editor:");
      console.log(`
create table if not exists meesho_returns (
  id         text        primary key,
  data       jsonb       not null,
  created_at timestamptz default now()
);

alter table meesho_returns disable row level security;
      `);
    } else {
      console.error("⚠ Error querying table:", error.message, "(code:", error.code + ")");
    }
  } else {
    console.log("✅ Table 'meesho_returns' EXISTS in your Supabase database!");
    console.log(`   Row count: ${count ?? 0}`);
  }
}

checkTable();
