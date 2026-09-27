import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const isTestOrCI = process.env.NODE_ENV === 'test' || process.env.CI === 'true';

const envSchema = z.object({
  DISCORD_TOKEN: isTestOrCI
    ? z.string().default('mock_discord_token_ci_test')
    : z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: isTestOrCI
    ? z.string().default('123456789012345678')
    : z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_GUILD_ID: isTestOrCI
    ? z.string().default('1435278955941986540')
    : z.string().min(1, 'DISCORD_GUILD_ID is required'),
  ACTIVE_TOURNAMENT_ID: z.string().default('uma-cup-2027'),
  BTC_CHANNEL_ID: z.string().default('1553333896307810325'),
  REGISTRATION_CHANNEL_ID: z.string().default('1553333598747365386'),
  REFEREE_CHANNEL_ID: z.string().default('1553333901122871366'),
  RESULTS_CHANNEL_ID: z.string().default('1553333608461369394'),
  TOURNAMENT_ADMIN_ROLE_IDS: z.string().default('1435282052445638706,1435283592657244243'),
  DATABASE_PATH: z.string().default('data/tournament.sqlite'),
  DEFAULT_GAME: z.string().default('Liên Quân Mobile'),
  MAX_TEAMS: z.coerce.number().default(16),
  STARTERS_COUNT: z.coerce.number().default(5),
  MAX_SUBSTITUTES: z.coerce.number().default(2)
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!parsedConfig) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Environment configuration error: ${errors}`);
    }
    parsedConfig = parsed.data;
  }
  return parsedConfig;
}

export function resetConfigForTesting(): void {
  parsedConfig = null;
}

export function isStaffMember(roleIds: string[]): boolean {
  const config = getConfig();
  const allowed = config.TOURNAMENT_ADMIN_ROLE_IDS.split(',').map(s => s.trim());
  return roleIds.some(r => allowed.includes(r));
}
