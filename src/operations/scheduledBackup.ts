import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSqliteBackup } from './backup.js';

const backupName = /^uma-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.sqlite$/;
export function safeBackupDirectory(directory: string): string {
  const resolved = path.resolve(directory);
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(resolved) !== resolved)
    throw new Error('Backup directory must be a real directory without symlink components.');
  return resolved;
}
export function syncFile(file: string): void {
  const fd = fs.openSync(file, 'r+');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function syncDirectory(directory: string): void {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(directory, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function scheduledBackup(source: string, directory: string): string {
  const resolvedSource = path.resolve(source);
  const sourceStat = fs.lstatSync(resolvedSource);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || fs.realpathSync(resolvedSource) !== resolvedSource)
    throw new Error('Source must be a regular SQLite file without symlink components.');
  const dir = safeBackupDirectory(directory); const id = crypto.randomUUID();
  const destination = path.join(dir, `uma-${new Date().toISOString().replace(/[:.]/g, '-')}-${id}.sqlite`);
  const pending = path.join(dir, `.pending-${id}.sqlite`);
  createSqliteBackup(resolvedSource, pending);
  fs.chmodSync(pending, 0o600); syncFile(pending);
  fs.linkSync(pending, destination); // atomic, refuses overwrite
  fs.unlinkSync(pending); syncDirectory(dir);
  return destination;
}
export function pruneBackups(directory: string, keep = 14, dryRun = true): string[] {
  if (!Number.isSafeInteger(keep) || keep < 1 || keep > 3650) throw new Error('Invalid retention count.');
  const dir = safeBackupDirectory(directory);
  const files = fs.readdirSync(dir).filter(name => backupName.test(name))
    .filter(name => { const stat = fs.lstatSync(path.join(dir, name)); return stat.isFile() && !stat.isSymbolicLink(); })
    .sort().reverse().slice(keep).map(name => path.join(dir, name));
  if (!dryRun) for (const file of files) fs.unlinkSync(file); // exact child files only
  return files;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.umask(0o077);
    const directory = '/var/lib/uma-bot/backups'; const args = process.argv.slice(2);
    if (args.length === 1 && ['--retention-dry-run', '--prune'].includes(args[0])) {
      const removed = pruneBackups(directory, 14, args[0] !== '--prune');
      console.log(`${args[0]}: ${removed.length} old backups`);
      for (const file of removed) console.log(file);
    } else if (args.length === 0) {
      if (process.env.DATABASE_PATH !== '/var/lib/uma-bot/tournament.sqlite') throw new Error('Unexpected database path.');
      console.log(`Verified backup: ${scheduledBackup(process.env.DATABASE_PATH, directory)}`);
    } else throw new Error('Unknown backup arguments.');
  } catch { console.error('Backup/retention failed; inspect paths, integrity, permissions and disk space.'); process.exitCode = 1; }
}
