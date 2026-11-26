import { describe, expect, it } from 'vitest';
import { RastreadorSessao, type Sessao } from '../../src/domain/sessao';
import batalhas from '../fixtures/batalha-bellsprout.json';
import { logDeTeste } from '../helpers/log';

function criar(opcoes: Partial<{ sessaoMinimaMs: number; pausaMaximaMs: number }> = {}) {
  const salvas: Sessao[] = [];
  const { log, memoria } = logDeTeste();
  const r = new RastreadorSessao(
    {
      pausaMaximaMs: opcoes.pausaMaximaMs ?? 60_000,
      sessaoMinimaMs: opcoes.sessaoMinimaMs ?? 0,
      agora: () => 999_999,
      aoSalvar: (s) => salvas.push(s),
      nomeDaHunt: (slug) => (slug === 'geodude' ? 'Geodude' : undefined),
    },
    log,
  );
  return { r, salvas, memoria };
}

function reproduzir(r: RastreadorSessao) {
  for (const b of batalhas) r.processarEventos(b.ev, b.em);
}

describe('RastreadorSessao', () => {
  it('conta a sessão do mesmo jeito que o painel SESSÃO do jogo', () => {
    const { r } = criar();
    reproduzir(r);
    const s = r.sessaoAtual!;
    expect(s).toMatchObject({
      huntSlug: 'bellsprout',
      huntNome: 'Bellsprout',
      abates: 3,
      xpTreinador: 24,
      xpPokemon: 24,
      gold: 123,
      capturas: 1,
      shiniesVistos: 1,
      shinies: 0,
      bolas: { '1': 1, '2': 1 },
      pocoes: { '11': 1 },
      revives: { '12': 1 },
      spawns: { '69': 2 },
      drops: {
        '70000': { nome: 'Bronze Boss Token', qtd: 1 },
        'nome:Seed': { nome: 'Seed', qtd: 2 },
      },
    });
    expect(r.eventosInvalidos).toBe(1);
  });

  it('conta como ativo só o tempo até a pausa máxima entre eventos', () => {
    const { r } = criar({ pausaMaximaMs: 60_000 });
    reproduzir(r);
    expect(r.sessaoAtual!.msAtivo).toBe(8000 + 60_000 + 30_000);
  });

  it('ignora eventos de combate sem hunt definida', () => {
    const { r } = criar();
    r.processarEventos([{ k: 'morte', quem: 'selvagem', xp: 8, ouro: 41, drops: [] }], 10);
    expect(r.sessaoAtual).toBeNull();
  });

  it('salva ao trocar de hunt e descarta sessões curtas', () => {
    const { r, salvas, memoria } = criar({ sessaoMinimaMs: 50_000 });
    reproduzir(r);
    r.definirHunt('geodude', undefined, 240_000);
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toMatchObject({ huntSlug: 'bellsprout', aberta: false, abates: 3 });
    expect(salvas[0]!.fim).toBe(240_000);
    expect(r.sessaoAtual).toMatchObject({ huntSlug: 'geodude', huntNome: 'Geodude' });
    r.processarEventos([{ k: 'spawn', speciesId: 74 }], 241_000);
    r.definirHunt(null, undefined, 242_000);
    expect(salvas).toHaveLength(1);
    expect(memoria.entradas.some((e) => e.msg === 'Sessão curta descartada')).toBe(true);
  });

  it('faz checkpoint de sessões abertas e mantém a mesma hunt sem reiniciar', () => {
    const { r, salvas } = criar({ sessaoMinimaMs: 1000 });
    reproduzir(r);
    r.definirHunt('bellsprout');
    r.checkpoint();
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toMatchObject({ aberta: true, abates: 3 });
    expect(salvas[0]!.id).toBe(r.sessaoAtual!.id);
  });

  it('não faz checkpoint de sessão abaixo do mínimo nem sem sessão', () => {
    const { r, salvas } = criar({ sessaoMinimaMs: 10_000_000 });
    r.checkpoint();
    reproduzir(r);
    r.checkpoint();
    expect(salvas).toHaveLength(0);
  });

  it('contém falhas ao salvar', () => {
    const { log, memoria } = logDeTeste();
    const r = new RastreadorSessao(
      {
        pausaMaximaMs: 60_000,
        sessaoMinimaMs: 0,
        aoSalvar: () => {
          throw new Error('disco cheio');
        },
        nomeDaHunt: () => undefined,
      },
      log,
    );
    reproduzir(r);
    expect(() => r.encerrar('teste')).not.toThrow();
    expect(memoria.entradas.some((e) => e.nivel === 'ERROR')).toBe(true);
  });

  it('rejeita ids inválidos de consumíveis', () => {
    const { r } = criar();
    r.definirHunt('bellsprout', 'Bellsprout', 0);
    r.processarEventos(
      [
        { k: 'cura', itemId: 'abc' },
        { k: 'cura', itemId: -1 },
        { k: 'revive' },
        { k: 'bola', ballId: 1.5 },
      ],
      1,
    );
    expect(r.sessaoAtual).toMatchObject({ pocoes: {}, revives: {}, bolas: {} });
  });
});
