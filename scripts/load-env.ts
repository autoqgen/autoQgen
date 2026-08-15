import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader for standalone scripts.
 *
 * Next.js loads .env files itself at runtime; `tsx scripts/*.ts` does not. This
 * avoids adding a dependency just to read a file. Existing process.env values
 * always win, so CI can override anything.
 */
const FILES = [".env.local", ".env"];

export function loadEnvFiles(cwd = process.cwd()): void {
  for (const file of FILES) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;

    const contents = fs.readFileSync(fullPath, "utf8");

    for (const rawLine of contents.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separator = line.indexOf("=");
      if (separator === -1) continue;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
