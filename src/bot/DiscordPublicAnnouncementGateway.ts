import { ChannelType, Client, DiscordAPIError, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { getConfig } from '../config/env.js';
import type { PublicAnnouncementGateway, PublicCard } from '../publication/PublicAnnouncementGateway.js';

export class DiscordPublicAnnouncementGateway implements PublicAnnouncementGateway {
  constructor(private readonly client: Client) {}
  private async channel(id: string): Promise<TextChannel> {
    const config = getConfig();
    if (id !== config.RESULTS_CHANNEL_ID) throw new Error('Publication channel is not RESULTS_CHANNEL_ID.');
    const channel = await this.client.channels.fetch(id);
    if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== config.DISCORD_GUILD_ID)
      throw new Error('Results channel must be a GuildText channel in the configured guild.');
    const bot = this.client.user;
    const permissions = bot && channel.permissionsFor(bot.id);
    if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages) ||
        !permissions.has(PermissionFlagsBits.EmbedLinks) ||
        !permissions.has(PermissionFlagsBits.ReadMessageHistory))
      throw new Error('Bot lacks results channel view/send/embed permissions.');
    return channel as TextChannel;
  }
  private embed(card: PublicCard): EmbedBuilder {
    if (card.title.length > 256 || card.description.length > 4096 || card.footer.length > 2048 ||
        card.fields.length > 25 || (card.url?.length ?? 0) > 2048 || card.fields.some(field => field.name.length > 256 || field.value.length > 1024))
      throw new Error('Public announcement exceeds Discord embed limits.');
    const embed = new EmbedBuilder().setColor(card.color).setTitle(card.title).setDescription(card.description)
      .addFields(card.fields).setFooter({ text: card.footer });
    if (card.url) embed.setURL(card.url);
    return embed;
  }
  async publishResult(channelId: string, card: PublicCard): Promise<string> {
    return (await (await this.channel(channelId)).send({ embeds: [this.embed(card)], allowedMentions: { parse: [] } })).id;
  }
  async editResult(channelId: string, messageId: string, card: PublicCard): Promise<void> {
    await (await (await this.channel(channelId)).messages.fetch(messageId))
      .edit({ embeds: [this.embed(card)], allowedMentions: { parse: [] } });
  }
  async publishChampion(channelId: string, card: PublicCard): Promise<string> { return this.publishResult(channelId, card); }
  async editChampion(channelId: string, messageId: string, card: PublicCard): Promise<void> {
    await this.editResult(channelId, messageId, card);
  }
  async messageExists(channelId: string, messageId: string): Promise<boolean> {
    try { await (await this.channel(channelId)).messages.fetch(messageId); return true; }
    catch (error) { if (error instanceof DiscordAPIError && error.code === 10008) return false; throw error; }
  }
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await (await (await this.channel(channelId)).messages.fetch(messageId)).delete();
  }
}
