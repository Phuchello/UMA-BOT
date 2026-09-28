import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const calls = vi.hoisted(() => ({ put: vi.fn(), token: vi.fn(), client: vi.fn(), database: vi.fn(), runtime: vi.fn() }));
vi.mock('discord.js', async importOriginal => {
  const actual = await importOriginal<typeof import('discord.js')>();
  return { ...actual, Client: calls.client, REST: class {
    setToken(token: string) { calls.token(token); return this; }
    put(...args: unknown[]) { return calls.put(...args); }
  } };
});
vi.mock('node:sqlite', () => ({ DatabaseSync: calls.database }));
vi.mock('../src/database/Database.js', () => ({ createDatabase: calls.database }));
vi.mock('../src/bot/client.js', () => ({ createBotClient: calls.runtime }));
import { deployCommands } from '../src/scripts/deployCommands.js';
import { resetConfigForTesting } from '../src/config/env.js';
import { validateProductionConfig } from '../src/scripts/validateConfig.js';
import { bootstrap } from '../src/index.js';
import { installGracefulShutdown } from '../src/operations/shutdown.js';
import { errorCategory } from '../src/operations/logging.js';

const production = {
  NODE_ENV: 'production', DISCORD_TOKEN: 'synthetic-test-token',
  DISCORD_CLIENT_ID: '100000000000000001', DISCORD_GUILD_ID: '100000000000000002',
  BTC_CHANNEL_ID: '100000000000000003', REGISTRATION_CHANNEL_ID: '100000000000000004',
  REFEREE_CHANNEL_ID: '100000000000000005', RESULTS_CHANNEL_ID: '100000000000000006',
  MATCH_HUB_CHANNEL_ID: '100000000000000009', TOURNAMENT_ADMIN_ROLE_IDS: '100000000000000007',
  ACTIVE_TOURNAMENT_ID: 'offline-fixture', TOURNAMENT_NAME: 'Offline fixture',
  DATABASE_PATH: '/var/lib/uma-bot/tournament.sqlite'
};
beforeEach(() => { vi.clearAllMocks(); calls.put.mockResolvedValue([]); resetConfigForTesting(); });
afterEach(() => { vi.unstubAllEnvs(); resetConfigForTesting(); });

describe('one-shot command registration', () => {
  it('imports without registration, gateway construction, or database creation', () => {
    expect(calls.put).not.toHaveBeenCalled(); expect(calls.client).not.toHaveBeenCalled();
    expect(calls.database).not.toHaveBeenCalled(); expect(calls.runtime).not.toHaveBeenCalled();
  });
  it('registers only two guild roots using REST with no long-running runtime or state', async () => {
    vi.stubEnv('NODE_ENV', 'test'); await deployCommands();
    expect(calls.put).toHaveBeenCalledTimes(1);
    const [route, request] = calls.put.mock.calls[0];
    expect(route).toBe('/applications/100000000000000001/guilds/100000000000000002/commands');
    expect(request.body.map((command: {name: string}) => command.name)).toEqual(['uma', 'uma-caster']);
    expect(calls.client).not.toHaveBeenCalled(); expect(calls.runtime).not.toHaveBeenCalled();
    expect(calls.database).not.toHaveBeenCalled();
  });
  it('rejects invalid production IDs before a REST request', async () => {
    for (const [key, value] of Object.entries(production)) vi.stubEnv(key, value);
    vi.stubEnv('DISCORD_GUILD_ID', 'placeholder');
    await expect(deployCommands()).rejects.toThrow('DISCORD_GUILD_ID');
    expect(calls.put).not.toHaveBeenCalled(); expect(calls.token).not.toHaveBeenCalled();
  });
  it('propagates REST failures without falling through to bot startup', async () => {
    vi.stubEnv('NODE_ENV', 'test'); calls.put.mockRejectedValueOnce(new Error('synthetic failure'));
    await expect(deployCommands()).rejects.toThrow('synthetic failure');
    expect(calls.client).not.toHaveBeenCalled(); expect(calls.runtime).not.toHaveBeenCalled();
    expect(calls.database).not.toHaveBeenCalled();
  });
  it('refuses the legacy runtime --deploy switch before opening SQLite or logging in', async () => {
    const argv = process.argv; process.argv = [...argv, '--deploy'];
    try { await expect(bootstrap()).rejects.toThrow('npm run deploy:commands'); }
    finally { process.argv = argv; }
    expect(calls.database).not.toHaveBeenCalled(); expect(calls.runtime).not.toHaveBeenCalled();
    expect(calls.put).not.toHaveBeenCalled();
  });
});
describe('production preflight and logging', () => {
  it('accepts explicit production configuration offline', () => {
    expect(validateProductionConfig(production).DATABASE_PATH).toBe(production.DATABASE_PATH);
    expect(calls.database).not.toHaveBeenCalled(); expect(calls.put).not.toHaveBeenCalled();
  });
  it.each(['DATABASE_PATH','ACTIVE_TOURNAMENT_ID','TOURNAMENT_NAME'])('requires explicit %s', key => {
    const env: NodeJS.ProcessEnv = {...production}; delete env[key];
    expect(() => validateProductionConfig(env)).toThrow();
  });
  it.each([':memory:', 'data/tournament.sqlite'])('rejects disposable database %s', DATABASE_PATH => {
    expect(() => validateProductionConfig({...production, DATABASE_PATH})).toThrow('absolute');
  });
  it('does not accept test mode for a production service', () => {
    expect(() => validateProductionConfig({...production, NODE_ENV:'test'})).toThrow('production');
  });
  it('never includes error messages, request bodies, or arbitrary error names in logging categories', () => {
    const error = new Error('Authorization: secret https://private/evidence?credential=secret contact=private');
    error.name = 'DiscordAPIError[50013]'; expect(errorCategory(error)).toBe('DiscordAPIError');
    error.name = 'private-secret-name'; expect(errorCategory(error)).toBe('Error');
    expect(errorCategory({token:'secret'})).toBe('UnknownError');
  });
  it('SIGTERM closes resources and schedules exit only once, including client destroy failure', async () => {
    const listeners = new Map<string, () => void>(); const exit = vi.fn(); const close = vi.fn();
    const destroy = vi.fn().mockRejectedValue(new Error('shutdown failure'));
    const control = installGracefulShutdown({destroy, removeAllListeners: vi.fn()}, {close}, {
      once: (signal, fn) => listeners.set(signal, fn), off: signal => listeners.delete(signal), exit
    });
    const signal = listeners.get('SIGTERM')!; signal(); signal();
    await expect(control.stop()).rejects.toThrow('shutdown failure');
    await Promise.resolve();
    expect(destroy).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
describe('deployment artifacts', () => {
  it('maps package scripts to separate built entry points', () => {
    const scripts = JSON.parse(fs.readFileSync('package.json','utf8')).scripts;
    expect(scripts.start).toBe('node dist/index.js');
    expect(scripts['deploy:commands']).toBe('node dist/scripts/deployCommands.js');
    expect(scripts['config:validate']).toBe('node dist/scripts/validateConfig.js');
    const source = fs.readFileSync('src/bot/deployCommands.ts','utf8');
    expect(source).not.toMatch(/from ['"](?:.*client\.js|.*index\.js|node:sqlite)['"]/);
  });
  it('validates shell syntax without executing scripts', () => {
    const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
    for (const file of fs.readdirSync('deploy/scripts').filter(name => name.endsWith('.sh')))
      execFileSync(bash, ['-n', path.resolve('deploy/scripts',file)]);
  });
  it('keeps a single non-root direct Node service and token-free backup service', () => {
    const service = fs.readFileSync('deploy/systemd/uma-bot.service','utf8');
    expect(service).toContain('User=uma-bot'); expect(service).toContain('Restart=always');
    expect(service).toContain('ExecStart=/usr/bin/node /opt/uma-bot/current/dist/index.js');
    expect(service).toContain('KillSignal=SIGTERM'); expect(service).toContain('ProtectSystem=strict');
    expect(service).not.toContain('--deploy');
    const backup = fs.readFileSync('deploy/systemd/uma-bot-backup.service','utf8');
    expect(backup).toContain('Type=oneshot'); expect(backup).not.toContain('EnvironmentFile=');
    expect(fs.readFileSync('deploy/systemd/uma-bot-backup.timer','utf8')).toContain('Persistent=true');
  });
});
