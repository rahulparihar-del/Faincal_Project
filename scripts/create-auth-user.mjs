// Creates (or verifies) the Supabase Auth user for the dashboard.
// Run: node --env-file=.env.local scripts/create-auth-user.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EMAIL = "kiddieka.store@gmail.com";
const PASSWORD = "Rahul@2001";

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Try to sign up the user.
const { data, error } = await supabase.auth.signUp({ email: EMAIL, password: PASSWORD });
if (error) {
  if (/already registered|already exists/i.test(error.message)) {
    console.log("User already exists — good.");
  } else {
    console.log("signUp error:", error.message);
  }
} else {
  const confirmed = data.user?.confirmed_at || data.user?.email_confirmed_at;
  console.log("User created:", data.user?.email);
  console.log(confirmed ? "Email auto-confirmed — ready to log in." : "User created but NOT confirmed (email confirmation is ON).");
}

// Verify login works right now.
const { error: signInErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signInErr) {
  console.log("\nLOGIN TEST: FAILED -", signInErr.message);
  if (/not confirmed/i.test(signInErr.message)) {
    console.log("→ Disable 'Confirm email' in Supabase (Authentication → Sign In / Providers → Email),");
    console.log("  or create the user from the dashboard with 'Auto Confirm User' checked.");
  }
} else {
  console.log("\nLOGIN TEST: SUCCESS ✅  — you can sign in with these credentials.");
}
