import { getConfig } from './config/env.js';
import { createDatabase } from './database/Database.js';
import { createBotClient, deployCommands } from './bot/client.js';

async function bootstrap() {
  console.log('🚀 Initializing UMA Tournament Bot...');

  // 1. Validate Environment
  const config = getConfig();
  console.log(`Config loaded: Guild=${config.DISCORD_GUILD_ID}, DB=${config.DATABASE_PATH}`);

  // 2. Initialize Database
  const db = createDatabase(config.DATABASE_PATH);
  console.log('📦 Database initialized and schema verified.');

  // 3. Create Bot Client
  const { client } = createBotClient(db);

  // 4. Register Commands if run with --deploy flag
  if (process.argv.includes('--deploy')) {
    await deployCommands();
  }

  // 5. Connect to Discord
  await client.login(config.DISCORD_TOKEN);
}

// Only auto-run if directly executed
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch(err => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

export { bootstrap };
