const { createClient } = require("@supabase/supabase-js");

const url = "https://hmtosqmrgriavkurkqde.supabase.co";
const key = "sb_publishable_SLjl85M4Yw6moNmcVnmdLw_4i5Awvaj";

const supabase = createClient(url, key);

async function checkSync() {
  console.log("Connecting to Supabase...");
  
  // 1. Check if meesho_orders table exists and fetch rows count
  const { data, error, count } = await supabase
    .from("meesho_orders")
    .select("id, data", { count: "exact" });

  if (error) {
    console.error("❌ Supabase connection failed or table does not exist:");
    console.error(error.message);
    console.log("\n👉 Action required: Please make sure you ran the SQL editor query to create the 'meesho_orders' table.");
  } else {
    console.log("✅ Supabase connection successful!");
    console.log(`✅ Table 'meesho_orders' exists!`);
    console.log(`📊 Number of records stored in database: ${count}`);
    
    if (count > 0) {
      console.log("\nSample record loaded from Supabase:");
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log("\n⚠️ No records found in Supabase yet. Please upload a file or add a manual order at http://localhost:3000/meesho first, then re-run this check!");
    }
  }
}

checkSync();
