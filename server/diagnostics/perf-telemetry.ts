/**
 * Indian Monopoly - Server-Side Performance Instrumentation
 * Lightweight structured telemetry tracking command execution, database persistence,
 * and broadcast timings using high-resolution performance.now().
 */

export interface ServerActionMetric {
  commandId: string;
  gameId: string;
  actionType: string;
  actorUid: string;
  serverReceivedAt: number;
  serverDurationMs: number;
  dbDurationMs: number;
  broadcastAt: number;
}

class ServerPerformanceMonitor {
  private metrics: ServerActionMetric[] = [];
  private maxHistory = 100;
  private isEnabled = true;

  public recordMetric(metric: ServerActionMetric): void {
    if (!this.isEnabled) return;
    this.metrics.push(metric);
    if (this.metrics.length > this.maxHistory) {
      this.metrics.shift();
    }
  }

  public getRecentMetrics(): readonly ServerActionMetric[] {
    return this.metrics;
  }

  public getSummary(): {
    count: number;
    avgServerDurationMs: number;
    avgDbDurationMs: number;
  } {
    if (this.metrics.length === 0) {
      return { count: 0, avgServerDurationMs: 0, avgDbDurationMs: 0 };
    }

    let sumServer = 0;
    let sumDb = 0;
    for (const m of this.metrics) {
      sumServer += m.serverDurationMs;
      sumDb += m.dbDurationMs;
    }

    const n = this.metrics.length;
    return {
      count: n,
      avgServerDurationMs: Math.round(sumServer / n),
      avgDbDurationMs: Math.round(sumDb / n),
    };
  }
}

export const serverPerf = new ServerPerformanceMonitor();
