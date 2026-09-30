const { AIRequestQueue } = require('../utils/aiRequestQueue');

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a provider timeout aborts its request and releases the next queued job', async () => {
    const queue = new AIRequestQueue({ maxConcurrent: 1, requestTimeout: 50, enableLogging: false });
    let providerSignal;
    const first = queue.add(signal => { providerSignal = signal; return new Promise(() => {}); });
    const rejected = expect(first).rejects.toThrow(/처리 시간이 초과/);
    const next = queue.add(async () => 'next result');
    await jest.advanceTimersByTimeAsync(50);
    await rejected;
    expect(providerSignal.aborted).toBe(true);
    await expect(next).resolves.toBe('next result');
    expect(queue.activeRequests).toBe(0);
    expect(queue.getStats()).toMatchObject({ timeoutRequests: 1, successfulRequests: 1, failedRequests: 0 });
});

test('clearing waiting jobs does not reset running jobs or exceed concurrency', async () => {
    const queue = new AIRequestQueue({ maxConcurrent: 1, enableLogging: false });
    let finish;
    const first = queue.add(() => new Promise(resolve => { finish = resolve; }));
    await jest.advanceTimersByTimeAsync(0);
    const waiting = queue.add(async () => 'cancelled');
    const cancelled = expect(waiting).rejects.toThrow(/초기화/);
    queue.clear();
    await cancelled;
    const runNext = jest.fn(async () => 'next');
    const next = queue.add(runNext);
    expect(runNext).not.toHaveBeenCalled();
    expect(queue.activeRequests).toBe(1);
    finish('first');
    await expect(first).resolves.toBe('first');
    await expect(next).resolves.toBe('next');
    expect(queue.activeRequests).toBe(0);
});

test('a late provider result is not counted as a success after timeout', async () => {
    const queue = new AIRequestQueue({ maxConcurrent: 1, requestTimeout: 50, enableLogging: false });
    let finish;
    const first = queue.add(() => new Promise(resolve => { finish = resolve; }));
    const rejected = expect(first).rejects.toThrow(/초과/);
    await jest.advanceTimersByTimeAsync(50);
    await rejected;
    finish('too late');
    await jest.advanceTimersByTimeAsync(0);
    expect(queue.getStats()).toMatchObject({ successfulRequests: 0, timeoutRequests: 1, activeRequests: 0 });
});

test('waiting jobs expire without invoking their provider', async () => {
    const queue = new AIRequestQueue({ maxConcurrent: 1, requestTimeout: 100, queueTimeout: 20, enableLogging: false });
    let finish;
    const running = queue.add(() => new Promise(resolve => { finish = resolve; }));
    const provider = jest.fn();
    const waiting = queue.add(provider);
    const rejected = expect(waiting).rejects.toThrow(/대기 시간이 초과/);
    await jest.advanceTimersByTimeAsync(20);
    await rejected;
    expect(provider).not.toHaveBeenCalled();
    expect(queue.getStatus().queuedRequests).toBe(0);
    finish('finished');
    await running;
});
