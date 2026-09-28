import { errorCategory } from '../operations/logging.js';
import {
  Client,
  GatewayIntentBits
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
import { StreamRepository } from '../stream/StreamRepository.js';
import { StreamService } from '../stream/StreamService.js';
import { PublicationRepository } from '../publication/PublicationRepository.js';
import { PublicationService } from '../publication/PublicationService.js';
import { DiscordPublicAnnouncementGateway } from './DiscordPublicAnnouncementGateway.js';
import { ProductionReadinessService } from '../operations/ProductionReadinessService.js';
import { DiscordResourceProbe } from './DiscordResourceProbe.js';
import { OperationsHandler } from './handlers/OperationsHandler.js';
import { getConfig } from '../config/env.js';

export function createBotClient(db: DatabaseSync): { client: Client; teamRepo: TeamRepository; matchService: MatchService; resultService: ResultService; publicationService: PublicationService; streamService: StreamService } {
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
  const streamService = new StreamService(new StreamRepository(db), matchRepo);
  const publicationService = new PublicationService(new PublicationRepository(db), matchRepo,
    new ResultRepository(db), new StreamRepository(db), new DiscordPublicAnnouncementGateway(client), getConfig().RESULTS_CHANNEL_ID);
  const readinessService = new ProductionReadinessService(db, getConfig(), tournamentRepo,
    new TournamentService(tournamentRepo), matchService, resultService, publicationService, streamService,
    new DiscordResourceProbe(client));
  const operationsHandler = new OperationsHandler(publicationService, streamService, resultService, readinessService);
  const tournamentHandler = new TournamentHandler(new TournamentService(tournamentRepo), teamRepo, matchService, resultService);
  const matchHandler = new MatchHandler(matchService, streamService);
  const resultHandler = new ResultHandler(resultService, matchRepo);

  client.on('ready', () => {
    console.log(`🤖 UMA Tournament Bot is online as ${client.user?.tag}!`);
  });

  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'uma-caster') { await operationsHandler.handle(interaction); return; }
        const subcommand = interaction.options.getSubcommand(false);
        if (['publish-sync','result-correct','result-history','stream-set','stream-clear','stream','doctor'].includes(subcommand ?? '')) {
          await operationsHandler.handle(interaction);
        } else if (['report-result', 'result-resolve', 'result-refresh', 'results'].includes(subcommand ?? '')) {
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
      console.error('Error handling interaction:', errorCategory(err));
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '⚠️ Đã xảy ra lỗi trong quá trình xử lý yêu cầu. Vui lòng thử lại sau hoặc báo cho BTC.',
          ephemeral: true
        }).catch(() => {});
      }
    }
  });

  return { client, teamRepo, matchService, resultService, publicationService, streamService };
}
