import { describe, expect, it } from 'vitest';
import { Aplicacao } from '../../src/content/aplicacao';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import { VERSAO_SESSAO, novaSessao, type Sessao } from '../../src/domain/sessao';
import { CONFIG_PADRAO } from '../../src/shared/config';
import { catalogos } from '../helpers/catalogos';
import { logDeTeste } from '../helpers/log';
import welcome from '../fixtures/welcome.json';

function criarApp(salvas: Sessao[] = []) {
  const { log } = logDeTeste();
  const { especies, itens } = catalogos();
  return new Aplicacao({
    config: CONFIG_PADRAO,
    log,
    estado: new EstadoJogo(log),
    repositorio: {
      salvar: async () => undefined,
      listar: async () => salvas,
      limpar: async () => undefined,
    },
    especies,
    itens,
    versao: 'teste',
  });
}

describe('Aplicacao com simulação de combate', () => {
  const env = (dados: unknown, recebidoEm: number) => ({
    origem: 'pokeidle-helper' as const,
    v: 1 as const,
    tipo: 'mensagem' as const,
    recebidoEm,
    dados,
  });

  it('simula hunts não visitadas, analisa o time e registra o pokémon da sessão', () => {
    const app = criarApp();
    app.receber(env(welcome, 0));
    app.receber(env({ t: 'estado', estado: { huntSlug: 'geodude' } }, 1000));
    const m = app.modelo();
    expect(m.ranking?.linhas.find((l) => l.slug === 'oddish')?.fonte).toBe('simulado');
    expect(m.time?.huntNome).toBe('Geodude');
    expect(m.time?.linhas.map((l) => l.pokemon.nome)).toEqual(['Squirtle', 'Charmander']);
    expect(m.sessao?.sugestao?.nome).toBe('Squirtle');
    expect(app.rastreador.sessaoAtual?.pokemon).toEqual({ id: '1', speciesId: 4, level: 5 });
  });

  it('lista as melhores hunts simuladas para um pokémon do time', () => {
    const app = criarApp();
    app.receber(env(welcome, 0));
    const r = app.melhoresHuntsPara('2', 'xp', 2);
    expect(r).toHaveLength(2);
    expect(r[0]!.xpPokemonH).toBeGreaterThanOrEqual(r[1]!.xpPokemonH);
    expect(r[0]).toMatchObject({ slug: expect.any(String), abatesH: expect.any(Number) });
    expect(app.melhoresHuntsPara('999', 'xp', 5)).toEqual([]);
    const lucro = app.melhoresHuntsPara('2', 'gold', 3);
    expect(lucro[0]!.goldH).toBeGreaterThanOrEqual(lucro[1]!.goldH);
  });
});

describe('Aplicacao.carregarHistorico', () => {
  it('normaliza sessões salvas por versões anteriores', async () => {
    const antiga = {
      ...novaSessao('bellsprout', 'Bellsprout', 0),
      schemaVersion: 1,
    } as Partial<Sessao>;
    delete antiga.tokens;
    delete antiga.golpesRecebidos;
    const app = criarApp([antiga as Sessao]);
    await app.carregarHistorico();
    const [s] = app.exportarDados().sessoes;
    expect(s).toMatchObject({ schemaVersion: VERSAO_SESSAO, tokens: {}, golpesRecebidos: 0 });
  });
});
