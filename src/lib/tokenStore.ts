import fs from "fs";
import path from "path";
import crypto from "crypto";

const FILE = path.join(process.cwd(), "data", "passwordReset.json");

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");
}

export function createTokenForEmail(email: string) {
  ensureFile();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = Date.now() + 1000 * 60 * 60; // 1 hour
  const raw = fs.readFileSync(FILE, "utf8") || "[]";
  let tokens: any[] = [];
  try {
    tokens = JSON.parse(raw);
  } catch (e) {
    tokens = [];
  }

  tokens = tokens.filter((t) => t.expires > Date.now() && t.email !== email);
  tokens.push({ email, tokenHash, expires });
  fs.writeFileSync(FILE, JSON.stringify(tokens, null, 2));
  return token;
}

export function consumeToken(email: string, token: string) {
  ensureFile();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const raw = fs.readFileSync(FILE, "utf8") || "[]";
  let tokens: any[] = [];
  try {
    tokens = JSON.parse(raw);
  } catch (e) {
    tokens = [];
  }

  const idx = tokens.findIndex((t) => t.email === email && t.tokenHash === tokenHash && t.expires > Date.now());
  if (idx === -1) return false;
  tokens.splice(idx, 1);
  fs.writeFileSync(FILE, JSON.stringify(tokens, null, 2));
  return true;
}
