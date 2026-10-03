import { AttachmentBuilder } from 'discord.js';
import { ReactionMedia } from './ReactionMedia.js';
import {
  PersonaIntensityLevel,
  ReactionAttachment,
  ReactionMood,
  ReactionPickOptions
} from './types.js';

export interface ReactionPickerConfig {
  enabled: boolean;
  gifsEnabled: boolean;
  gifLevel: 'off' | 'normal' | 'high';
  mediaDir?: string;
}

export class ReactionPicker {
  private media: ReactionMedia;
  private config: ReactionPickerConfig;
  private recentPicks: string[] = [];
  private static readonly MAX_RECENT_HISTORY = 4;

  constructor(media?: ReactionMedia, config?: Partial<ReactionPickerConfig>) {
    this.media = media ?? new ReactionMedia(config?.mediaDir);

    const envEnabled = process.env.BOT_PERSONA_ENABLED !== 'false';
    const envGifsEnabled = process.env.BOT_PERSONA_GIFS_ENABLED !== 'false';
    const envGifLevel = (process.env.BOT_PERSONA_GIF_LEVEL as 'off' | 'normal' | 'high') || 'normal';

    this.config = {
      enabled: config?.enabled ?? envEnabled,
      gifsEnabled: config?.gifsEnabled ?? envGifsEnabled,
      gifLevel: config?.gifLevel ?? (['off', 'normal', 'high'].includes(envGifLevel) ? envGifLevel : 'normal'),
      mediaDir: config?.mediaDir
    };
  }

  public getMedia(): ReactionMedia {
    return this.media;
  }

  public setConfig(config: Partial<ReactionPickerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.mediaDir !== undefined) {
      this.media.init(config.mediaDir);
    }
  }

  public resetHistory(): void {
    this.recentPicks = [];
  }

  /**
   * Determine probability threshold based on intensity and config.
   * SERIOUS: Strictly 0% (absolute policy invariant).
   * NORMAL: 35% default (high: 50%).
   * SHOWTIME: 75% default (high: 90%).
   */
  public getProbability(intensity: PersonaIntensityLevel): number {
    if (intensity === 'serious') return 0.0;
    if (!this.config.enabled || !this.config.gifsEnabled || this.config.gifLevel === 'off') return 0.0;

    if (intensity === 'showtime') {
      return this.config.gifLevel === 'high' ? 0.90 : 0.75;
    }

    // Default 'normal'
    return this.config.gifLevel === 'high' ? 0.50 : 0.35;
  }

  /**
   * Pick a reaction GIF matching the given mood and intensity.
   * Guaranteed to return null for serious flows.
   */
  public pick(
    mood: ReactionMood,
    intensity: PersonaIntensityLevel = 'normal',
    options?: ReactionPickOptions
  ): ReactionAttachment | null {
    // 1. Invariant: SERIOUS flows NEVER have reaction GIFs
    if (intensity === 'serious') {
      return null;
    }

    // 2. Persona or GIF toggle disabled
    if (!this.config.enabled || !this.config.gifsEnabled || this.config.gifLevel === 'off') {
      return null;
    }

    // 3. Roll probability check (unless force is requested for test/guaranteed injection)
    if (!options?.force) {
      const probability = this.getProbability(intensity);
      if (probability <= 0.0) return null;

      const rng = options?.rng ?? Math.random;
      const roll = rng();
      if (roll >= probability) {
        return null;
      }
    }

    // 4. Retrieve candidate items from catalog
    const items = this.media.getItems(mood);
    if (!items || items.length === 0) {
      return null;
    }

    // 5. Anti-repetition: filter out recently chosen files if alternatives exist
    const unusedItems = items.filter(item => !this.recentPicks.includes(item.file));
    const pool = unusedItems.length > 0 ? unusedItems : items;

    const rng = options?.rng ?? Math.random;
    const selectedIndex = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    const selected = pool[selectedIndex];

    if (!selected) {
      return null;
    }

    // 6. Resolve absolute file path and verify file exists safely
    const absolutePath = this.media.resolveFilePath(selected);
    if (!absolutePath) {
      return null;
    }

    // 7. Update recent history ring buffer
    this.recentPicks.push(selected.file);
    if (this.recentPicks.length > ReactionPicker.MAX_RECENT_HISTORY) {
      this.recentPicks.shift();
    }

    return {
      filePath: absolutePath,
      fileName: 'reaction.gif',
      description: selected.description,
      mood,
      sha256: selected.sha256
    };
  }

  /**
   * Helper to create a Discord AttachmentBuilder from a reaction attachment.
   */
  public createAttachment(reaction: ReactionAttachment): AttachmentBuilder {
    return new AttachmentBuilder(reaction.filePath, {
      name: reaction.fileName,
      description: reaction.description
    });
  }
}
