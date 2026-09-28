import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { scheduledBackup, pruneBackups } from '../src/operations/scheduledBackup.js';
import { restoreSqliteBackup } from '../src/operations/restore.js';
let dir: string; let backups: string;
beforeEach(() => { dir=fs.mkdtempSync(path.join(os.tmpdir(),'uma-ops-')); backups=path.join(dir,'backups'); fs.mkdirSync(backups); });
afterEach(() => fs.rmSync(dir,{recursive:true,force:true}));
function database(file: string, value: string): DatabaseSync {
  const db=new DatabaseSync(file); db.exec('PRAGMA journal_mode=WAL; CREATE TABLE fixture(value TEXT);');
  db.prepare('INSERT INTO fixture VALUES (?)').run(value); return db;
}
function value(file: string): string {
  const db=new DatabaseSync(file,{readOnly:true});
  try { expect(db.prepare('PRAGMA quick_check').get()).toMatchObject({quick_check:'ok'});
    return (db.prepare('SELECT value FROM fixture').get() as {value:string}).value;
  } finally { db.close(); }
}
describe('production backup and restore safety', () => {
  it('backs up committed WAL data while a writer is open, without changing authoritative content', () => {
    const file=path.join(dir,'live.sqlite'); const db=database(file,'committed-in-wal');
    try {
      const backup=scheduledBackup(file,backups);
      expect(value(backup)).toBe('committed-in-wal');
      expect(db.prepare('SELECT value FROM fixture').get()).toMatchObject({value:'committed-in-wal'});
      expect(fs.readdirSync(backups)).toEqual([path.basename(backup)]);
      const second=scheduledBackup(file,backups); expect(second).not.toBe(backup);
    } finally { db.close(); }
  });
  it('fails on corrupt sources without promoting any completed backup', () => {
    const file=path.join(dir,'bad.sqlite'); fs.writeFileSync(file,'not a database');
    expect(() => scheduledBackup(file,backups)).toThrow();
    expect(fs.readdirSync(backups).filter(name => name.startsWith('uma-'))).toHaveLength(0);
    expect(fs.readFileSync(file,'utf8')).toBe('not a database');
  });
  it('retention defaults to dry run and removes only exact regular snapshot files', () => {
    for(let day=1;day<=16;day++) fs.writeFileSync(path.join(backups,`uma-2026-09-${String(day).padStart(2,'0')}T02-30-00-000Z-00000000-0000-0000-0000-000000000001.sqlite`),'fixture');
    fs.writeFileSync(path.join(backups,'tournament.sqlite'),'preserve');
    fs.writeFileSync(path.join(backups,'.pending-unknown.sqlite'),'preserve');
    fs.mkdirSync(path.join(backups,'pre-restore-forensics'));
    const protectedName='uma-2026-09-01T00-00-00-000Z-00000000-0000-0000-0000-000000000002.sqlite';
    fs.mkdirSync(path.join(backups,protectedName));
    if(process.platform!=='win32') fs.symlinkSync(path.join(backups,'tournament.sqlite'),path.join(backups,protectedName.replace('000000000002','000000000003')));
    const count=fs.readdirSync(backups).length;
    expect(pruneBackups(backups)).toHaveLength(2); expect(fs.readdirSync(backups)).toHaveLength(count);
    expect(pruneBackups(backups,14,false)).toHaveLength(2);
    expect(fs.readdirSync(backups)).toHaveLength(count-2);
    expect(fs.readFileSync(path.join(backups,'tournament.sqlite'),'utf8')).toBe('preserve');
    expect(() => pruneBackups(backups,0,false)).toThrow('retention');
  });
  it('rejects a symlinked backup directory instead of traversing it', () => {
    const alias=path.join(dir,'alias'); fs.symlinkSync(backups,alias,process.platform==='win32'?'junction':'dir');
    expect(() => pruneBackups(alias,1,false)).toThrow('symlink');
  });
  it('restores a verified standalone snapshot and preserves old main/WAL/SHM separately', () => {
    const live=path.join(dir,'tournament.sqlite'); database(live,'original').close();
    const backup=scheduledBackup(live,backups);
    const db=new DatabaseSync(live); db.exec("UPDATE fixture SET value='newer'"); db.close();
    const old=fs.readFileSync(live);
    fs.writeFileSync(live+'-wal','forensic-wal'); fs.writeFileSync(live+'-shm','forensic-shm');
    const emergency=restoreSqliteBackup(backup,live,backups);
    expect(value(live)).toBe('original');
    expect(fs.readFileSync(path.join(emergency,'tournament.sqlite'))).toEqual(old);
    expect(fs.readFileSync(path.join(emergency,'tournament.sqlite-wal'),'utf8')).toBe('forensic-wal');
    expect(fs.readFileSync(path.join(emergency,'tournament.sqlite-shm'),'utf8')).toBe('forensic-shm');
    expect(fs.existsSync(live+'-wal')).toBe(false); expect(fs.existsSync(live+'-shm')).toBe(false);
  });
  it('refuses invalid snapshots before modifying the current database', () => {
    const live=path.join(dir,'tournament.sqlite'); database(live,'original').close(); const original=fs.readFileSync(live);
    const bad=path.join(backups,'bad.sqlite'); fs.writeFileSync(bad,'corrupt');
    expect(() => restoreSqliteBackup(bad,live,backups)).toThrow();
    expect(fs.readFileSync(live)).toEqual(original); expect(value(live)).toBe('original');
  });
  it('refuses outside paths and snapshots with unrelated sidecars', () => {
    const live=path.join(dir,'tournament.sqlite'); database(live,'original').close();
    const backup=scheduledBackup(live,backups); fs.writeFileSync(backup+'-wal','unrelated');
    expect(() => restoreSqliteBackup(backup,live,backups)).toThrow('standalone');
    expect(() => restoreSqliteBackup(live,live,backups)).toThrow('directly');
    expect(value(live)).toBe('original');
  });
  it('can recover a corrupt current database while preserving forensic originals', () => {
    const live=path.join(dir,'tournament.sqlite'); database(live,'known-good').close(); const backup=scheduledBackup(live,backups);
    fs.writeFileSync(live,'damaged-main');
    const emergency=restoreSqliteBackup(backup,live,backups);
    expect(value(live)).toBe('known-good'); expect(fs.readFileSync(path.join(emergency,'tournament.sqlite'),'utf8')).toBe('damaged-main');
  });
});
