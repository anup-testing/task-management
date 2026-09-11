/**
 * Consistent snapshot of the database, safe to run while the server is up.
 *   npm run backup            -> ./backups/tcc-YYYY-MM-DD-HHmm.db
 * Keeps the 30 most recent. Put it in cron:  0 2 * * * cd /srv/tcc && npm run backup
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../src/db.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.BACKUP_DIR || path.join(HERE, "..", "backups");
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const target = path.join(dir, `tcc-${stamp}.db`);
await db.backup(target);                       // online backup API — no locking

const keep = 30;
const old = fs.readdirSync(dir).filter(f => f.startsWith("tcc-") && f.endsWith(".db")).sort().slice(0, -keep);
old.forEach(f => fs.unlinkSync(path.join(dir, f)));

console.log(`Backed up to ${target}${old.length ? ` (removed ${old.length} old snapshot${old.length === 1 ? "" : "s"})` : ""}`);
