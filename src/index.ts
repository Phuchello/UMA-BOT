import { getConfig } from './config/env.js';
import { createDatabase } from './database/Database.js';
import { TeamRepository } from './registration/TeamRepository.js';
import { TournamentRepository } from './tournament/TournamentRepository.js';
import { TournamentService } from './tournament/TournamentService.js';
import { createBotClient, deployCommands } from './bot/client.js';
import { pathToFileURL } from 'node:url';

async function bootstrap() {
  console.log('🚀 Initializing UMA Tournament Bot...');

  // 1. Validate Environment
  const config = getConfig();
  console.log(`Config loaded: Guild=${config.DISCORD_GUILD_ID}, DB=${config.DATABASE_PATH}`);

  // 2. Initialize Database
  const db = createDatabase(config.DATABASE_PATH);
  console.log('📦 Database initialized and schema verified.');

  // 3. Bootstrap Active Tournament
  // MAX_TEAMS is creation input only. Once a tournament exists, its stored name
  // and max_teams remain authoritative across bot restarts and config edits.
  const repo = new TeamRepository(db);
  const tournamentDisplayName = config.TOURNAMENT_NAME ?? `UMA Cup (${config.ACTIVE_TOURNAMENT_ID})`;
  repo.ensureTournament(config.ACTIVE_TOURNAMENT_ID, tournamentDisplayName, config.MAX_TEAMS);
  const tournament = repo.getTournament(config.ACTIVE_TOURNAMENT_ID);
  if (!tournament) throw new Error(`Tournament "${config.ACTIVE_TOURNAMENT_ID}" was not created.`);
  console.log(`🏆 Tournament "${tournament.id}" ready (capacity: ${tournament.maxTeams} teams).`);
  const restored = new TournamentService(new TournamentRepository(db)).restoreBracket(tournament.id);
  if (['bracket_ready', 'in_progress'].includes(tournament.status) && !restored) {
    throw new Error('Bracket-ready tournament has no persisted bracket.');
  }
  if (tournament.status === 'checkin_open' && restored) {
    throw new Error('Check-in tournament unexpectedly has a persisted bracket.');
  }
  if (restored) console.log(`🏆 Restored ${restored.matches.length} bracket matches without redraw.`);

  // 4. Create Bot Client
  const { client } = createBotClient(db);

  // 5. Register Commands if run with --deploy flag
  if (process.argv.includes('--deploy')) {
    await deployCommands();
  }

  // 6. Connect to Discord
  await client.login(config.DISCORD_TOKEN);
}

export function isDirectExecution(moduleUrl: string, argvEntry?: string): boolean {
  if (!argvEntry) return false;
  return moduleUrl === pathToFileURL(argvEntry).href;
}

// Only auto-run if directly executed
if (isDirectExecution(import.meta.url, process.argv[1])) {
  bootstrap().catch(err => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

export { bootstrap };
