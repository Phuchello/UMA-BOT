import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';

dotenv.config();
export function createSqliteBackup(sourcePath: string, destinationPath: string): string {
  const source = path.resolve(sourcePath);
  const destination = path.resolve(destinationPath);
  if (source === destination || !fs.existsSync(source) || !fs.statSync(source).isFile())
    throw new Error('Source SQLite database is missing or destination equals source.');
  if (fs.existsSync(destination)) throw new Error('Backup destination already exists.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    const check = db.prepare('PRAGMA quick_check').get() as { quick_check: string };
    if (check.quick_check !== 'ok') throw new Error('Source SQLite integrity check failed.');
    db.prepare('VACUUM INTO ?').run(destination);
  } finally { db.close(); }
  const backup = new DatabaseSync(destination, { readOnly: true });
  try {
    const check = backup.prepare('PRAGMA quick_check').get() as { quick_check: string };
    if (check.quick_check !== 'ok') throw new Error('Backup SQLite integrity check failed.');
  } finally { backup.close(); }
  return destination;
}
function main(): void {
  const source = process.env.DATABASE_PATH ?? 'data/tournament.sqlite';
  const target = process.argv[2] ?? path.join('data','backups',
    `uma-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID()}.sqlite`);
  console.log(`SQLite backup created: ${createSqliteBackup(source, target)}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : 'Backup failed'); process.exitCode = 1; }
}
