/**
 * Safe environment access for engine code that runs both in Node (LAN server, tests)
 * and in the browser (online host), where `process` may not exist.
 */
export function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[name];
}

export function isTestEnv(): boolean {
  return readEnv('NODE_ENV') === 'test' || readEnv('VITEST') === 'true';
}
