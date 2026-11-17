// Kept free of Node-only imports so it can run inside the online host's browser.

/**
 * Normalizes IPv4-mapped IPv6 addresses (e.g., ::ffff:192.168.1.5 -> 192.168.1.5)
 */
export function normalizeIp(ip: string | undefined): string {
  if (!ip) return '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip;
}
