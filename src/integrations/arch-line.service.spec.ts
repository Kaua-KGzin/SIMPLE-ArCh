import { ARCH_LINE_CACHE_MS, ArchLineService, buildArchLineSystems } from './arch-line.service';

const hubSystems = [
  {
    id: 'system-pvd',
    name: 'ARCHNEXUS',
    status: 'UP',
    baseUrl: 'http://localhost:5235',
    tags: ['arch-line', 'role:business'],
    lastSeen: '2026-10-19T12:00:00Z',
    architecture: { latest: { score: 54.4, grade: 'D', analyzedAt: '2026-10-19T11:00:00Z' }, delta: -2 },
    healthCheckUrl: 'http://internal/health', // não deve vazar
  },
  { id: 'evil', name: 'Evil', status: 'HACKED', baseUrl: 'javascript:alert(1)', tags: 'nope' },
];
const hubArchitecture = [
  { systemId: 'system-pvd', registered: true, architecture: { latest: { score: 54 } } },
  { systemId: 'archmap', registered: false, architecture: { latest: { score: 28, grade: 'F' }, delta: null } },
];

describe('buildArchLineSystems', () => {
  it('junta sistemas no ar com repos que só publicaram score e sanitiza campos', () => {
    const systems = buildArchLineSystems(hubSystems, hubArchitecture);

    expect(systems.map((s) => s.id).sort()).toEqual(['archmap', 'evil', 'system-pvd']);
    const pvd = systems.find((s) => s.id === 'system-pvd')!;
    expect(pvd).toEqual({
      id: 'system-pvd',
      name: 'ARCHNEXUS',
      status: 'UP',
      url: 'http://localhost:5235',
      role: 'business',
      lastSeen: '2026-10-19T12:00:00Z',
      architecture: { score: 54, grade: 'D', delta: -2, analyzedAt: '2026-10-19T11:00:00Z' },
    });
    const evil = systems.find((s) => s.id === 'evil')!;
    expect(evil.url).toBeNull();
    expect(evil.status).toBe('UNKNOWN');
    expect(systems.find((s) => s.id === 'archmap')!.architecture?.score).toBe(28);
  });

  it('preenche o score de um sistema registrado a partir de /architecture', () => {
    const registeredWithoutScore = [{ id: 'system-pvd', name: 'ARCHNEXUS', status: 'UP', baseUrl: 'http://pvd', tags: [] }];
    const architecture = [{ systemId: 'system-pvd', architecture: { latest: { score: 54, grade: 'D' }, delta: 3 } }];

    const [pvd] = buildArchLineSystems(registeredWithoutScore, architecture);

    expect(pvd.status).toBe('UP');
    expect(pvd.url).toBe('http://pvd');
    expect(pvd.architecture).toEqual({ score: 54, grade: 'D', delta: 3, analyzedAt: null });
  });

  it('tolera respostas inesperadas do Hub', () => {
    expect(buildArchLineSystems(null, { not: 'a list' })).toEqual([]);
  });
});

describe('ArchLineService', () => {
  const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

  it('fica desligado sem ARCHHUB_URL', async () => {
    const fetchFn = jest.fn();
    const view = await new ArchLineService(null, fetchFn as unknown as typeof fetch).view();
    expect(view.enabled).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cacheia a resposta e compartilha requisições simultâneas', async () => {
    let now = 0;
    const fetchFn = jest.fn((url: string) => json(url.endsWith('/architecture') ? hubArchitecture : hubSystems));
    const service = new ArchLineService('http://hub', fetchFn as unknown as typeof fetch, () => now);

    await Promise.all([service.view(), service.view(), service.view()]);
    expect(fetchFn).toHaveBeenCalledTimes(2); // /systems + /architecture, uma vez só

    now += ARCH_LINE_CACHE_MS - 1;
    await service.view();
    expect(fetchFn).toHaveBeenCalledTimes(2);

    now += 2;
    await service.view();
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('com o Hub fora do ar devolve o último retrato marcado com erro', async () => {
    let now = 0;
    let down = false;
    const fetchFn = jest.fn((url: string) =>
      down ? Promise.reject(new Error('ECONNREFUSED')) : json(url.endsWith('/architecture') ? [] : hubSystems));
    const service = new ArchLineService('http://hub', fetchFn as unknown as typeof fetch, () => now);

    const first = await service.view();
    down = true;
    now += ARCH_LINE_CACHE_MS + 1;
    const second = await service.view();

    expect(second.error).toBe('Arch Hub indisponível');
    expect(second.systems).toEqual(first.systems);
  });
});
