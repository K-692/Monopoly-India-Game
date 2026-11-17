import React, { useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { startLatencyMonitor, useConnectionStore, useLatencyStore } from '@/lib/socket/socket-client';

/** Latency quality buckets (round-trip ms). */
export function getLatencyQuality(ms: number | null): 'good' | 'fair' | 'poor' | 'unknown' {
  if (ms === null) return 'unknown';
  if (ms < 120) return 'good';
  if (ms < 250) return 'fair';
  return 'poor';
}

const QUALITY_STYLES: Record<ReturnType<typeof getLatencyQuality>, { dot: string; text: string }> = {
  good: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  fair: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  poor: { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  unknown: { dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400' },
};

/**
 * Always-visible bottom-right badge showing live round-trip latency to the game server.
 */
export const PingIndicator: React.FC = () => {
  const status = useConnectionStore((s) => s.status);
  const smoothedMs = useLatencyStore((s) => s.smoothedMs);
  const latencyMs = useLatencyStore((s) => s.latencyMs);
  const isTimedOut = useLatencyStore((s) => s.isTimedOut);

  useEffect(() => startLatencyMonitor(), []);

  const isConnected = status === 'connected';
  const shown = isConnected && !isTimedOut ? smoothedMs : null;
  const quality = isConnected && isTimedOut ? 'poor' : getLatencyQuality(shown);
  const styles = QUALITY_STYLES[quality];

  let label: string;
  if (!isConnected) label = status === 'connecting' ? 'Connecting…' : 'Offline';
  else if (isTimedOut) label = 'Timeout';
  else if (shown === null) label = '— ms';
  else label = `${shown} ms`;

  return (
    <div
      data-testid="ping-indicator"
      data-quality={quality}
      role="status"
      aria-live="off"
      title={latencyMs !== null ? `Server round-trip: ${latencyMs} ms (last sample)` : 'Server latency'}
      className="fixed bottom-2 right-2 z-[200] flex items-center gap-1.5 px-2 py-0.5 rounded-md border shadow-sm font-mono text-[11px] font-bold select-none pointer-events-auto bg-indian-parchment-50/90 dark:bg-indian-navy-800/90 border-indian-parchment-300 dark:border-indian-navy-600 backdrop-blur-sm mb-[env(safe-area-inset-bottom)]"
    >
      {isConnected ? (
        <Wifi className={cn('w-3.5 h-3.5', styles.text)} />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-gray-500" />
      )}
      <span className={cn('w-1.5 h-1.5 rounded-full', styles.dot, isConnected && 'animate-pulse')} />
      <span className={styles.text}>{label}</span>
    </div>
  );
};
