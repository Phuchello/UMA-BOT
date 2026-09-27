import { ChannelType, Client, PermissionFlagsBits } from 'discord.js';
import type { EnvConfig } from '../config/env.js';
import type { ReadinessCheck, ResourceProbe } from '../operations/ProductionReadinessService.js';

export class DiscordResourceProbe implements ResourceProbe {
  constructor(private readonly client: Client) {}
  async check(config: EnvConfig): Promise<ReadinessCheck[]> {
    const checks: ReadinessCheck[] = [];
    const guild = await this.client.guilds.fetch(config.DISCORD_GUILD_ID).catch(() => null);
    if (!guild) return [{ level: 'FAIL', label: 'Discord guild', detail: 'Không tìm thấy guild đã cấu hình.' }];
    checks.push({ level: 'PASS', label: 'Discord guild', detail: 'Đã xác minh guild.' });
    const channelIds = [
      ['BTC_CHANNEL_ID',config.BTC_CHANNEL_ID], ['REGISTRATION_CHANNEL_ID',config.REGISTRATION_CHANNEL_ID],
      ['MATCH_HUB_CHANNEL_ID',config.MATCH_HUB_CHANNEL_ID], ['REFEREE_CHANNEL_ID',config.REFEREE_CHANNEL_ID],
      ['RESULTS_CHANNEL_ID',config.RESULTS_CHANNEL_ID]
    ];
    for (const [label,id] of channelIds) {
      const channel = await this.client.channels.fetch(id).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== guild.id) {
        checks.push({ level: 'FAIL', label, detail: 'Thiếu kênh văn bản hoặc kênh thuộc guild khác.' });
        continue;
      }
      const permissions = this.client.user && channel.permissionsFor(this.client.user.id);
      const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory];
      if (label === 'MATCH_HUB_CHANNEL_ID') required.push(PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ManageThreads);
      if (label === 'MATCH_HUB_CHANNEL_ID') required.push(PermissionFlagsBits.AttachFiles);
      checks.push(required.every(permission => permissions?.has(permission))
        ? { level: 'PASS', label, detail: 'Kênh và quyền cần thiết hợp lệ.' }
        : { level: 'FAIL', label, detail: 'Bot thiếu quyền xem/gửi/embed hoặc quyền phòng trận.' });
    }
    for (const id of config.TOURNAMENT_ADMIN_ROLE_IDS.split(',').map(value => value.trim())) {
      const role = await guild.roles.fetch(id).catch(() => null);
      checks.push(role ? { level: 'PASS', label: 'Staff role', detail: 'Vai trò BTC đã xác minh.' }
        : { level: 'FAIL', label: 'Staff role', detail: 'Không tìm thấy vai trò BTC đã cấu hình.' });
    }
    const bot = await guild.members.fetchMe().catch(() => null);
    checks.push(bot?.permissions.has(PermissionFlagsBits.Administrator)
      ? { level: 'WARN', label: 'Administrator', detail: 'Bot có Administrator; nên dùng quyền tối thiểu.' }
      : { level: 'PASS', label: 'Administrator', detail: 'Bot không yêu cầu Administrator.' });
    return checks;
  }
}
