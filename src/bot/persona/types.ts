export type PersonaIntensityLevel = 'serious' | 'normal' | 'showtime';

export type ReactionMood =
  | 'confident'
  | 'annoyed'
  | 'smug'
  | 'waiting'
  | 'surprised'
  | 'electric'
  | 'hype'
  | 'victory'
  | 'checking'
  | 'embarrassed';

export interface ReactionItem {
  file: string;
  sha256: string;
  source?: string;
  description: string;
  size: number;
  width: number;
  height: number;
  frames: number;
}

export type ReactionCatalog = Partial<Record<ReactionMood, ReactionItem[]>>;

export interface ReactionAttachment {
  filePath: string;
  fileName: string;
  description: string;
  mood: ReactionMood;
  sha256: string;
}

export interface ReactionPickOptions {
  force?: boolean;
  rng?: () => number;
}

export interface PersonaConfig {
  enabled: boolean;
  level: PersonaIntensityLevel;
  gifsEnabled?: boolean;
  gifLevel?: 'off' | 'normal' | 'high';
  mediaDir?: string;
}
