import { AttachmentBuilder } from 'discord.js';
import {
  PersonaConfig,
  PersonaIntensityLevel,
  ReactionAttachment,
  ReactionMood,
  ReactionPickOptions
} from './types.js';
import { messages } from './messages.js';
import { railgunFooter, arenaFooter, safeText } from './formatters.js';
import { ReactionPicker } from './ReactionPicker.js';

export class Persona {
  private static instance: Persona | null = null;
  private config: PersonaConfig;
  private picker: ReactionPicker;

  constructor(config?: Partial<PersonaConfig>) {
    const envEnabled = process.env.BOT_PERSONA_ENABLED !== 'false';
    const envLevel = (process.env.BOT_PERSONA_LEVEL as PersonaIntensityLevel) || 'normal';
    const envGifsEnabled = process.env.BOT_PERSONA_GIFS_ENABLED !== 'false';
    const envGifLevel = (process.env.BOT_PERSONA_GIF_LEVEL as 'off' | 'normal' | 'high') || 'normal';

    this.config = {
      enabled: config?.enabled ?? envEnabled,
      level: config?.level ?? (['serious', 'normal', 'showtime'].includes(envLevel) ? envLevel : 'normal'),
      gifsEnabled: config?.gifsEnabled ?? envGifsEnabled,
      gifLevel: config?.gifLevel ?? (['off', 'normal', 'high'].includes(envGifLevel) ? envGifLevel : 'normal'),
      mediaDir: config?.mediaDir ?? process.env.BOT_PERSONA_MEDIA_DIR
    };

    this.picker = new ReactionPicker(undefined, {
      enabled: this.config.enabled,
      gifsEnabled: this.config.gifsEnabled,
      gifLevel: this.config.gifLevel,
      mediaDir: this.config.mediaDir
    });
  }

  public static get(): Persona {
    if (!Persona.instance) {
      Persona.instance = new Persona();
    }
    return Persona.instance;
  }

  public static resetForTesting(config?: Partial<PersonaConfig>): void {
    Persona.instance = new Persona(config);
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getLevel(): PersonaIntensityLevel {
    return this.config.level;
  }

  public setLevel(level: PersonaIntensityLevel): void {
    this.config.level = level;
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.picker.setConfig({ enabled });
  }

  public get reactions(): ReactionPicker {
    return this.picker;
  }

  public pickReaction(
    mood: ReactionMood,
    intensity: PersonaIntensityLevel = this.config.level,
    options?: ReactionPickOptions
  ): ReactionAttachment | null {
    return this.picker.pick(mood, intensity, options);
  }

  public createReactionAttachment(reaction: ReactionAttachment): AttachmentBuilder {
    return this.picker.createAttachment(reaction);
  }

  public reactionAttachment(
    mood: ReactionMood,
    intensity: PersonaIntensityLevel = this.config.level,
    options?: ReactionPickOptions
  ): AttachmentBuilder | null {
    const picked = this.pickReaction(mood, intensity, options);
    return picked ? this.createReactionAttachment(picked) : null;
  }

  public get messages() {
    return messages;
  }

  public footer(context?: string): string {
    return railgunFooter(context);
  }

  public arenaFooter(context?: string): string {
    return arenaFooter(context);
  }

  public safe(value: string, limit = 80): string {
    return safeText(value, limit);
  }
}

export const persona = Persona.get();
