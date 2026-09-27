export interface PublicCard {
  title: string; description: string; fields: { name: string; value: string; inline?: boolean }[];
  footer: string; color: number; url?: string;
}
export interface PublicAnnouncementGateway {
  publishResult(channelId: string, card: PublicCard): Promise<string>;
  editResult(channelId: string, messageId: string, card: PublicCard): Promise<void>;
  publishChampion(channelId: string, card: PublicCard): Promise<string>;
  editChampion(channelId: string, messageId: string, card: PublicCard): Promise<void>;
  messageExists(channelId: string, messageId: string): Promise<boolean>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
}
