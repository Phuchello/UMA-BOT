import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function createDatabase(dbPath: string = ':memory:'): DatabaseSync {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Enable foreign keys and recommended concurrency settings
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  initializeSchema(db);
  return db;
}

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game TEXT NOT NULL DEFAULT 'Liên Quân Mobile',
      status TEXT NOT NULL DEFAULT 'registration_open',
      max_teams INTEGER NOT NULL DEFAULT 16,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      abbreviation TEXT NOT NULL,
      captain_discord_id TEXT NOT NULL,
      captain_contact TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      rejection_reason TEXT,
      btc_review_message_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Non-unique indexes for query performance only.
    -- IMPORTANT: name/abbreviation uniqueness is enforced TRANSACTIONALLY
    -- (inside BEGIN IMMEDIATE TRANSACTION) in TeamRepository, scoped to
    -- ACTIVE statuses (PENDING, APPROVED, NEEDS_CORRECTION) only.
    -- REJECTED / WITHDRAWN rows do NOT occupy uniqueness slots, so the
    -- same name/tag/UID may be re-registered after rejection or withdrawal.
    --
    -- NOTE FOR DEVELOPERS: If you are running a local dev database that was
    -- created before Phase 1.6 you MUST delete data/tournament.sqlite and
    -- let the bot recreate it, because the old UNIQUE indexes cannot be
    -- dropped with IF NOT EXISTS schema guards alone.
    CREATE INDEX IF NOT EXISTS idx_teams_tourney_name
      ON teams(tournament_id, name);

    CREATE INDEX IF NOT EXISTS idx_teams_tourney_abbr
      ON teams(tournament_id, abbreviation);

    CREATE INDEX IF NOT EXISTS idx_teams_tourney_captain
      ON teams(tournament_id, captain_discord_id);

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      discord_id TEXT,
      ingame_name TEXT NOT NULL,
      game_uid TEXT NOT NULL,
      is_substitute INTEGER NOT NULL DEFAULT 0,
      slot_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Non-unique index for UID lookups; uniqueness enforced transactionally
    -- against active teams only (see TeamRepository.registerTeam).
    CREATE INDEX IF NOT EXISTS idx_players_tourney_uid
      ON players(tournament_id, game_uid);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      staff_discord_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT,
      timestamp INTEGER NOT NULL
    );
  `);
}
