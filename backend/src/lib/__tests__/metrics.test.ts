import { describe, it, expect, beforeEach } from 'vitest';
import { metrics, timed } from '../metrics';

describe('Metrics System', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('Counter', () => {
    it('should increment counter', () => {
      metrics.incrementCounter('test_counter');
      metrics.incrementCounter('test_counter');

      const allMetrics = metrics.getAllMetrics();
      expect(allMetrics.counters['test_counter']).toBe(2);
    });

    it('should support custom increment values', () => {
      metrics.incrementCounter('test_counter', {}, 5);
      metrics.incrementCounter('test_counter', {}, 3);

      const allMetrics = metrics.getAllMetrics();
      expect(allMetrics.counters['test_counter']).toBe(8);
    });

    it('should support labels', () => {
      metrics.incrementCounter('http_requests', { method: 'GET', status: '200' });
      metrics.incrementCounter('http_requests', { method: 'POST', status: '201' });

      const allMetrics = metrics.getAllMetrics();
      expect(allMetrics.counters['http_requests{method="GET",status="200"}']).toBe(1);
      expect(allMetrics.counters['http_requests{method="POST",status="201"}']).toBe(1);
    });
  });

  describe('Gauge', () => {
    it('should set gauge value', () => {
      metrics.setGauge('memory_count', {}, 42);

      const allMetrics = metrics.getAllMetrics();
      expect(allMetrics.gauges['memory_count']).toBe(42);
    });

    it('should update gauge value', () => {
      metrics.setGauge('temperature', {}, 20);
      metrics.setGauge('temperature', {}, 25);

      const allMetrics = metrics.getAllMetrics();
      expect(allMetrics.gauges['temperature']).toBe(25);
    });
  });

  describe('Histogram', () => {
    it('should record histogram values', () => {
      metrics.recordHistogram('request_duration', {}, 100);
      metrics.recordHistogram('request_duration', {}, 200);
      metrics.recordHistogram('request_duration', {}, 150);

      const allMetrics = metrics.getAllMetrics();
      const histogram = allMetrics.histograms['request_duration'];

      expect(histogram.count).toBe(3);
      expect(histogram.sum).toBe(450);
      expect(histogram.avg).toBe(150);
      expect(histogram.min).toBe(100);
      expect(histogram.max).toBe(200);
    });

    it('should support labels in histograms', () => {
      metrics.recordHistogram('api_latency', { endpoint: '/users' }, 50);
      metrics.recordHistogram('api_latency', { endpoint: '/posts' }, 100);

      const allMetrics = metrics.getAllMetrics();
      expect(allMetrics.histograms['api_latency{endpoint="/users"}'].avg).toBe(50);
      expect(allMetrics.histograms['api_latency{endpoint="/posts"}'].avg).toBe(100);
    });
  });

  describe('Timing', () => {
    it('should record timing metrics', () => {
      metrics.recordTiming('operation', {}, 250);

      const allMetrics = metrics.getAllMetrics();
      expect(allMetrics.histograms['operation_duration_ms'].avg).toBe(250);
    });
  });

  describe('timed helper', () => {
    it('should measure async function duration', async () => {
      const result = await timed('test_operation', {}, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'success';
      });

      expect(result).toBe('success');

      const allMetrics = metrics.getAllMetrics();
      const timing = allMetrics.histograms['test_operation_duration_ms'];
      expect(timing.avg).toBeGreaterThanOrEqual(100);
    });

    it('should record timing even on error', async () => {
      try {
        await timed('failing_operation', {}, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          throw new Error('Test error');
        });
      } catch (error) {
        // Expected
      }

      const allMetrics = metrics.getAllMetrics();
      const timing = allMetrics.histograms['failing_operation_duration_ms{error="true"}'];
      expect(timing).toBeDefined();
      expect(timing.avg).toBeGreaterThanOrEqual(50);
    });

    it('should propagate errors', async () => {
      await expect(
        timed('test', {}, async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('getAllMetrics', () => {
    it('should return all metric types', () => {
      metrics.incrementCounter('counter1');
      metrics.setGauge('gauge1', {}, 10);
      metrics.recordHistogram('hist1', {}, 50);

      const allMetrics = metrics.getAllMetrics();

      expect(allMetrics.counters).toBeDefined();
      expect(allMetrics.gauges).toBeDefined();
      expect(allMetrics.histograms).toBeDefined();
      expect(Object.keys(allMetrics.counters).length).toBeGreaterThan(0);
      expect(Object.keys(allMetrics.gauges).length).toBeGreaterThan(0);
      expect(Object.keys(allMetrics.histograms).length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      metrics.incrementCounter('test');
      metrics.setGauge('test', {}, 1);
      metrics.recordHistogram('test', {}, 1);

      metrics.reset();

      const allMetrics = metrics.getAllMetrics();
      expect(Object.keys(allMetrics.counters).length).toBe(0);
      expect(Object.keys(allMetrics.gauges).length).toBe(0);
      expect(Object.keys(allMetrics.histograms).length).toBe(0);
    });
  });
});
