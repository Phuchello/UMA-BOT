import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSqliteBackup } from './backup.js';
import { safeBackupDirectory, syncFile, syncDirectory } from './scheduledBackup.js';

function regularFile(file: string): void {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Expected a regular file, not a symlink.');
}
function entryExists(file: string): boolean {
  try { fs.lstatSync(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
// The shell wrapper must confirm the bot is stopped and hold the operations lock.
export function restoreSqliteBackup(backup: string, database: string, backups: string): string {
  const source = path.resolve(backup); const target = path.resolve(database);
  const directory = safeBackupDirectory(backups);
  if (path.dirname(source) !== directory || source === target) throw new Error('Choose a backup directly inside the backup directory.');
  regularFile(source);
  if (entryExists(source + '-wal') || entryExists(source + '-shm') || entryExists(source + '-journal')) throw new Error('Backup must be a standalone snapshot.');
  if (fs.realpathSync(path.dirname(target)) !== path.dirname(target)) throw new Error('Database parent must not contain symlinks.');
  const originals = [target, target + '-wal', target + '-shm', target + '-journal'].filter(entryExists);
  if (!originals.includes(target)) throw new Error('Current database must exist; preserve it before restore.');
  originals.forEach(regularFile);
  const id = crypto.randomUUID(); const staged = path.join(path.dirname(target), `.restore-${id}.sqlite`);
  createSqliteBackup(source, staged); // quick_check source and restored copy
  fs.chmodSync(staged, 0o600); syncFile(staged);
  const emergency = path.join(directory, `pre-restore-${id}`);
  fs.mkdirSync(emergency, { mode: 0o700 });
  for (const original of originals) {
    const copy = path.join(emergency, path.basename(original));
    fs.copyFileSync(original, copy, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(copy, 0o600); syncFile(copy);
  }
  syncDirectory(emergency); syncDirectory(directory);
  try {
    for (const sidecar of originals.filter(file => file !== target)) fs.unlinkSync(sidecar);
    fs.renameSync(staged, target); // same filesystem atomic placement
  } catch (error) {
    for (const original of originals.filter(file => file !== target)) {
      if (!fs.existsSync(original)) fs.copyFileSync(path.join(emergency, path.basename(original)), original, fs.constants.COPYFILE_EXCL);
    }
    throw error;
  }
  syncDirectory(path.dirname(target));
  return emergency;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.umask(0o077);
    if (process.argv.length !== 3 || process.env.DATABASE_PATH !== '/var/lib/uma-bot/tournament.sqlite') throw new Error('Expected explicit backup and database layout.');
    const emergency = restoreSqliteBackup(process.argv[2], process.env.DATABASE_PATH, '/var/lib/uma-bot/backups');
    console.log(`Restore verified. Emergency originals: ${emergency}. Bot remains stopped; review /uma doctor after authorized start.`);
  } catch { console.error('Restore failed. Bot must remain stopped; preserve originals and inspect integrity/paths/disk space.'); process.exitCode = 1; }
}
