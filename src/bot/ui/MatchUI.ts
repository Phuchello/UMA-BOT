import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { MatchRecord, MatchState } from '../../match/MatchRepository.js';

const safe = (value: string) => value.slice(0, 48).replace(/[\r\n]/g, ' ').replace(/@/g, '@\u200b')
  .replace(/[`*_~|]/g, '\\$&');
const label = (match: MatchRecord) => `R${match.round}-M${match.number}`;
const stateLabel: Record<MatchState, string> = {
  WAITING: 'Chờ xác định đội', READY: 'Sẵn sàng mở phòng', ROOM_OPEN: 'Đã mở phòng',
  SCHEDULED: 'Đã lên lịch', READY_TO_START: 'Hai đội đã sẵn sàng', LIVE: '🔴 TRẬN ĐẤU ĐANG DIỄN RA',
  COMPLETED: '✅ TRẬN ĐẤU HOÀN TẤT'
};

export class MatchUI {
  public static starterEmbed(match: MatchRecord): EmbedBuilder {
    const team = (side: MatchRecord['team1']) => side
      ? `${safe(side.name)} [${safe(side.abbreviation)}]\nCaptain: <@${side.captainId}>`
      : 'Chờ xác định';
    const schedule = match.scheduledAt === null ? 'Chưa lên lịch'
      : `<t:${Math.floor(match.scheduledAt / 1000)}:F> • <t:${Math.floor(match.scheduledAt / 1000)}:R>`;
    const ready = (side: MatchRecord['team1']) => side && match.readyTeamIds.includes(side.id) ? '✅ Sẵn sàng' : '⏳ Chưa xác nhận';
    const embed = new EmbedBuilder().setColor(match.status === 'COMPLETED' ? 0x22C55E : match.status === 'LIVE' ? 0xEF4444 : 0x2563EB)
      .setTitle(`⚔️ UMA CUP — ${label(match)}`)
      .addFields(
        { name: 'Team A', value: team(match.team1), inline: true },
        { name: 'Team B', value: team(match.team2), inline: true },
        { name: 'Referee', value: match.refereeIds.length
          ? match.refereeIds.slice(0, 20).map(id => `<@${id}>`).join(', ') +
            (match.refereeIds.length > 20 ? ` và ${match.refereeIds.length - 20} người khác` : '')
          : 'Chưa phân công' },
        { name: 'Schedule', value: schedule },
        { name: 'Readiness', value: `Team A: ${ready(match.team1)}\nTeam B: ${ready(match.team2)}` },
        { name: 'State', value: stateLabel[match.status] }
      )
      .setFooter({ text: match.status === 'LIVE' ? 'Dùng /uma report-result và đính kèm ảnh kết quả.' : 'UMA CUP • Match room' });
    if (match.result) {
      const winner = match.result.winnerTeamId === match.team1?.id ? match.team1.name : match.team2?.name ?? '?';
      embed.addFields({ name: 'Kết quả chính thức', value: `${match.result.team1Score}–${match.result.team2Score} • Thắng: ${safe(winner)}` });
    }
    return embed;
  }

  public static starterButtons(match: MatchRecord): ActionRowBuilder<ButtonBuilder>[] {
    if (match.status === 'LIVE' || match.status === 'COMPLETED') return [];
    return [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`match_ready_${match.id}`).setLabel('✅ Sẵn sàng')
        .setStyle(ButtonStyle.Success).setDisabled(match.status !== 'SCHEDULED'),
      new ButtonBuilder().setCustomId(`match_start_${match.id}`).setLabel('▶️ Bắt đầu trận')
        .setStyle(ButtonStyle.Primary).setDisabled(match.status !== 'READY_TO_START')
    )];
  }

  public static publicMatchEmbeds(matches: MatchRecord[]): EmbedBuilder[] {
    if (matches.length === 0) return [new EmbedBuilder().setTitle('⚔️ UMA CUP — TRẬN ĐẤU')
      .setDescription('Chưa có nhánh đấu.')];
    const rounds = [...new Set(matches.map(match => match.round))].sort((a, b) => a - b);
    return rounds.map(round => {
      const lines = matches.filter(match => match.round === round).map(match => {
        const left = match.team1 ? safe(match.team1.name) : 'Chờ xác định';
        const right = match.team2 ? safe(match.team2.name) : 'Chờ xác định';
        const time = match.scheduledAt === null ? '' : ` • <t:${Math.floor(match.scheduledAt / 1000)}:F>`;
        const score = match.result ? ` ${match.result.team1Score}–${match.result.team2Score}` : '';
        return `**${label(match)}** — ${left}${score} ${match.result ? '' : 'vs '}${right}\n${stateLabel[match.status]}${time}`;
      });
      return new EmbedBuilder().setColor(0x3B82F6).setTitle(`⚔️ UMA CUP — Vòng ${round}`)
        .setDescription(lines.join('\n') || 'Chưa có trận.');
    });
  }

  public static statusCounts(counts: Record<MatchState, number>): string {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return `\n• **Tổng trận:** ${total}\n• **WAITING:** ${counts.WAITING}` +
      `\n• **READY:** ${counts.READY}\n• **ROOM_OPEN:** ${counts.ROOM_OPEN}` +
      `\n• **SCHEDULED:** ${counts.SCHEDULED}\n• **READY_TO_START:** ${counts.READY_TO_START}` +
      `\n• **LIVE:** ${counts.LIVE}\n• **COMPLETED:** ${counts.COMPLETED}`;
  }
}
