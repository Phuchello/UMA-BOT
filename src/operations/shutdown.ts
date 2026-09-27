import type { DatabaseSync } from 'node:sqlite';

export interface ShutdownClient { destroy(): void | Promise<void>; removeAllListeners(event: string): unknown }
export interface SignalHost {
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  off(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  exit(code: number): never | void;
}
export function installGracefulShutdown(client: ShutdownClient, db: Pick<DatabaseSync, 'close'>,
  host: SignalHost = process): { stop: () => Promise<void>; uninstall: () => void } {
  let stopping: Promise<void> | null = null;
  const uninstall = () => { host.off('SIGINT', onSignal); host.off('SIGTERM', onSignal); };
  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    stopping = (async () => {
      uninstall();
      client.removeAllListeners('interactionCreate');
      try { await client.destroy(); } finally { db.close(); }
    })();
    return stopping;
  };
  let exitScheduled = false;
  const onSignal = () => {
    if (exitScheduled) return;
    exitScheduled = true;
    void stop().then(() => host.exit(0), () => host.exit(1));
  };
  host.once('SIGINT', onSignal);
  host.once('SIGTERM', onSignal);
  return { stop, uninstall };
}
