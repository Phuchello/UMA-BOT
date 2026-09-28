import { pathToFileURL } from 'node:url';
import { deployCommands } from '../bot/deployCommands.js';
import { errorCategory } from '../operations/logging.js';

export { deployCommands };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  deployCommands().catch(error => {
    console.error(`Command registration failed (${errorCategory(error)}). Check configuration and permissions.`);
    process.exitCode = 1;
  });
}
