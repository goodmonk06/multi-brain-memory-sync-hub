import { logger } from './logger';

interface MetricLabels {
  [key: string]: string | number | boolean;
}

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels?: MetricLabels, value: number = 1) {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    logger.debug({ metric: 'counter', name, labels, value }, 'Metric recorded');
  }

  /**
   * Set a gauge metric (current value)
   */
  setGauge(name: string, labels: MetricLabels | undefined, value: number) {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);

    logger.debug({ metric: 'gauge', name, labels, value }, 'Metric recorded');
  }

  /**
   * Record a histogram value (for timing, sizes, etc.)
   */
  recordHistogram(name: string, labels: MetricLabels | undefined, value: number) {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);

    logger.debug({ metric: 'histogram', name, labels, value }, 'Metric recorded');
  }

  /**
   * Record timing metric (convenience wrapper for histogram)
   */
  recordTiming(name: string, labels: MetricLabels | undefined, durationMs: number) {
    this.recordHistogram(`${name}_duration_ms`, labels, durationMs);
  }

  /**
   * Get all metrics (for debugging or export)
   */
  getAllMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => [
          key,
          {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
          },
        ])
      ),
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private buildKey(name: string, labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}

export const metrics = new MetricsCollector();

// Helper for timing operations
export async function timed<T>(
  name: string,
  labels: MetricLabels | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    metrics.recordTiming(name, labels, Date.now() - start);
    return result;
  } catch (error) {
    metrics.recordTiming(name, { ...labels, error: 'true' }, Date.now() - start);
    throw error;
  }
}
