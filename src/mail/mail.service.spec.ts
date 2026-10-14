import {
  buildNewUserRequestHtml,
  buildNewUserRequestText,
  MailService,
} from './mail.service.js';

describe('MailService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    vi.restoreAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('ignore l’envoi si RESEND_API_KEY ou ADMIN_EMAIL manque', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_EMAIL;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const service = new MailService();

    await service.sendNewUserRequestNotification({
      imatricule: 'MEF-001',
      nom: 'RAKOTO',
      prenom: 'Mamy',
      cin: '101',
      telephone: '0340000000',
      adresse: 'Tana',
      role: 'COMPTABLE',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envoie un template pro (header SRB, tableau, bouton, version texte)', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.ADMIN_EMAIL = 'admin@test.mg';
    process.env.FRONTEND_URL = 'http://localhost:3001';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const service = new MailService();

    await service.sendNewUserRequestNotification({
      imatricule: 'MEF-008742',
      nom: 'RAKOTO',
      prenom: 'Mamy',
      cin: '101',
      telephone: '0340000000',
      email: 'demandeur@test.mg',
      adresse: 'Tana',
      role: 'COMPTABLE',
      soa: { code: 'SOA-01', libelle: 'Test' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body) as {
      to: string[];
      subject: string;
      reply_to?: string;
      html: string;
      text: string;
    };
    expect(body.to).toEqual(['admin@test.mg']);
    expect(body.subject).toContain('MEF-008742');
    expect(body.reply_to).toBe('demandeur@test.mg');
    // Template pro
    expect(body.html).toContain('SERVICE RÉGIONAL DES BUDGETS');
    expect(body.html).toContain('<table');
    expect(body.html).toContain('Examiner la demande');
    expect(body.html).toContain('http://localhost:3001/user-requests');
    expect(body.text).toContain('MEF-008742');
    expect(body.text).toContain('http://localhost:3001/user-requests');
    vi.unstubAllGlobals();
  });

  it('fonctionne sans FRONTEND_URL (pas de lien cassé)', () => {
    const html = buildNewUserRequestHtml(
      {
        imatricule: 'MEF-1',
        nom: 'A',
        prenom: 'B',
        cin: '101',
        telephone: '034',
        adresse: 'Tana',
        role: 'COMPTABLE',
      },
      null,
    );
    expect(html).toContain('espace admin');
    expect(html).not.toContain('href="null"');

    const text = buildNewUserRequestText(
      {
        imatricule: 'MEF-1',
        nom: 'A',
        prenom: 'B',
        cin: '101',
        telephone: '034',
        adresse: 'Tana',
        role: 'COMPTABLE',
      },
      null,
    );
    expect(text).toContain('espace admin');
  });

  it('échappe le HTML injecté dans les champs', () => {
    const html = buildNewUserRequestHtml(
      {
        imatricule: '<script>',
        nom: '<b>X</b>',
        prenom: 'B',
        cin: '101',
        telephone: '034',
        adresse: 'Tana',
        role: 'COMPTABLE',
      },
      'http://localhost:3001/user-requests',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
