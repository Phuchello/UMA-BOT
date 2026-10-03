import { EmbedBuilder } from 'discord.js';
import type { BracketView, DrawResult } from '../../tournament/TournamentService.js';
import type { TournamentSummary } from '../../tournament/TournamentRepository.js';
import { persona } from '../persona/index.js';

const phaseLabel: Record<string, string> = {
  registration_open: 'Đang mở đăng ký',
  checkin_open: 'Đang check-in',
  bracket_ready: 'Đã bốc thăm nhánh đấu',
  in_progress: 'Đang thi đấu', completed: 'Đã kết thúc'
};

const safeName = (name: string) => {
  const clipped = name.length > 48 ? `${name.slice(0, 47)}…` : name;
  return clipped.replace(/[\r\n]/g, ' ').replace(/@/g, '@\u200b').replace(/[`*_~|]/g, '\\$&');
};

export class TournamentUI {
  public static statusText(tournamentId: string, summary: TournamentSummary, maxTeams: number): string {
    return `📊 **TRẠNG THÁI GIẢI ĐẤU UMA CUP (${tournamentId}):**\n` +
      `• **Giai đoạn:** ${phaseLabel[summary.status] ?? summary.status}\n` +
      `• **Đã duyệt chính thức:** ${summary.approved} / ${maxTeams} đội\n` +
      `• **Đã check-in:** ${summary.checkedIn} đội\n` +
      `• **Nhánh đấu:** ${summary.bracketReady ? 'Đã sẵn sàng' : 'Chưa bốc thăm'}\n` +
      `• **Đang chờ BTC duyệt:** ${summary.pending} đội\n` +
      `• **Yêu cầu chỉnh sửa:** ${summary.needsCorrection} đội\n` +
      `• **Đã từ chối:** ${summary.rejected} đội\n` +
      `• **Hạn ngạch:** Tối đa ${maxTeams} đội (5 tuyển thủ chính/đội)`;
  }

  public static checkinsEmbed(summary: TournamentSummary, checkedInNames: string[], missingNames: string[]): EmbedBuilder {
    const lines = [
      `**Giai đoạn:** ${phaseLabel[summary.status] ?? summary.status}`,
      `**Đã duyệt:** ${summary.approved} • **Đã check-in:** ${summary.checkedIn} • **Chưa check-in:** ${missingNames.length}`,
      '', '**Đã check-in:**', checkedInNames.length ? checkedInNames.map(safeName).join(', ') : '*Chưa có đội nào*',
      '', '**Chưa check-in:**', missingNames.length ? missingNames.map(safeName).join(', ') : '*Không có*'
    ];
    return new EmbedBuilder()
      .setColor(0xEAB308)
      .setTitle('✅ UMA CUP — ĐIỂM DANH ĐỘI ⚡')
      .setDescription(lines.join('\n'))
      .setFooter({ text: persona.footer('Điểm danh thi đấu UMA CUP') });
  }

  public static drawEmbed(draw: DrawResult): EmbedBuilder {
    const order = draw.seeds.map(seed => `#${seed.seed} — ${safeName(seed.name)}`).join('\n');
    return new EmbedBuilder()
      .setColor(0x22C55E)
      .setTitle('🎲 BỐC THĂM THÀNH CÔNG ⚡')
      .setDescription(`**Đội hợp lệ:** ${draw.eligibleCount}\n**Số vòng:** ${draw.bracket.totalRounds}\n**BYE:** ${draw.byes.length}\n**Nhánh đấu:** Đã lưu thành công\n\n**Thứ tự hạt giống ngẫu nhiên:**\n${order}`)
      .setFooter({ text: persona.arenaFooter('Bốc thăm nhánh đấu hoàn tất') });
  }

  public static bracketEmbeds(view: BracketView): EmbedBuilder[] {
    const { bracket, seeds, byes } = view;
    const seedName = new Map(seeds.map(seed => [seed.teamId, safeName(seed.name)]));
    const embeds: EmbedBuilder[] = [new EmbedBuilder().setColor(0x3B82F6)
      .setTitle('🏆 UMA CUP — NHÁNH ĐẤU ⚡')
      .setDescription(`**Số đội:** ${seeds.length}\n**Thể thức:** Single Elimination\n**Tổng số vòng:** ${bracket.totalRounds}\n**BYE:** ${byes.length}`)
      .setFooter({ text: persona.arenaFooter('Nhánh đấu chính thức') })];
    for (let round = 1; round <= bracket.totalRounds; round++) {
      const lines = bracket.matches.filter(match => match.round === round)
        .sort((a, b) => a.matchNumber - b.matchNumber)
        .map(match => {
          const left = match.team1.id ? seedName.get(match.team1.id) ?? 'Chờ xác định' : 'Chờ xác định';
          const right = match.team2.id ? seedName.get(match.team2.id) ?? 'Chờ xác định' : 'Chờ xác định';
          return `M${match.matchNumber} — ${left} vs ${right}`;
        });
      if (round === 1) {
        byes.forEach((bye, index) => lines.push(`BYE ${index + 1} — ${seedName.get(bye.teamId)} → Vòng 2`));
      }
      embeds.push(new EmbedBuilder().setColor(0x64748B).setTitle(`Vòng ${round}`)
        .setDescription(lines.join('\n') || '*Chưa có trận đấu*')
        .setFooter({ text: persona.footer(`Vòng ${round}`) }));
    }
    return embeds;
  }
}
