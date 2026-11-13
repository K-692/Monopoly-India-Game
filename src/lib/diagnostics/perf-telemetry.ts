/**
 * Indian Monopoly - Client-Side Performance Instrumentation
 * Lightweight telemetry tracking user click-to-render, network round-trip,
 * and server processing latencies using performance.now().
 */

export interface ActionPerformanceMetric {
  commandId: string;
  actionType: string;
  clientSentAt: number; // performance.now()
  clientAcknowledgedAt?: number; // performance.now()
  clientStateRenderedAt?: number; // performance.now()
  networkRoundTripMs?: number;
  totalEndToEndMs?: number;
  serverDurationMs?: number;
  dbDurationMs?: number;
}

class ClientPerformanceMonitor {
  private metrics: ActionPerformanceMetric[] = [];
  private activePending: Map<string, ActionPerformanceMetric> = new Map();
  private maxHistory = 50;

  /**
   * Records the start of a user-initiated game action.
   */
  public recordActionStart(commandId: string, actionType: string): void {
    const metric: ActionPerformanceMetric = {
      commandId,
      actionType,
      clientSentAt: performance.now(),
    };
    this.activePending.set(commandId, metric);
  }

  /**
   * Records server acknowledgement of the command.
   */
  public recordActionAck(
    commandId: string,
    serverPerf?: { serverDurationMs?: number; dbDurationMs?: number }
  ): void {
    const metric = this.activePending.get(commandId);
    if (!metric) return;

    metric.clientAcknowledgedAt = performance.now();
    metric.networkRoundTripMs = Math.round(metric.clientAcknowledgedAt - metric.clientSentAt);
    if (serverPerf?.serverDurationMs !== undefined) {
      metric.serverDurationMs = Math.round(serverPerf.serverDurationMs);
    }
    if (serverPerf?.dbDurationMs !== undefined) {
      metric.dbDurationMs = Math.round(serverPerf.dbDurationMs);
    }
  }

  /**
   * Records completion of React state update / render for the action.
   */
  public recordActionRendered(commandId: string): void {
    const metric = this.activePending.get(commandId);
    if (!metric) return;

    metric.clientStateRenderedAt = performance.now();
    metric.totalEndToEndMs = Math.round(metric.clientStateRenderedAt - metric.clientSentAt);

    this.activePending.delete(commandId);
    this.metrics.push(metric);
    if (this.metrics.length > this.maxHistory) {
      this.metrics.shift();
    }
  }

  /**
   * Returns recent performance metrics for diagnostics.
   */
  public getRecentMetrics(): readonly ActionPerformanceMetric[] {
    return this.metrics;
  }

  /**
   * Returns summary statistics across recorded actions.
   */
  public getSummary(): {
    count: number;
    avgRoundTripMs: number;
    avgEndToEndMs: number;
    avgServerMs: number;
    avgDbMs: number;
  } {
    if (this.metrics.length === 0) {
      return { count: 0, avgRoundTripMs: 0, avgEndToEndMs: 0, avgServerMs: 0, avgDbMs: 0 };
    }

    let sumRtt = 0;
    let sumE2e = 0;
    let sumServer = 0;
    let sumDb = 0;

    for (const m of this.metrics) {
      sumRtt += m.networkRoundTripMs ?? 0;
      sumE2e += m.totalEndToEndMs ?? 0;
      sumServer += m.serverDurationMs ?? 0;
      sumDb += m.dbDurationMs ?? 0;
    }

    const n = this.metrics.length;
    return {
      count: n,
      avgRoundTripMs: Math.round(sumRtt / n),
      avgEndToEndMs: Math.round(sumE2e / n),
      avgServerMs: Math.round(sumServer / n),
      avgDbMs: Math.round(sumDb / n),
    };
  }
}

export const clientPerf = new ClientPerformanceMonitor();
