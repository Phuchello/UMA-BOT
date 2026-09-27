import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { TeamRepository } from '../../registration/TeamRepository.js';
import { TournamentService, TournamentError } from '../../tournament/TournamentService.js';
import { getConfig, isStaffMember } from '../../config/env.js';
import { TournamentUI } from '../ui/TournamentUI.js';
import type { MatchService } from '../../match/MatchService.js';
import { MatchUI } from '../ui/MatchUI.js';

export class TournamentHandler {
  constructor(private readonly service: TournamentService, private readonly teams: TeamRepository,
    private readonly matches?: MatchService) {}

  public async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = interaction.options.getSubcommand();
    const tournamentId = getConfig().ACTIVE_TOURNAMENT_ID;
    try {
      if (command === 'checkin-open') {
        if (!this.isStaff(interaction)) return this.deny(interaction);
        const summary = this.service.openCheckin(tournamentId);
        await interaction.reply({ content: `🔒 Đã khóa đăng ký và mở check-in. **${summary.approved} đội đã duyệt** có thể điểm danh bằng \`/uma check-in\`.`, ephemeral: true });
      } else if (command === 'check-in') {
        const team = this.teams.getCaptainActiveTeam(tournamentId, interaction.user.id);
        if (!team) {
          await interaction.reply({ content: '⚠️ Bạn chưa có đội đang hoạt động trong giải đấu này.', ephemeral: true });
          return;
        }
        const result = this.service.checkIn(tournamentId, team.id, interaction.user.id);
        await interaction.reply({ content: result.repeated
          ? `ℹ️ Đội ${result.teamName} đã check-in trước đó.`
          : `✅ Đội ${result.teamName} đã check-in thành công.`, ephemeral: true, allowedMentions: { parse: [] } });
      } else if (command === 'checkins') {
        const view = this.service.checkinView(tournamentId);
        await interaction.reply({ embeds: [TournamentUI.checkinsEmbed(view, view.checkedInNames, view.missingNames)], allowedMentions: { parse: [] } });
      } else if (command === 'draw') {
        if (!this.isStaff(interaction)) return this.deny(interaction);
        const result = this.service.draw(tournamentId, interaction.user.id);
        await interaction.reply({ embeds: [TournamentUI.drawEmbed(result)], ephemeral: true, allowedMentions: { parse: [] } });
      } else if (command === 'bracket') {
        const view = this.service.restoreBracket(tournamentId);
        if (!view) {
          await interaction.reply({ content: 'Bracket chưa được bốc thăm.' });
          return;
        }
        await interaction.reply({ embeds: TournamentUI.bracketEmbeds(view), allowedMentions: { parse: [] } });
      } else if (command === 'status') {
        const tournament = this.teams.getTournament(tournamentId);
        const summary = this.service.summary(tournamentId);
        const matchCounts = summary.status === 'in_progress' && this.matches
          ? MatchUI.statusCounts(this.matches.counts(tournamentId)) : '';
        await interaction.reply({ content: TournamentUI.statusText(tournamentId, summary, tournament!.maxTeams) + matchCounts, ephemeral: true });
      }
    } catch (error) {
      if (error instanceof TournamentError) {
        await interaction.reply({ content: `⚠️ ${error.message}`, ephemeral: true });
        return;
      }
      throw error;
    }
  }

  private isStaff(interaction: ChatInputCommandInteraction): boolean {
    if (!interaction.inGuild() || !interaction.member) return false;
    const member = interaction.member as GuildMember;
    return member.permissions.has('Administrator') || isStaffMember(Array.from(member.roles.cache.keys()));
  }

  private async deny(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ content: '⛔ Chỉ Ban Tổ Chức được thực hiện thao tác này.', ephemeral: true });
  }
}
