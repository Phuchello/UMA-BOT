import { ButtonInteraction, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { getConfig, isStaffMember } from '../../config/env.js';
import { MatchError, MatchService } from '../../match/MatchService.js';
import { MatchUI } from '../ui/MatchUI.js';

export class MatchHandler {
  constructor(private readonly service: MatchService) {}

  public async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const tournamentId = getConfig().ACTIVE_TOURNAMENT_ID;
    const staff = this.isStaff(interaction);
    try {
      if (sub === 'start') {
        const counts = this.service.startTournament(tournamentId, interaction.user.id, staff);
        await interaction.reply({ content: `▶️ Giải đấu đã bắt đầu. ${counts.READY} trận sẵn sàng mở phòng, ${counts.WAITING} trận chờ xác định đội.`, ephemeral: true });
      } else if (sub === 'match-referee') {
        if (!staff) throw new MatchError('NOT_STAFF', 'Chỉ Ban Tổ Chức được thực hiện thao tác này.');
        await interaction.deferReply({ ephemeral: true });
        const round = interaction.options.getInteger('round', true);
        const number = interaction.options.getInteger('match', true);
        const referee = interaction.options.getUser('referee', true);
        const added = await this.service.assignReferee(tournamentId, round, number, referee.id, interaction.user.id, staff);
        await interaction.editReply(added
          ? `✅ Đã gán trọng tài cho R${round}-M${number}.`
          : `ℹ️ Trọng tài đã được gán cho R${round}-M${number} trước đó.`);
      } else if (sub === 'rooms-create') {
        if (!staff) throw new MatchError('NOT_STAFF', 'Chỉ Ban Tổ Chức được thực hiện thao tác này.');
        await interaction.deferReply({ ephemeral: true });
        const result = await this.service.createRooms(tournamentId, getConfig().MATCH_HUB_CHANNEL_ID, interaction.user.id, staff);
        await interaction.editReply(`🏠 Phòng mới: ${result.created} • Đã có: ${result.alreadyExisting} • Chờ đội: ${result.skippedWaiting} • Thiếu trọng tài: ${result.skippedMissingReferee} • Thiếu dữ liệu: ${result.skippedInvalid} • Lỗi: ${result.failures}`);
      } else if (sub === 'match-schedule') {
        if (!staff) throw new MatchError('NOT_STAFF', 'Chỉ Ban Tổ Chức được thực hiện thao tác này.');
        await interaction.deferReply({ ephemeral: true });
        const round = interaction.options.getInteger('round', true);
        const number = interaction.options.getInteger('match', true);
        const time = interaction.options.getString('time', true);
        const match = await this.service.schedule(tournamentId, round, number, time, interaction.user.id, staff);
        await interaction.editReply(`📅 R${round}-M${number} đã lên lịch: <t:${Math.floor(match.scheduledAt! / 1000)}:F> (<t:${Math.floor(match.scheduledAt! / 1000)}:R>).`);
      } else if (sub === 'matches') {
        await interaction.reply({ embeds: MatchUI.publicMatchEmbeds(this.service.list(tournamentId)), allowedMentions: { parse: [] } });
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
        await interaction.editReply(result.repeated ? 'ℹ️ Đội của bạn đã xác nhận sẵn sàng trước đó.'
          : result.match.status === 'READY_TO_START' ? '✅ Hai đội đã sẵn sàng. Trọng tài có thể bắt đầu trận.'
          : '✅ Đội của bạn đã xác nhận sẵn sàng.');
      } else {
        await this.service.startMatch(tournamentId, matchId, interaction.channelId, interaction.user.id, this.isStaff(interaction));
        await interaction.editReply('🔴 Trận đấu đã bắt đầu. Dùng /uma report-result và đính kèm ảnh kết quả.');
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
    const content = `⚠️ ${error.message}`;
    if (interaction.deferred) await interaction.editReply(content);
    else await interaction.reply({ content, ephemeral: true });
  }
}
