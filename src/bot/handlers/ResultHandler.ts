import { ButtonInteraction, ChatInputCommandInteraction, GuildMember, ModalSubmitInteraction } from 'discord.js';
import { getConfig, isStaffMember } from '../../config/env.js';
import { ResultError, ResultService } from '../../result/ResultService.js';
import { MatchRepository } from '../../match/MatchRepository.js';
import { ResultUI } from '../ui/ResultUI.js';

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
        await this.service.submit(tournamentId, interaction.channelId, interaction.user.id,
          interaction.options.getInteger('my-score', true), interaction.options.getInteger('opponent-score', true),
          { url: attachment.url, filename: attachment.name, contentType: attachment.contentType, size: attachment.size });
        await interaction.editReply('📸 Đã lưu ảnh và báo cáo. Chờ đối thủ và trọng tài xử lý.');
      } else if (sub === 'result-resolve') {
        await this.service.resolve(tournamentId, interaction.channelId, interaction.user.id, this.isStaff(interaction),
          interaction.options.getInteger('team1-score', true), interaction.options.getInteger('team2-score', true),
          interaction.options.getString('reason', true));
        await interaction.editReply('✅ Đã xử lý tranh chấp và cập nhật nhánh đấu.');
      } else if (sub === 'result-refresh') {
        await this.service.refresh(tournamentId, interaction.channelId, interaction.user.id, this.isStaff(interaction));
        await interaction.editReply('🔄 Đã cập nhật thẻ kết quả và thẻ trận từ dữ liệu đã lưu.');
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
        await interaction.editReply('✅ Đã đồng ý. Trọng tài vẫn cần duyệt kết quả.');
      } else {
        await this.service.approve(tournamentId, interaction.channelId, submissionId, interaction.user.id, this.isStaff(interaction));
        await interaction.editReply('✅ Kết quả đã được duyệt và nhánh đấu đã cập nhật.');
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
        await interaction.editReply('⚠️ Đã ghi nhận khiếu nại. Chờ trọng tài xử lý.');
      } else {
        await this.service.reject(tournamentId, interaction.channelId, submissionId, interaction.user.id, this.isStaff(interaction), reason);
        await interaction.editReply('❌ Đã yêu cầu báo lại. Trận vẫn LIVE.');
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
    const content = error instanceof ResultError ? `⚠️ ${error.message}` : '⚠️ Không thể xử lý kết quả lúc này. Hãy báo BTC kiểm tra phòng trận.';
    if (interaction.deferred) await interaction.editReply(content);
    else await interaction.reply({ content, ephemeral: true });
  }
}
