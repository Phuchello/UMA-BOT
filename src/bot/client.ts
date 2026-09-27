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
import { ResultRepository } from '../result/ResultRepository.js';
import { ResultService } from '../result/ResultService.js';
import { DiscordEvidenceGateway } from './DiscordEvidenceGateway.js';
import { ResultHandler } from './handlers/ResultHandler.js';
import { umaCommand } from './commands/umaCommand.js';
import { getConfig } from '../config/env.js';

export function createBotClient(db: DatabaseSync): { client: Client; teamRepo: TeamRepository; matchService: MatchService; resultService: ResultService } {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  const teamRepo = new TeamRepository(db);
  const registrationHandler = new RegistrationHandler(teamRepo, client);
  const tournamentRepo = new TournamentRepository(db);
  const matchRepo = new MatchRepository(db);
  const matchService = new MatchService(matchRepo, tournamentRepo,
    new TournamentService(tournamentRepo), new DiscordMatchRoomGateway(client));
  const resultService = new ResultService(new ResultRepository(db), matchRepo, new DiscordEvidenceGateway(client));
  const tournamentHandler = new TournamentHandler(new TournamentService(tournamentRepo), teamRepo, matchService, resultService);
  const matchHandler = new MatchHandler(matchService);
  const resultHandler = new ResultHandler(resultService, matchRepo);

  client.on('ready', () => {
    console.log(`🤖 UMA Tournament Bot is online as ${client.user?.tag}!`);
  });

  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isChatInputCommand()) {
        const subcommand = interaction.options.getSubcommand(false);
        if (['report-result', 'result-resolve', 'result-refresh', 'results'].includes(subcommand ?? '')) {
          await resultHandler.handleSlashCommand(interaction);
        } else if (['start', 'match-referee', 'rooms-create', 'match-schedule', 'matches'].includes(subcommand ?? '')) {
          await matchHandler.handleSlashCommand(interaction);
        } else if (['checkin-open', 'check-in', 'checkins', 'draw', 'bracket', 'status'].includes(subcommand ?? '')) {
          await tournamentHandler.handleSlashCommand(interaction);
        } else {
          await registrationHandler.handleSlashCommand(interaction);
        }
      } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('result_')) {
          await resultHandler.handleButton(interaction);
        } else if (interaction.customId.startsWith('match_ready_') || interaction.customId.startsWith('match_start_')) {
          await matchHandler.handleButton(interaction);
        } else {
          await registrationHandler.handleButton(interaction);
        }
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('result_')) await resultHandler.handleModal(interaction);
        else await registrationHandler.handleModalSubmit(interaction);
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

  return { client, teamRepo, matchService, resultService };
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
