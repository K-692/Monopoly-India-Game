/**
 * Indian Monopoly - LAN Network Discovery & Address Resolution
 * Detects usable IPv4 network interfaces on the host system to display
 * shareable Wi-Fi / Local Network URLs and validate LAN client connections.
 */

import os from 'os';
import { LanAddressInfo, LanServerInfo } from '../types/server-types';

/**
 * Checks if an IPv4 address is in an RFC 1918 private network range:
 * - 10.0.0.0    - 10.255.255.255  (10.0.0.0/8)
 * - 172.16.0.0  - 172.31.255.255  (172.16.0.0/12)
 * - 192.168.0.0 - 192.168.255.255 (192.168.0.0/16)
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 10.0.0.0/8
  if (parts[0] === 10) return true;

  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;

  return false;
}

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

/**
 * Scans host network interfaces and returns all usable non-loopback IPv4 addresses.
 * Prioritizes active Wi-Fi and Ethernet LAN interfaces.
 */
export function getLanAddresses(): LanAddressInfo[] {
  const interfaces = os.networkInterfaces();
  const results: LanAddressInfo[] = [];

  for (const [interfaceName, netList] of Object.entries(interfaces)) {
    if (!netList) continue;

    for (const net of netList) {
      // Must be IPv4 and non-internal (exclude 127.0.0.1 loopback)
      const isIPv4 = net.family === 'IPv4' || (net.family as unknown) === 4;
      if (isIPv4 && !net.internal && net.address !== '127.0.0.1') {
        const isPrivate = isPrivateIPv4(net.address);
        results.push({
          address: net.address,
          family: 'IPv4',
          interfaceName,
          isPrivate,
        });
      }
    }
  }

  // Sort: private IPv4 addresses first (192.168.x.x, 10.x.x.x, 172.16-31.x.x), then common interfaces
  results.sort((a, b) => {
    if (a.isPrivate && !b.isPrivate) return -1;
    if (!a.isPrivate && b.isPrivate) return 1;

    // Prioritize Wi-Fi interfaces commonly named en0 on macOS or wlan0/Wi-Fi
    const isEn0 = (name: string) => /^(en0|wlan0|wi-?fi)/i.test(name);
    if (isEn0(a.interfaceName) && !isEn0(b.interfaceName)) return -1;
    if (!isEn0(a.interfaceName) && isEn0(b.interfaceName)) return 1;

    return a.interfaceName.localeCompare(b.interfaceName);
  });

  return results;
}

/**
 * Returns the best primary LAN IPv4 address for room sharing.
 */
export function getPrimaryLanAddress(): string | null {
  const addresses = getLanAddresses();
  if (addresses.length === 0) return null;
  return addresses[0].address;
}

/**
 * Formats full LAN connection info for terminal banner and API endpoints.
 */
export function getLanServerInfo(port: number): LanServerInfo {
  const detected = getLanAddresses();
  const lanAddresses = detected.map((d) => d.address);
  const primaryLanAddress = lanAddresses.length > 0 ? lanAddresses[0] : null;

  return {
    status: 'RUNNING',
    port,
    primaryLanAddress,
    lanAddresses,
    localUrl: `http://localhost:${port}`,
    lanUrls: lanAddresses.map((ip) => `http://${ip}:${port}`),
  };
}

