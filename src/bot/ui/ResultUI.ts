import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import type { MatchRecord } from '../../match/MatchRepository.js';
import type { ResultSubmission } from '../../result/ResultRepository.js';
import { persona } from '../persona/index.js';

const safe = (value: string) => value.slice(0, 80).replace(/[\r\n]/g, ' ').replace(/@/g, '@\u200b').replace(/[`*_~|]/g, '\\$&');
const status: Record<ResultSubmission['status'], string> = {
  PENDING: '⏳ Chờ đối thủ / trọng tài xác nhận', CONFIRMED: '✅ Đối thủ đã đồng ý, chờ trọng tài',
  DISPUTED: '⚠️ KẾT QUẢ ĐANG TRANH CHẤP', APPROVED: '✅ KẾT QUẢ ĐÃ ĐƯỢC DUYỆT',
  REJECTED: '❌ Yêu cầu báo lại'
};
export class ResultUI {
  static evidenceEmbed(match: MatchRecord, submission: ResultSubmission): EmbedBuilder {
    const score1 = submission.status === 'APPROVED' ? match.result?.team1Score ?? submission.team1Score : submission.team1Score;
    const score2 = submission.status === 'APPROVED' ? match.result?.team2Score ?? submission.team2Score : submission.team2Score;
    const embed = new EmbedBuilder().setColor(submission.status === 'APPROVED' ? 0x22C55E : 0xF59E0B)
      .setTitle(`📸 UMA CUP — BÁO KẾT QUẢ R${match.round}-M${match.number} ⚡`)
      .setDescription(`${safe(match.team1?.name ?? '?')} **${score1} — ${score2}** ${safe(match.team2?.name ?? '?')}`)
      .addFields(
        { name: 'Người báo', value: `<@${submission.reporterId}>` },
        { name: 'Bằng chứng', value: 'Screenshot đã lưu trong phòng trận' },
        { name: 'Trạng thái', value: status[submission.status] }
      )
      .setFooter({ text: persona.arenaFooter('Xác nhận kết quả UMA CUP') });
    if (submission.status === 'APPROVED' && match.result) {
      const winner = match.result.winnerTeamId === match.team1?.id ? match.team1.name : match.team2?.name ?? '?';
      embed.addFields({ name: 'Đội thắng', value: safe(winner) }, { name: 'Duyệt bởi', value: `<@${match.result.approvedBy}>` });
      if (match.result.revision > 1 && (score1 !== submission.team1Score || score2 !== submission.team2Score))
        embed.addFields({ name: 'Hiệu chỉnh', value: `BTC đã cập nhật kết quả chính thức • Revision ${match.result.revision}` });
    }
    return embed;
  }
  static evidenceButtons(submission: ResultSubmission): ActionRowBuilder<ButtonBuilder>[] {
    if (submission.status === 'APPROVED' || submission.status === 'REJECTED') return [];
    const id = submission.id;
    return [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`result_confirm_${id}`).setLabel('✅ Đồng ý').setStyle(ButtonStyle.Success)
        .setDisabled(submission.status !== 'PENDING'),
      new ButtonBuilder().setCustomId(`result_dispute_${id}`).setLabel('⚠️ Khiếu nại').setStyle(ButtonStyle.Secondary)
        .setDisabled(submission.status !== 'PENDING'),
      new ButtonBuilder().setCustomId(`result_approve_${id}`).setLabel('✅ Duyệt kết quả').setStyle(ButtonStyle.Primary)
        .setDisabled(submission.status === 'DISPUTED'),
      new ButtonBuilder().setCustomId(`result_reject_${id}`).setLabel('❌ Yêu cầu báo lại').setStyle(ButtonStyle.Danger)
    )];
  }
  static reasonModal(kind: 'dispute' | 'reject', submissionId: string): ModalBuilder {
    return new ModalBuilder().setCustomId(`result_${kind}_modal_${submissionId}`)
      .setTitle(kind === 'dispute' ? 'Khiếu nại kết quả' : 'Yêu cầu báo lại')
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Lý do').setStyle(TextInputStyle.Paragraph)
          .setMinLength(3).setMaxLength(500).setRequired(true)
      ));
  }
  static publicResults(matches: MatchRecord[]): EmbedBuilder[] {
    if (!matches.length) return [new EmbedBuilder().setTitle('🏆 UMA CUP — KẾT QUẢ').setDescription('Chưa có trận.')];
    const rounds = [...new Set(matches.map(match => match.round))].sort((a, b) => a - b);
    return rounds.map(round => new EmbedBuilder().setTitle(`🏆 UMA CUP — KẾT QUẢ VÒNG ${round}`)
      .setDescription(matches.filter(match => match.round === round).map(match =>
        `**R${match.round}-M${match.number}** — ${match.result
          ? `${safe(match.team1?.name ?? '?')} ${match.result.team1Score}–${match.result.team2Score} ${safe(match.team2?.name ?? '?')} ✅ Đã xác nhận`
          : 'Chưa hoàn tất'}`).join('\n'))
      .setFooter({ text: persona.footer('Bảng kết quả UMA CUP') }));
  }
}
