import { errorCategory } from '../operations/logging.js';
import { AttachmentBuilder, ChannelType, Client } from 'discord.js';
import type { EvidenceGateway, EvidenceInput, ArchivedEvidence } from '../result/EvidenceGateway.js';
import type { ResultSubmission } from '../result/ResultRepository.js';
import type { MatchRecord } from '../match/MatchRepository.js';
import { ResultUI } from './ui/ResultUI.js';
import { MatchUI } from './ui/MatchUI.js';
import { MAX_EVIDENCE_BYTES } from '../result/ResultService.js';
import { getConfig } from '../config/env.js';

export class DiscordEvidenceGateway implements EvidenceGateway {
  constructor(private readonly client: Client) {}
  async archiveEvidence(match: MatchRecord, submission: ResultSubmission, input: EvidenceInput): Promise<ArchivedEvidence> {
    const url = new URL(input.url);
    if (url.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)) {
      throw new Error('Evidence source must be a Discord attachment CDN URL.');
    }
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.body) throw new Error('Could not fetch Discord attachment.');
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_EVIDENCE_BYTES) throw new Error('Evidence exceeds 10 MiB.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > MAX_EVIDENCE_BYTES) { await response.body.cancel(); throw new Error('Evidence exceeds 10 MiB.'); }
      chunks.push(chunk);
    }
    if (length === 0 || length !== input.size) throw new Error('Evidence download size differs from Discord attachment metadata.');
    const bytes = Buffer.concat(chunks);
    const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!(input.contentType === 'image/png' && png || input.contentType === 'image/jpeg' && jpeg ||
          input.contentType === 'image/webp' && webp)) throw new Error('Evidence bytes do not match image type.');
    const filename = `uma-result-${submission.id}.${input.contentType === 'image/png' ? 'png' : input.contentType === 'image/webp' ? 'webp' : 'jpg'}`;
    const thread = await this.thread(match.room!.threadId);
    const message = await thread.send({ files: [new AttachmentBuilder(bytes, { name: filename })],
      embeds: [ResultUI.evidenceEmbed(match, submission)], components: ResultUI.evidenceButtons(submission),
      allowedMentions: { parse: [] } });
    const attachment = message.attachments.first();
    if (!attachment) {
      await message.delete().catch(error => console.error(`Orphan evidence message ${message.id} cleanup failed`, errorCategory(error)));
      throw new Error(`Evidence message ${message.id} has no uploaded attachment.`);
    }
    return { messageId: message.id, attachmentId: attachment.id, filename: attachment.name,
      contentType: input.contentType!, size: attachment.size };
  }
  async editEvidenceCard(match: MatchRecord, submission: ResultSubmission): Promise<void> {
    const thread = await this.thread(match.room!.threadId);
    const message = await thread.messages.fetch(submission.evidenceMessageId!);
    await message.edit({ embeds: [ResultUI.evidenceEmbed(match, submission)], components: ResultUI.evidenceButtons(submission),
      attachments: [...message.attachments.values()], allowedMentions: { parse: [] } });
  }
  async editMatchStarter(match: MatchRecord): Promise<void> {
    const thread = await this.thread(match.room!.threadId);
    const message = await thread.messages.fetch(match.room!.starterMessageId);
    await message.edit({ embeds: [MatchUI.starterEmbed(match)], components: MatchUI.starterButtons(match),
      allowedMentions: { parse: [] } });
  }
  async deleteEvidenceMessage(threadId: string, messageId: string): Promise<void> {
    const thread = await this.thread(threadId);
    await (await thread.messages.fetch(messageId)).delete();
  }
  private async thread(id: string) {
    const channel = await this.client.channels.fetch(id);
    if (!channel?.isThread() || channel.type !== ChannelType.PrivateThread ||
        channel.guildId !== getConfig().DISCORD_GUILD_ID) throw new Error('Evidence room is not a private thread in the configured guild.');
    return channel;
  }
}
