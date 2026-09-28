import { REST, Routes } from 'discord.js';
import { getConfig } from '../config/env.js';
import { umaCommand, umaCasterCommand } from './commands/umaCommand.js';

// REST only: never import client.ts, index.ts, or SQLite here.
export async function deployCommands(): Promise<void> {
  const config = getConfig();
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  console.log(`Registering guild commands for ${config.DISCORD_GUILD_ID}...`);
  await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body: [umaCommand.toJSON(), umaCasterCommand.toJSON()] });
  console.log('Guild commands registered; no gateway runtime started.');
}
