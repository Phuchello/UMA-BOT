import { ChannelType, Client, TextChannel } from 'discord.js';
import type { MatchRecord } from '../match/MatchRepository.js';
import type { MatchRoomGateway } from '../match/MatchRoomGateway.js';
import { MatchUI } from './ui/MatchUI.js';
import { getConfig } from '../config/env.js';

export class DiscordMatchRoomGateway implements MatchRoomGateway {
  constructor(private readonly client: Client) {}

  public async createPrivateThread(parentChannelId: string, name: string): Promise<string> {
    const parent = await this.client.channels.fetch(parentChannelId);
    if (!parent || parent.type !== ChannelType.GuildText || parent.guildId !== getConfig().DISCORD_GUILD_ID) {
      throw new Error('Match hub must be a text channel in the configured guild.');
    }
    const thread = await (parent as TextChannel).threads.create({ name, type: ChannelType.PrivateThread, invitable: false });
    return thread.id;
  }

  public async addMember(threadId: string, discordUserId: string): Promise<void> {
    const thread = await this.thread(threadId);
    await thread.members.add(discordUserId);
  }

  public async sendStarterMessage(threadId: string, match: MatchRecord): Promise<string> {
    const thread = await this.thread(threadId);
    const message = await thread.send({ embeds: [MatchUI.starterEmbed(match)], components: MatchUI.starterButtons(match),
      allowedMentions: { parse: [] } });
    return message.id;
  }

  public async editStarterMessage(threadId: string, messageId: string, match: MatchRecord): Promise<void> {
    const thread = await this.thread(threadId);
    const message = await thread.messages.fetch(messageId);
    await message.edit({ embeds: [MatchUI.starterEmbed(match)], components: MatchUI.starterButtons(match),
      allowedMentions: { parse: [] } });
  }

  public async fetchThread(threadId: string): Promise<boolean> {
    const channel = await this.client.channels.fetch(threadId);
    return !!channel?.isThread();
  }

  public async deleteThread(threadId: string): Promise<void> {
    const thread = await this.thread(threadId);
    await thread.delete('Compensating failed match-room persistence');
  }

  private async thread(id: string) {
    const channel = await this.client.channels.fetch(id);
    if (!channel?.isThread() || channel.type !== ChannelType.PrivateThread) {
      throw new Error(`Private match thread ${id} not found.`);
    }
    return channel;
  }
}
