import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { getConfig, isStaffMember } from '../../config/env.js';
import { PublicationService } from '../../publication/PublicationService.js';
import { StreamService } from '../../stream/StreamService.js';
import { ResultService } from '../../result/ResultService.js';
import { ProductionReadinessService } from '../../operations/ProductionReadinessService.js';

const safe = (value: string, limit = 150): string => value.slice(0, limit).replace(/[\r\n]/g, ' ')
  .replace(/@/g, '@\u200b').replace(/[`*_~|]/g, '\\$&');
export class OperationsHandler {
  constructor(private readonly publication: PublicationService, private readonly streams: StreamService,
    private readonly results: ResultService, private readonly doctor: ProductionReadinessService) {}
  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const tid = getConfig().ACTIVE_TOURNAMENT_ID;
    const staff = this.isStaff(interaction);
    const round = () => interaction.options.getInteger('round', true);
    const number = () => interaction.options.getInteger('match', true);
    try {
      if (sub === 'stream') {
        const { match, stream, casters } = this.streams.view(tid, round(), number());
        const embed = new EmbedBuilder().setTitle(`📺 UMA CUP — R${match.round}-M${match.number}`)
          .setDescription(`${safe(match.team1?.name ?? 'Chờ xác định')} vs ${safe(match.team2?.name ?? 'Chờ xác định')}`)
          .addFields(
            { name: 'Trạng thái', value: match.status },
            { name: 'Lịch', value: match.scheduledAt ? `<t:${Math.floor(match.scheduledAt / 1000)}:F>` : 'Chưa lên lịch' },
            { name: 'Livestream / VOD', value: stream ? 'Nhấn tiêu đề để mở liên kết.' : 'Chưa có' },
            { name: 'Caster', value: casters.length ? casters.slice(0, 20).map(c => `<@${c.casterId}>`).join(', ') : 'Chưa có' });
        if (stream) embed.setURL(stream.url);
        if (stream?.title) embed.addFields({ name: 'Tiêu đề', value: safe(stream.title, 100) });
        await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
        return;
      }
      if (!staff) { await interaction.reply({ content: '⚠️ Chỉ Ban Tổ Chức được thực hiện thao tác này.', ephemeral: true }); return; }
      await interaction.deferReply({ ephemeral: true });
      if (sub === 'publish-sync') {
        const result = await this.publication.sync(tid, staff);
        await interaction.editReply(`🏆 Đồng bộ kết quả: mới ${result.created} • cập nhật ${result.updated} • không đổi ${result.unchanged} • lỗi ${result.failed}.`);
      } else if (sub === 'result-correct') {
        const result = await this.results.correct(tid, round(), number(), interaction.options.getInteger('team1-score', true),
          interaction.options.getInteger('team2-score', true), interaction.options.getString('reason', true),
          interaction.options.getBoolean('confirm', true), interaction.user.id, staff);
        await interaction.editReply(`✅ Đã hiệu chỉnh R${round()}-M${number()} thành ${result.team1Score}–${result.team2Score} (revision ${result.revision}). Chạy /uma publish-sync để cập nhật công khai.`);
      } else if (sub === 'result-history') {
        const { canonical, corrections } = this.results.history(tid, round(), number(), staff);
        const original = corrections[0];
        const lines = [`Kết quả gốc: ${original?.oldTeam1Score ?? canonical.team1Score}–${original?.oldTeam2Score ?? canonical.team2Score}`,
          ...corrections.map(item => `#${item.number}: ${item.oldTeam1Score}–${item.oldTeam2Score} → ${item.newTeam1Score}–${item.newTeam2Score} • ${safe(item.reason, 160)} • BTC ${item.actorId}`),
          `Hiện tại: ${canonical.team1Score}–${canonical.team2Score} • revision ${canonical.revision}`];
        await interaction.editReply(`📜 R${round()}-M${number()}\n${lines.join('\n')}`.slice(0, 1900));
      } else if (sub === 'stream-set') {
        const saved = this.streams.set(tid, round(), number(), interaction.options.getString('url', true),
          interaction.options.getString('title'), interaction.user.id, staff);
        await interaction.editReply(`📺 Đã lưu livestream/VOD: ${saved.url}`);
      } else if (sub === 'stream-clear') {
        const removed = this.streams.clear(tid, round(), number(), staff);
        await interaction.editReply(removed ? '✅ Đã xóa liên kết livestream/VOD; caster vẫn được giữ.' : 'ℹ️ Trận chưa có liên kết livestream/VOD.');
      } else if (sub === 'doctor') {
        await interaction.editReply(ProductionReadinessService.format(await this.doctor.run(staff)));
      } else if (interaction.commandName === 'uma-caster' && sub === 'add') {
        const added = this.streams.addCaster(tid, round(), number(), interaction.options.getUser('caster', true).id, interaction.user.id, staff);
        await interaction.editReply(added ? '🎙️ Đã gán caster.' : 'ℹ️ Caster đã được gán trước đó.');
      } else if (interaction.commandName === 'uma-caster' && sub === 'remove') {
        const removed = this.streams.removeCaster(tid, round(), number(), interaction.options.getUser('caster', true).id, staff);
        await interaction.editReply(removed ? '✅ Đã gỡ caster.' : 'ℹ️ Caster chưa được gán.');
      }
    } catch (error) {
      const message = error instanceof Error && 'code' in error ? error.message : 'Không thể xử lý yêu cầu. BTC hãy kiểm tra dữ liệu.';
      if (interaction.deferred) await interaction.editReply(`⚠️ ${message}`);
      else if (!interaction.replied) await interaction.reply({ content: `⚠️ ${message}`, ephemeral: true });
    }
  }
  private isStaff(interaction: ChatInputCommandInteraction): boolean {
    if (!interaction.inGuild() || !interaction.member) return false;
    const member = interaction.member as GuildMember;
    return member.permissions.has('Administrator') || isStaffMember(Array.from(member.roles.cache.keys()));
  }
}
