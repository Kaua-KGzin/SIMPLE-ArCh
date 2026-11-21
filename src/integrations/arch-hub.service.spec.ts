import {
  ArchHubService,
  INITIAL_RETRY_MS,
  MAX_RETRY_MS,
  nextArchHubDelay,
  resolveArchHubConfig,
} from './arch-hub.service';

describe('nextArchHubDelay', () => {
  const schedule = (heartbeatMs: number, steps: number) => {
    let retry = INITIAL_RETRY_MS;
    const delays: number[] = [];
    for (let i = 0; i < steps; i++) {
      const next = nextArchHubDelay(false, heartbeatMs, retry);
      delays.push(next.delayMs as number);
      retry = next.nextRetryMs;
    }
    return { delays, retry };
  };

  it('backoff dobra até o período do heartbeat', () => {
    expect(schedule(20_000, 6).delays).toEqual([2_000, 4_000, 8_000, 16_000, 20_000, 20_000]);
  });

  it('sem heartbeat (Vercel) o backoff cresce até o teto em vez de nunca re-tentar', () => {
    expect(schedule(0, 20).retry).toBe(MAX_RETRY_MS);
  });

  it('registrado: espera o heartbeat; em modo só-registro, para', () => {
    expect(nextArchHubDelay(true, 20_000, 16_000)).toEqual({ delayMs: 20_000, nextRetryMs: INITIAL_RETRY_MS });
    expect(nextArchHubDelay(true, 0, 2_000).delayMs).toBeNull();
  });
});

describe('resolveArchHubConfig', () => {
  it('fica desligado sem ARCHHUB_URL', () => {
    expect(resolveArchHubConfig({})).toBeNull();
  });

  it('usa localhost:PORT como endereço público por padrão', () => {
    const config = resolveArchHubConfig({ ARCHHUB_URL: 'http://hub:8080/', PORT: '4000' });
    expect(config).toEqual({ hubUrl: 'http://hub:8080', token: undefined, publicUrl: 'http://localhost:4000', heartbeatMs: 20_000 });
  });

  it('na Vercel usa o domínio do deploy e desliga o heartbeat', () => {
    const config = resolveArchHubConfig({ ARCHHUB_URL: 'https://hub', VERCEL: '1', VERCEL_URL: 'app.vercel.app' });
    expect(config?.publicUrl).toBe('https://app.vercel.app');
    expect(config?.heartbeatMs).toBe(0);
  });
});

describe('ArchHubService', () => {
  const config = { hubUrl: 'http://hub', token: 's3cret', publicUrl: 'http://localhost:3000', heartbeatMs: 0 };
  const reply = (status: number) => Promise.resolve({ ok: status < 400, status } as Response);

  it('registra, depois manda heartbeat, e re-registra se o Hub esqueceu o sistema', async () => {
    const fetchFn = jest.fn()
      .mockReturnValueOnce(reply(200)) // register
      .mockReturnValueOnce(reply(404)) // heartbeat: Hub perdeu o catálogo
      .mockReturnValueOnce(reply(200)); // register de novo
    const service = new ArchHubService(config, fetchFn as unknown as typeof fetch);

    await service.tick();
    await service.tick();
    await service.tick();

    const urls = fetchFn.mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      'http://hub/api/v1/systems',
      'http://hub/api/v1/systems/simple-arch/heartbeat',
      'http://hub/api/v1/systems',
    ]);
    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers['X-Hub-Token']).toBe('s3cret');
    expect(JSON.parse(init.body)).toMatchObject({ id: 'simple-arch', healthCheckUrl: 'http://localhost:3000/health' });
  });

  it('não propaga erro quando o Hub está fora do ar', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new ArchHubService(config, fetchFn as unknown as typeof fetch);
    await expect(service.tick()).resolves.toBeUndefined();
  });

  it.each([401, 403, 500, 503])('heartbeat recusado (HTTP %i) não conta como sucesso: re-registra', async (status) => {
    const fetchFn = jest.fn()
      .mockReturnValueOnce(reply(200)) // register
      .mockReturnValueOnce(reply(status)) // heartbeat recusado
      .mockReturnValueOnce(reply(200)); // register de novo
    const service = new ArchHubService(config, fetchFn as unknown as typeof fetch);

    await service.tick();
    await service.tick();
    await service.tick();

    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      'http://hub/api/v1/systems',
      'http://hub/api/v1/systems/simple-arch/heartbeat',
      'http://hub/api/v1/systems',
    ]);
  });

  it('é no-op sem configuração', async () => {
    const fetchFn = jest.fn();
    const service = new ArchHubService(null, fetchFn as unknown as typeof fetch);
    service.onApplicationBootstrap();
    await service.tick();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
