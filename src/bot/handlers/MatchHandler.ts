import { ButtonInteraction, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { getConfig, isStaffMember } from '../../config/env.js';
import { MatchError, MatchService } from '../../match/MatchService.js';
import { MatchUI } from '../ui/MatchUI.js';
import type { StreamService } from '../../stream/StreamService.js';
import { persona } from '../persona/index.js';

export class MatchHandler {
  constructor(private readonly service: MatchService, private readonly streams?: StreamService) {}

  public async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const tournamentId = getConfig().ACTIVE_TOURNAMENT_ID;
    const staff = this.isStaff(interaction);
    try {
      if (sub === 'start') {
        const counts = this.service.startTournament(tournamentId, interaction.user.id, staff);
        await interaction.reply({ content: persona.messages.tournament.tournamentStarted(counts.READY, counts.WAITING), ephemeral: true });
      } else if (sub === 'match-referee') {
        if (!staff) throw new MatchError('NOT_STAFF', 'Chỉ Ban Tổ Chức được thực hiện thao tác này.');
        await interaction.deferReply({ ephemeral: true });
        const round = interaction.options.getInteger('round', true);
        const number = interaction.options.getInteger('match', true);
        const referee = interaction.options.getUser('referee', true);
        const added = await this.service.assignReferee(tournamentId, round, number, referee.id, interaction.user.id, staff);
        await interaction.editReply(added
          ? persona.messages.match.refereeAssigned(round, number)
          : persona.messages.match.refereeAlreadyAssigned(round, number));
      } else if (sub === 'rooms-create') {
        if (!staff) throw new MatchError('NOT_STAFF', 'Chỉ Ban Tổ Chức được thực hiện thao tác này.');
        await interaction.deferReply({ ephemeral: true });
        const result = await this.service.createRooms(tournamentId, getConfig().MATCH_HUB_CHANNEL_ID, interaction.user.id, staff);
        await interaction.editReply(persona.messages.match.roomsBatchCreated(result));
      } else if (sub === 'match-schedule') {
        if (!staff) throw new MatchError('NOT_STAFF', 'Chỉ Ban Tổ Chức được thực hiện thao tác này.');
        await interaction.deferReply({ ephemeral: true });
        const round = interaction.options.getInteger('round', true);
        const number = interaction.options.getInteger('match', true);
        const time = interaction.options.getString('time', true);
        const match = await this.service.schedule(tournamentId, round, number, time, interaction.user.id, staff);
        await interaction.editReply(persona.messages.match.matchScheduled(round, number, match.scheduledAt!));
      } else if (sub === 'matches') {
        const matches = this.service.list(tournamentId);
        const streamed = new Set(matches.filter(match => this.streams?.forMatch(match.id).stream).map(match => match.id));
        await interaction.reply({ embeds: MatchUI.publicMatchEmbeds(matches, streamed), allowedMentions: { parse: [] } });
      }
    } catch (error) { await this.respondError(interaction, error); }
  }

  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    const ready = interaction.customId.startsWith('match_ready_');
    const matchId = interaction.customId.replace(ready ? 'match_ready_' : 'match_start_', '');
    const tournamentId = getConfig().ACTIVE_TOURNAMENT_ID;
    await interaction.deferReply({ ephemeral: true });
    try {
      if (ready) {
        const result = await this.service.confirmReady(tournamentId, matchId, interaction.channelId, interaction.user.id);
        await interaction.editReply(result.repeated
          ? persona.messages.match.captainAlreadyReady()
          : result.match.status === 'READY_TO_START'
          ? persona.messages.match.bothTeamsReady()
          : persona.messages.match.captainReadySelf());
      } else {
        const started = await this.service.startMatch(tournamentId, matchId, interaction.channelId, interaction.user.id, this.isStaff(interaction));
        await interaction.editReply(persona.messages.match.matchStart(started.team1?.name ?? 'Đội 1', started.team2?.name ?? 'Đội 2'));
      }
    } catch (error) { await this.respondError(interaction, error); }
  }

  private isStaff(interaction: ChatInputCommandInteraction | ButtonInteraction): boolean {
    if (!interaction.inGuild() || !interaction.member) return false;
    const member = interaction.member as GuildMember;
    return member.permissions.has('Administrator') || isStaffMember(Array.from(member.roles.cache.keys()));
  }

  private async respondError(interaction: ChatInputCommandInteraction | ButtonInteraction, error: unknown): Promise<void> {
    if (!(error instanceof MatchError)) throw error;
    const content = persona.messages.errors.domainError(error.code, error.message);
    if (interaction.deferred) await interaction.editReply(content);
    else await interaction.reply({ content, ephemeral: true });
  }
}
