// Usage: node scripts/hash-password.mjs "the-password"
// Prints a value for AUTH_HASH_<USERNAME> in .env.local (format matches lib/auth/crypto.ts).
import { webcrypto as crypto } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error("Provide a password of at least 10 characters.");
  process.exit(1);
}
const b64url = (b) => Buffer.from(b).toString("base64url");
const iterations = 210000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
console.log(`pbkdf2.${iterations}.${b64url(salt)}.${b64url(new Uint8Array(bits))}`);
