import {
  Client,
  GatewayIntentBits,
  REST,
  Routes
} from 'discord.js';
import { DatabaseSync } from 'node:sqlite';
import { TeamRepository } from '../registration/TeamRepository.js';
import { RegistrationHandler } from './handlers/RegistrationHandler.js';
import { TournamentHandler } from './handlers/TournamentHandler.js';
import { TournamentRepository } from '../tournament/TournamentRepository.js';
import { TournamentService } from '../tournament/TournamentService.js';
import { umaCommand } from './commands/umaCommand.js';
import { getConfig } from '../config/env.js';

export function createBotClient(db: DatabaseSync): { client: Client; teamRepo: TeamRepository } {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  const teamRepo = new TeamRepository(db);
  const registrationHandler = new RegistrationHandler(teamRepo, client);
  const tournamentHandler = new TournamentHandler(new TournamentService(new TournamentRepository(db)), teamRepo);

  client.on('ready', () => {
    console.log(`🤖 UMA Tournament Bot is online as ${client.user?.tag}!`);
  });

  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isChatInputCommand()) {
        const subcommand = interaction.options.getSubcommand(false);
        if (['checkin-open', 'check-in', 'checkins', 'draw', 'bracket', 'status'].includes(subcommand ?? '')) {
          await tournamentHandler.handleSlashCommand(interaction);
        } else {
          await registrationHandler.handleSlashCommand(interaction);
        }
      } else if (interaction.isButton()) {
        await registrationHandler.handleButton(interaction);
      } else if (interaction.isModalSubmit()) {
        await registrationHandler.handleModalSubmit(interaction);
      }
    } catch (err) {
      console.error('Error handling interaction:', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '⚠️ Đã xảy ra lỗi trong quá trình xử lý yêu cầu. Vui lòng thử lại sau hoặc báo cho BTC.',
          ephemeral: true
        }).catch(() => {});
      }
    }
  });

  return { client, teamRepo };
}

export async function deployCommands(): Promise<void> {
  const config = getConfig();
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  console.log(`Deploying slash commands to Guild ${config.DISCORD_GUILD_ID}...`);
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body: [umaCommand.toJSON()] }
  );
  console.log('✅ Successfully registered slash commands for development guild.');
}
