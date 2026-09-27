import type { MatchRecord } from './MatchRepository.js';

/** Discord operations are isolated from match state and can be faked in tests. */
export interface MatchRoomGateway {
  createPrivateThread(parentChannelId: string, name: string): Promise<string>;
  addMember(threadId: string, discordUserId: string): Promise<void>;
  sendStarterMessage(threadId: string, match: MatchRecord): Promise<string>;
  editStarterMessage(threadId: string, messageId: string, match: MatchRecord): Promise<void>;
  fetchThread(threadId: string): Promise<boolean>;
  deleteThread(threadId: string): Promise<void>;
}
