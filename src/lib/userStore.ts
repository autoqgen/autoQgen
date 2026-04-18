import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "users.json");

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "{}");
}

export function getUser(email: string) {
  ensureFile();
  const raw = fs.readFileSync(FILE, "utf8") || "{}";
  let users: Record<string, any> = {};
  try {
    users = JSON.parse(raw);
  } catch (e) {
    users = {};
  }
  return users[email] || null;
}

export function setPassword(email: string, passwordHash: string) {
  ensureFile();
  const raw = fs.readFileSync(FILE, "utf8") || "{}";
  let users: Record<string, any> = {};
  try {
    users = JSON.parse(raw);
  } catch (e) {
    users = {};
  }
  users[email] = users[email] || {};
  users[email].email = email;
  users[email].passwordHash = passwordHash;
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
  return users[email];
}
