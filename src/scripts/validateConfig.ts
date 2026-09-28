import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { parseConfig, type EnvConfig } from '../config/env.js';

export function validateProductionConfig(env: NodeJS.ProcessEnv): EnvConfig {
  if (env.NODE_ENV !== 'production') throw new Error('NODE_ENV must be production.');
  const config = parseConfig(env);
  if (!env.ACTIVE_TOURNAMENT_ID?.trim() || !env.TOURNAMENT_NAME?.trim())
    throw new Error('Explicit ACTIVE_TOURNAMENT_ID and TOURNAMENT_NAME are required.');
  if (!env.DATABASE_PATH || !path.isAbsolute(config.DATABASE_PATH))
    throw new Error('DATABASE_PATH must be an explicit absolute persistent path.');
  return config;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    let env: NodeJS.ProcessEnv = process.env;
    let expected: string | undefined;
    while (args.length) {
      const option = args.shift(); const value = args.shift();
      if (!value) throw new Error('Missing validation argument.');
      if (option === '--env-file') env = dotenv.parse(fs.readFileSync(value));
      else if (option === '--expect-database') expected = value;
      else throw new Error('Unknown validation argument.');
    }
    const config = validateProductionConfig(env);
    if (expected && config.DATABASE_PATH !== expected) throw new Error('Unexpected database layout.');
    console.log('Production configuration valid (offline; no database opened, no Discord connection).');
  } catch {
    console.error('Production configuration invalid. Check required fields, IDs and absolute DATABASE_PATH. Values are not logged.');
    process.exitCode = 1;
  }
}
