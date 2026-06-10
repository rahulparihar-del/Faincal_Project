/**
 * Vault encryption helpers (Web Crypto / SubtleCrypto).
 *
 * Vault contents are encrypted in the browser with AES-GCM using a key derived
 * from the user's PIN via PBKDF2. Supabase only ever stores ciphertext, so a
 * leaked DB row or sniffed network response reveals nothing readable without
 * the PIN. The PIN itself is never stored — only a small "verifier" blob that
 * can be decrypted to confirm a correct PIN.
 *
 * NOTE: a short numeric PIN has limited entropy (a 4-digit PIN is only 10,000
 * possibilities). The high PBKDF2 iteration count slows brute-forcing, but for
 * strong protection prefer a longer passphrase.
 */

const ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ── base64 <-> bytes ── */
export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

/* ── key derivation ── */
export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/* ── encrypt / decrypt JSON ── */
export async function encryptJSON(key: CryptoKey, obj: unknown): Promise<string> {
  const iv = randomBytes(12);
  const data = encoder.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource
  );
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return bytesToB64(combined);
}

export async function decryptJSON<T>(key: CryptoKey, blob: string): Promise<T> {
  const combined = b64ToBytes(blob);
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource
  );
  return JSON.parse(decoder.decode(data)) as T;
}
