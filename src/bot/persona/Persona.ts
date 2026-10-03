import { PersonaConfig, PersonaIntensityLevel } from './types.js';
import { messages } from './messages.js';
import { railgunFooter, arenaFooter, safeText } from './formatters.js';

export class Persona {
  private static instance: Persona | null = null;
  private config: PersonaConfig;

  constructor(config?: Partial<PersonaConfig>) {
    const envEnabled = process.env.BOT_PERSONA_ENABLED !== 'false';
    const envLevel = (process.env.BOT_PERSONA_LEVEL as PersonaIntensityLevel) || 'normal';

    this.config = {
      enabled: config?.enabled ?? envEnabled,
      level: config?.level ?? (['serious', 'normal', 'showtime'].includes(envLevel) ? envLevel : 'normal')
    };
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
