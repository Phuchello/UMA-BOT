import { ButtonInteraction, ChatInputCommandInteraction, GuildMember, ModalSubmitInteraction } from 'discord.js';
import { getConfig, isStaffMember } from '../../config/env.js';
import { ResultError, ResultService } from '../../result/ResultService.js';
import { MatchRepository } from '../../match/MatchRepository.js';
import { ResultUI } from '../ui/ResultUI.js';
import { persona } from '../persona/index.js';

type ResultInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;
export class ResultHandler {
  constructor(private readonly service: ResultService, private readonly matches: MatchRepository) {}
  async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const tournamentId = getConfig().ACTIVE_TOURNAMENT_ID;
    try {
      if (sub === 'results') {
        await interaction.reply({ embeds: ResultUI.publicResults(this.matches.list(tournamentId)), allowedMentions: { parse: [] } });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      if (sub === 'report-result') {
        const attachment = interaction.options.getAttachment('evidence', true);
        const myScore = interaction.options.getInteger('my-score', true);
        const oppScore = interaction.options.getInteger('opponent-score', true);
        await this.service.submit(tournamentId, interaction.channelId, interaction.user.id,
          myScore, oppScore,
          { url: attachment.url, filename: attachment.name, contentType: attachment.contentType, size: attachment.size });
        await interaction.editReply(persona.messages.result.reported(`${myScore}–${oppScore}`));
      } else if (sub === 'result-resolve') {
        await this.service.resolve(tournamentId, interaction.channelId, interaction.user.id, this.isStaff(interaction),
          interaction.options.getInteger('team1-score', true), interaction.options.getInteger('team2-score', true),
          interaction.options.getString('reason', true));
        await interaction.editReply(persona.messages.result.disputeResolved());
      } else if (sub === 'result-refresh') {
        await this.service.refresh(tournamentId, interaction.channelId, interaction.user.id, this.isStaff(interaction));
        await interaction.editReply(persona.messages.result.refreshed());
      }
    } catch (error) { await this.respondError(interaction, error); }
  }
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const match = /^result_(confirm|dispute|approve|reject)_(.+)$/.exec(interaction.customId);
    if (!match) return;
    const [, action, submissionId] = match;
    if (action === 'dispute' || action === 'reject') {
      await interaction.showModal(ResultUI.reasonModal(action, submissionId));
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const tournamentId = getConfig().ACTIVE_TOURNAMENT_ID;
      if (action === 'confirm') {
        await this.service.confirm(tournamentId, interaction.channelId, submissionId, interaction.user.id);
        await interaction.editReply(persona.messages.result.opponentConfirmed());
      } else {
        const approved = await this.service.approve(tournamentId, interaction.channelId, submissionId, interaction.user.id, this.isStaff(interaction));
        const matchRecord = this.matches.byId(tournamentId, approved.matchId);
        const winnerName = matchRecord?.team1?.id === approved.winnerTeamId
          ? matchRecord.team1.name
          : matchRecord?.team2?.name ?? 'Chiến thắng';
        await interaction.editReply(persona.messages.result.refereeApproved(winnerName, `${approved.team1Score}–${approved.team2Score}`));
      }
    } catch (error) { await this.respondError(interaction, error); }
  }
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const match = /^result_(dispute|reject)_modal_(.+)$/.exec(interaction.customId);
    if (!match) return;
    await interaction.deferReply({ ephemeral: true });
    try {
      const [, action, submissionId] = match;
      const reason = interaction.fields.getTextInputValue('reason');
      const tournamentId = getConfig().ACTIVE_TOURNAMENT_ID;
      if (!interaction.channelId) throw new ResultError('WRONG_ROOM', 'Không tìm thấy phòng trận.');
      if (action === 'dispute') {
        await this.service.dispute(tournamentId, interaction.channelId, submissionId, interaction.user.id, reason);
        await interaction.editReply(persona.messages.result.disputeRecorded());
      } else {
        await this.service.reject(tournamentId, interaction.channelId, submissionId, interaction.user.id, this.isStaff(interaction), reason);
        await interaction.editReply(persona.messages.result.refereeRejected(reason));
      }
    } catch (error) { await this.respondError(interaction, error); }
  }
  private isStaff(interaction: ResultInteraction): boolean {
    if (!interaction.inGuild() || !interaction.member) return false;
    const member = interaction.member as GuildMember;
    return member.permissions.has('Administrator') || isStaffMember(Array.from(member.roles.cache.keys()));
  }
  private async respondError(interaction: ResultInteraction, error: unknown): Promise<void> {
    if (!(error instanceof ResultError)) console.error('Result interaction failed:', error);
    const content = error instanceof ResultError
      ? persona.messages.errors.domainError(error.code, error.message)
      : persona.messages.errors.unhandledError();
    if (interaction.deferred) await interaction.editReply(content);
    else await interaction.reply({ content, ephemeral: true });
  }
}
