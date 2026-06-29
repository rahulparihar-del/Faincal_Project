import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(url, key);

const tables = [
  "meesho_returns_in_transit",
  "meesho_returns_out_delivery",
  "meesho_returns_delivered",
];

for (const table of tables) {
  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      create table if not exists ${table} (
        id         text        primary key,
        data       jsonb       not null,
        created_at timestamptz default now()
      );
      alter table ${table} disable row level security;
    `
  });

  if (error) {
    // rpc might not exist — try direct SQL via the REST API
    console.log(`RPC failed for ${table}: ${error.message}`);
  } else {
    console.log(`✅ Created ${table}`);
  }
}
