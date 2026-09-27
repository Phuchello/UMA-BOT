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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_tourney_identity
      ON teams(tournament_id, id);

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

    CREATE TABLE IF NOT EXISTS team_checkins (
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL,
      checked_in_by_discord_id TEXT NOT NULL,
      checked_in_at INTEGER NOT NULL,
      PRIMARY KEY (tournament_id, team_id),
      FOREIGN KEY (tournament_id, team_id) REFERENCES teams(tournament_id, id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_team_checkins_tournament ON team_checkins(tournament_id);

    CREATE TABLE IF NOT EXISTS tournament_seeds (
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL,
      seed INTEGER NOT NULL CHECK (seed > 0),
      drawn_at INTEGER NOT NULL,
      drawn_by_discord_id TEXT NOT NULL,
      PRIMARY KEY (tournament_id, team_id),
      UNIQUE (tournament_id, seed),
      FOREIGN KEY (tournament_id, team_id) REFERENCES teams(tournament_id, id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tournament_brackets (
      tournament_id TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
      engine_state TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      generated_by_discord_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tournament_matches (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      engine_match_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      team1_id TEXT REFERENCES teams(id),
      team2_id TEXT REFERENCES teams(id),
      is_bye INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (tournament_id, engine_match_id),
      UNIQUE (tournament_id, round_number, match_number)
    );
    CREATE INDEX IF NOT EXISTS idx_tournament_matches_round ON tournament_matches(tournament_id, round_number);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_matches_identity ON tournament_matches(tournament_id, id);

    CREATE TABLE IF NOT EXISTS match_rooms (
      tournament_id TEXT NOT NULL,
      match_id TEXT PRIMARY KEY,
      discord_thread_id TEXT NOT NULL UNIQUE,
      parent_channel_id TEXT NOT NULL,
      starter_message_id TEXT NOT NULL,
      created_by_discord_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS match_referee_assignments (
      tournament_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      referee_discord_id TEXT NOT NULL,
      assigned_by_discord_id TEXT NOT NULL,
      assigned_at INTEGER NOT NULL,
      PRIMARY KEY (match_id, referee_discord_id),
      FOREIGN KEY (tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS match_schedules (
      tournament_id TEXT NOT NULL,
      match_id TEXT PRIMARY KEY,
      scheduled_at INTEGER NOT NULL,
      scheduled_by_discord_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS match_ready_confirmations (
      tournament_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      captain_discord_id TEXT NOT NULL,
      confirmed_at INTEGER NOT NULL,
      PRIMARY KEY (match_id, team_id),
      FOREIGN KEY (tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE,
      FOREIGN KEY (tournament_id, team_id) REFERENCES teams(tournament_id, id)
    );
    CREATE TABLE IF NOT EXISTS match_starts (
      tournament_id TEXT NOT NULL,
      match_id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      started_by_discord_id TEXT NOT NULL,
      FOREIGN KEY (tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS match_audit_logs (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      actor_discord_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_match_audit_match ON match_audit_logs(tournament_id, match_id, timestamp);
    CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);

    CREATE TABLE IF NOT EXISTS match_result_submissions (
      id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL, match_id TEXT NOT NULL,
      submitted_by_discord_id TEXT NOT NULL, submitting_team_id TEXT NOT NULL,
      team1_score INTEGER NOT NULL, team2_score INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','CONFIRMED','DISPUTED','APPROVED','REJECTED')),
      card_message_id TEXT, rejection_reason TEXT, submitted_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      FOREIGN KEY(tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE,
      FOREIGN KEY(tournament_id, submitting_team_id) REFERENCES teams(tournament_id, id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_result_one_open ON match_result_submissions(match_id)
      WHERE status IN ('PENDING','CONFIRMED','DISPUTED');
    CREATE TRIGGER IF NOT EXISTS trg_result_submission_forward BEFORE UPDATE OF status ON match_result_submissions
      WHEN OLD.status != NEW.status AND NOT (
        (OLD.status = 'PENDING' AND NEW.status IN ('CONFIRMED','DISPUTED','APPROVED','REJECTED')) OR
        (OLD.status = 'CONFIRMED' AND NEW.status IN ('APPROVED','REJECTED')) OR
        (OLD.status = 'DISPUTED' AND NEW.status IN ('APPROVED','REJECTED'))
      ) BEGIN SELECT RAISE(ABORT, 'invalid result submission transition'); END;
    CREATE TABLE IF NOT EXISTS result_evidence (
      submission_id TEXT PRIMARY KEY REFERENCES match_result_submissions(id) ON DELETE CASCADE,
      discord_message_id TEXT NOT NULL UNIQUE, discord_attachment_id TEXT NOT NULL,
      filename TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
      archived_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS match_result_disputes (
      submission_id TEXT PRIMARY KEY REFERENCES match_result_submissions(id) ON DELETE CASCADE,
      raised_by_discord_id TEXT NOT NULL, team_id TEXT NOT NULL,
      reason TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS match_results (
      match_id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL,
      approved_submission_id TEXT NOT NULL UNIQUE REFERENCES match_result_submissions(id),
      team1_score INTEGER NOT NULL, team2_score INTEGER NOT NULL,
      winner_team_id TEXT NOT NULL, loser_team_id TEXT NOT NULL,
      approved_by_discord_id TEXT NOT NULL, approved_at INTEGER NOT NULL,
      resolution_reason TEXT,
      FOREIGN KEY(tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS result_audit_logs (
      id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL, match_id TEXT NOT NULL,
      submission_id TEXT, actor_discord_id TEXT NOT NULL, action TEXT NOT NULL,
      previous_status TEXT, new_status TEXT, details TEXT, timestamp INTEGER NOT NULL,
      FOREIGN KEY(tournament_id, match_id) REFERENCES tournament_matches(tournament_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tournament_outcomes (
      tournament_id TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
      champion_team_id TEXT NOT NULL, runner_up_team_id TEXT NOT NULL,
      final_match_id TEXT NOT NULL UNIQUE, completed_at INTEGER NOT NULL,
      completed_by_discord_id TEXT NOT NULL
    );

    -- The adapter omits automatic BYE matches. Record the advancement path,
    -- not a synthetic playable match or fake team.
    CREATE TABLE IF NOT EXISTS tournament_byes (
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL,
      advance_to_engine_match_id TEXT NOT NULL,
      round_number INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (tournament_id, team_id),
      FOREIGN KEY (tournament_id, team_id) REFERENCES teams(tournament_id, id) ON DELETE CASCADE
    );

    -- Additive guards work for both new databases and existing Phase 1 files.
    CREATE TRIGGER IF NOT EXISTS trg_tournament_status_insert
      BEFORE INSERT ON tournaments
      WHEN NEW.status NOT IN ('registration_open', 'checkin_open', 'bracket_ready', 'in_progress')
      BEGIN SELECT RAISE(ABORT, 'invalid tournament status'); END;
    CREATE TRIGGER IF NOT EXISTS trg_tournament_status_forward
      BEFORE UPDATE OF status ON tournaments
      WHEN OLD.status != NEW.status AND NOT (
        (OLD.status = 'registration_open' AND NEW.status = 'checkin_open') OR
        (OLD.status = 'checkin_open' AND NEW.status = 'bracket_ready') OR
        (OLD.status = 'bracket_ready' AND NEW.status = 'in_progress')
      )
      BEGIN SELECT RAISE(ABORT, 'invalid tournament status transition'); END;
  `);

  // One-time conversion of Phase 2A's placeholder SCHEDULED state. The marker
  // prevents later genuine schedules from being reset during subsequent boots.
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'phase2b_match_status_v1'").get();
    if (!applied) {
      db.exec(`UPDATE tournament_matches SET status = CASE
          WHEN team1_id IS NOT NULL AND team2_id IS NOT NULL THEN 'READY' ELSE 'WAITING' END
        WHERE status = 'SCHEDULED'
          AND NOT EXISTS (SELECT 1 FROM match_rooms r WHERE r.match_id = tournament_matches.id)
          AND NOT EXISTS (SELECT 1 FROM match_schedules s WHERE s.match_id = tournament_matches.id);`);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
        .run('phase2b_match_status_v1', Date.now());
    }
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }

  db.exec(`
    DROP TRIGGER IF EXISTS trg_tournament_status_insert;
    DROP TRIGGER IF EXISTS trg_tournament_status_forward;
    CREATE TRIGGER trg_tournament_status_insert BEFORE INSERT ON tournaments
      WHEN NEW.status NOT IN ('registration_open','checkin_open','bracket_ready','in_progress','completed')
      BEGIN SELECT RAISE(ABORT, 'invalid tournament status'); END;
    CREATE TRIGGER trg_tournament_status_forward BEFORE UPDATE OF status ON tournaments
      WHEN OLD.status != NEW.status AND NOT (
        (OLD.status = 'registration_open' AND NEW.status = 'checkin_open') OR
        (OLD.status = 'checkin_open' AND NEW.status = 'bracket_ready') OR
        (OLD.status = 'bracket_ready' AND NEW.status = 'in_progress') OR
        (OLD.status = 'in_progress' AND NEW.status = 'completed')
      ) BEGIN SELECT RAISE(ABORT, 'invalid tournament status transition'); END;
    DROP TRIGGER IF EXISTS trg_match_status_insert;
    DROP TRIGGER IF EXISTS trg_match_status_forward;
    CREATE TRIGGER IF NOT EXISTS trg_match_status_insert BEFORE INSERT ON tournament_matches
      WHEN NEW.status NOT IN ('WAITING','READY','ROOM_OPEN','SCHEDULED','READY_TO_START','LIVE','COMPLETED')
      BEGIN SELECT RAISE(ABORT, 'invalid match status'); END;
    CREATE TRIGGER IF NOT EXISTS trg_match_status_forward BEFORE UPDATE OF status ON tournament_matches
      WHEN OLD.status != NEW.status AND NOT (
        (OLD.status = 'WAITING' AND NEW.status = 'READY') OR
        (OLD.status = 'READY' AND NEW.status = 'ROOM_OPEN') OR
        (OLD.status = 'ROOM_OPEN' AND NEW.status = 'SCHEDULED') OR
        (OLD.status = 'SCHEDULED' AND NEW.status = 'READY_TO_START') OR
        (OLD.status = 'READY_TO_START' AND NEW.status = 'LIVE') OR
        (OLD.status = 'LIVE' AND NEW.status = 'COMPLETED')
      ) BEGIN SELECT RAISE(ABORT, 'invalid match transition'); END;
  `);
}
