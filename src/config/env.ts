import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const discordId = z.string().trim().regex(/^\d{17,20}$/, 'must be a 17–20 digit Discord ID');
const staffRoleIds = z.string().trim().refine(
  value => value.split(',').every(id => discordId.safeParse(id.trim()).success),
  'must be one or more comma-separated Discord role IDs'
);

function createEnvSchema(isTest: boolean) {
  return z.object({
    DISCORD_TOKEN: isTest
      ? z.string().trim().min(1).default('mock_discord_token_test')
      : z.string().trim().min(1, 'DISCORD_TOKEN is required'),
    DISCORD_CLIENT_ID: isTest ? discordId.default('100000000000000001') : discordId,
    DISCORD_GUILD_ID: isTest ? discordId.default('100000000000000002') : discordId,
    ACTIVE_TOURNAMENT_ID: z.string().default('uma-cup-2027'),
    TOURNAMENT_NAME: z.string().default('UMA Cup 2027'),
    BTC_CHANNEL_ID: isTest ? discordId.default('100000000000000003') : discordId,
    REGISTRATION_CHANNEL_ID: isTest ? discordId.default('100000000000000004') : discordId,
    MATCH_HUB_CHANNEL_ID: isTest ? discordId.default('100000000000000009') : discordId,
    REFEREE_CHANNEL_ID: isTest ? discordId.default('100000000000000005') : discordId,
    RESULTS_CHANNEL_ID: isTest ? discordId.default('100000000000000006') : discordId,
    TOURNAMENT_ADMIN_ROLE_IDS: isTest
      ? staffRoleIds.default('100000000000000007,100000000000000008')
      : staffRoleIds,
    DATABASE_PATH: z.string().default('data/tournament.sqlite'),
    DEFAULT_GAME: z.string().default('Liên Quân Mobile'),
    MAX_TEAMS: z.coerce.number().default(16),
    STARTERS_COUNT: z.coerce.number().default(5),
    MAX_SUBSTITUTES: z.coerce.number().default(2),
    BOT_PERSONA_ENABLED: z.coerce.boolean().default(true),
    BOT_PERSONA_LEVEL: z.enum(['serious', 'normal', 'showtime']).default('normal'),
    BOT_PERSONA_GIFS_ENABLED: z.coerce.boolean().default(true),
    BOT_PERSONA_GIF_LEVEL: z.enum(['off', 'normal', 'high']).default('normal'),
    BOT_PERSONA_MEDIA_DIR: z.string().default('/var/lib/uma-bot/media/misaka')
  });
}


export type EnvConfig = z.infer<ReturnType<typeof createEnvSchema>>;

let parsedConfig: EnvConfig | null = null;

export function parseConfig(env: NodeJS.ProcessEnv): EnvConfig {
  const parsed = createEnvSchema(env.NODE_ENV === 'test').safeParse(env);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Environment configuration error: ${errors}`);
  }
  return parsed.data;
}

export function getConfig(): EnvConfig {
  if (!parsedConfig) parsedConfig = parseConfig(process.env);
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
