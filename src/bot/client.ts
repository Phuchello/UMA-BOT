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
import { MatchRepository } from '../match/MatchRepository.js';
import { MatchService } from '../match/MatchService.js';
import { DiscordMatchRoomGateway } from './DiscordMatchRoomGateway.js';
import { MatchHandler } from './handlers/MatchHandler.js';
import { umaCommand } from './commands/umaCommand.js';
import { getConfig } from '../config/env.js';

export function createBotClient(db: DatabaseSync): { client: Client; teamRepo: TeamRepository; matchService: MatchService } {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  const teamRepo = new TeamRepository(db);
  const registrationHandler = new RegistrationHandler(teamRepo, client);
  const tournamentRepo = new TournamentRepository(db);
  const matchService = new MatchService(new MatchRepository(db), tournamentRepo,
    new TournamentService(tournamentRepo), new DiscordMatchRoomGateway(client));
  const tournamentHandler = new TournamentHandler(new TournamentService(tournamentRepo), teamRepo, matchService);
  const matchHandler = new MatchHandler(matchService);

  client.on('ready', () => {
    console.log(`🤖 UMA Tournament Bot is online as ${client.user?.tag}!`);
  });

  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isChatInputCommand()) {
        const subcommand = interaction.options.getSubcommand(false);
        if (['start', 'match-referee', 'rooms-create', 'match-schedule', 'matches'].includes(subcommand ?? '')) {
          await matchHandler.handleSlashCommand(interaction);
        } else if (['checkin-open', 'check-in', 'checkins', 'draw', 'bracket', 'status'].includes(subcommand ?? '')) {
          await tournamentHandler.handleSlashCommand(interaction);
        } else {
          await registrationHandler.handleSlashCommand(interaction);
        }
      } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('match_ready_') || interaction.customId.startsWith('match_start_')) {
          await matchHandler.handleButton(interaction);
        } else {
          await registrationHandler.handleButton(interaction);
        }
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

  return { client, teamRepo, matchService };
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
