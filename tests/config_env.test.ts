import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config/env.js';

const resourceIds = [
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'BTC_CHANNEL_ID',
  'REGISTRATION_CHANNEL_ID',
  'MATCH_HUB_CHANNEL_ID',
  'REFEREE_CHANNEL_ID',
  'RESULTS_CHANNEL_ID',
  'TOURNAMENT_ADMIN_ROLE_IDS'
] as const;

const configuredEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  CI: 'true',
  DISCORD_TOKEN: 'test-only-token',
  DISCORD_CLIENT_ID: '100000000000000001',
  DISCORD_GUILD_ID: '100000000000000002',
  BTC_CHANNEL_ID: '100000000000000003',
  REGISTRATION_CHANNEL_ID: '100000000000000004',
  MATCH_HUB_CHANNEL_ID: '100000000000000009',
  REFEREE_CHANNEL_ID: '100000000000000005',
  RESULTS_CHANNEL_ID: '100000000000000006',
  TOURNAMENT_ADMIN_ROLE_IDS: '100000000000000007, 100000000000000008'
};

describe('Discord resource ID configuration', () => {
  it('accepts explicit IDs outside tests, including under CI', () => {
    const config = parseConfig(configuredEnv);
    expect(config.DISCORD_GUILD_ID).toBe(configuredEnv.DISCORD_GUILD_ID);
    expect(config.TOURNAMENT_ADMIN_ROLE_IDS).toBe(configuredEnv.TOURNAMENT_ADMIN_ROLE_IDS);
  });

  it.each(resourceIds)('requires %s outside tests', key => {
    const env = { ...configuredEnv };
    delete env[key];
    expect(() => parseConfig(env)).toThrow(key);
  });

  it('does not treat CI=true as test mode', () => {
    expect(() => parseConfig({ CI: 'true' })).toThrow('DISCORD_GUILD_ID');
  });

  it('rejects placeholders and malformed role lists', () => {
    expect(() => parseConfig({ ...configuredEnv, BTC_CHANNEL_ID: 'your_btc_channel_id' }))
      .toThrow('BTC_CHANNEL_ID');
    expect(() => parseConfig({ ...configuredEnv, TOURNAMENT_ADMIN_ROLE_IDS: '100000000000000007,' }))
      .toThrow('TOURNAMENT_ADMIN_ROLE_IDS');
  });

  it('uses synthetic defaults only when NODE_ENV=test', () => {
    const config = parseConfig({ NODE_ENV: 'test' });
    for (const key of resourceIds) expect(config[key]).toBeTruthy();
    expect(config.DISCORD_GUILD_ID).toBe('100000000000000002');
    expect(config.BTC_CHANNEL_ID).toBe('100000000000000003');
  });
});
