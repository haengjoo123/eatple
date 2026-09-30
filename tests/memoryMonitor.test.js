const fs = require('fs');
const { MemoryMonitor, detectMemoryLimitBytes } = require('../utils/memoryMonitor');

const MB = 1024 * 1024;

function memoryUsage(rss) {
    return {
        heapUsed: 21 * MB,
        heapTotal: 23 * MB,
        rss: rss * MB,
        external: 2 * MB,
        arrayBuffers: 0
    };
}

afterEach(() => jest.restoreAllMocks());

test('uses container RSS instead of V8 heap occupancy for alerts', () => {
    const monitor = new MemoryMonitor({
        memoryLimitBytes: 512 * MB,
        getProcessMemoryUsage: () => memoryUsage(61)
    });
    const alert = jest.spyOn(monitor, 'sendAlert').mockImplementation(() => {});
    const cleanup = jest.spyOn(monitor, 'emergencyCleanup').mockResolvedValue();

    const result = monitor.checkMemoryUsage();

    expect(result).toMatchObject({
        heapUsed: 21,
        heapTotal: 23,
        rss: 61,
        memoryLimit: 512,
        usagePercent: 0.12,
        heapUsagePercent: 0.91,
        status: 'healthy'
    });
    expect(monitor.getOptimizationRecommendations(result)).toEqual([]);
    expect(alert).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
});

test('alerts and cleans up when RSS actually approaches the container limit', () => {
    const monitor = new MemoryMonitor({
        memoryLimitBytes: 512 * MB,
        getProcessMemoryUsage: () => memoryUsage(490)
    });
    const alert = jest.spyOn(monitor, 'sendAlert').mockImplementation(() => {});
    const cleanup = jest.spyOn(monitor, 'emergencyCleanup').mockResolvedValue();

    expect(monitor.checkMemoryUsage().status).toBe('critical');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(monitor.getOptimizationRecommendations(monitor.getMemoryUsage()))
        .not.toEqual(expect.arrayContaining([expect.objectContaining({ action: 'reduce_cache_ttl' })]));
});

test('leaves the status unknown when no container memory limit is available', () => {
    const monitor = new MemoryMonitor({
        memoryLimitBytes: null,
        getProcessMemoryUsage: () => memoryUsage(61)
    });
    expect(monitor.getMemoryUsage()).toMatchObject({
        memoryLimit: null,
        usagePercent: null,
        status: 'unknown'
    });
});

test('reads the cgroup v2 limit when available', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(file => {
        if (file === '/sys/fs/cgroup/memory.max') return String(512 * MB);
        throw new Error('not found');
    });
    expect(detectMemoryLimitBytes()).toBe(512 * MB);
});
