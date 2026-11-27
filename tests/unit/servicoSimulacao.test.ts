import { describe, expect, it } from 'vitest';
import { ServicoSimulacao } from '../../src/content/servicoSimulacao';
import { MULTIPLICADORES_NEUTROS } from '../../src/analysis/multiplicadores';
import { xpDoNivel } from '../../src/analysis/formulasJogo';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import { novaSessao, type Sessao } from '../../src/domain/sessao';
import welcome from '../fixtures/welcome.json';
import { catalogos } from '../helpers/catalogos';
import { logDeTeste } from '../helpers/log';

function criar(estadoExtra: Record<string, unknown> = {}) {
  const { log } = logDeTeste();
  const { especies } = catalogos();
  const estado = new EstadoJogo(log);
  estado.aplicarMensagem({ ...welcome, estado: { ...welcome.estado, ...estadoExtra } });
  return { servico: new ServicoSimulacao(estado, especies), estado };
}

describe('ServicoSimulacao', () => {
  it('simula a hunt para um pokémon do jogador', () => {
    const { servico, estado } = criar();
    const sim = servico.simuladorPara(estado.pokemonAtivo()!)!;
    expect(sim(estado.huntPorSlug('geodude')!)?.abatesH).toBeGreaterThan(0);
    expect(servico.simuladorPara({ id: 'x', speciesId: 999 })).toBeNull();
  });

  it('calibra com as sessões que registraram o pokémon', () => {
    const { servico, estado } = criar();
    const sim = servico.simuladorPara(estado.pokemonAtivo()!)!(estado.huntPorSlug('bellsprout')!)!;
    const sessao: Sessao = {
      ...novaSessao('bellsprout', 'Bellsprout', 0),
      msAtivo: 3_600_000,
      abates: Math.round(sim.abatesH * 0.5),
      pokemon: { id: '1', speciesId: 4, level: 5 },
      sazonal: { tipo: null, escudo: false },
    };
    const semPokemon: Sessao = { ...sessao, id: 'b', pokemon: undefined as never };
    delete (semPokemon as Partial<Sessao>).pokemon;
    const c = servico.calibracao([
      sessao,
      semPokemon,
      { ...sessao, id: 'c', huntSlug: 'inexistente' },
    ]);
    expect(c?.sessoes).toBe(1);
    expect(c?.fator).toBeCloseTo(0.5, 2);
  });

  it('calibra dano, deslocamento e espera pelos componentes medidos', () => {
    const { servico, estado } = criar();
    const hunt = estado.huntPorSlug('geodude')!;
    const sim = servico.simuladorPara(estado.pokemonAtivo()!)!(hunt)!;
    const abates = 100;
    const sessao: Sessao = {
      ...novaSessao('geodude', 'Geodude', 0),
      msAtivo: 3_600_000,
      abates,
      golpesDados: Math.round((sim.acoesPorAbateMedio * abates) / 4),
      fases: { lutaMs: 1_000_000, deslocamentoMs: 150_000, esperaMs: 80_000, ondas: 40 },
      pokemon: { id: '1', speciesId: 4, level: 5 },
      sazonal: { tipo: null, escudo: false },
    };
    const c = servico.calibracao([sessao])!;
    expect(c.componentes?.fatorDano).toBeCloseTo(4, 1);
    expect(c.ajustes).toMatchObject({ deslocamentoPorAbateS: 1.5, esperaPorOndaS: 2 });
    const ajustado = servico.simuladorPara(estado.pokemonAtivo()!, c.ajustes)!(hunt)!;
    expect(ajustado.acoesPorAbateMedio).toBeLessThan(sim.acoesPorAbateMedio);
  });

  it('simula cada sessão no seu próprio dia sazonal', () => {
    const FIM = 10 * 86_400_000;
    const { servico, estado } = criar({ diaSazonal: { tipo: 'FIRE', fim: FIM } });
    const hunt = estado.huntPorSlug('geodude')!;
    const pk = estado.pokemonAtivo()!;
    const semBonus = servico.simuladorPara(pk, { tipoSazonal: null })!(hunt)!;
    const comFogo = servico.simuladorPara(pk)!(hunt)!;
    expect(comFogo.acoesPorAbateMedio).toBeLessThan(semBonus.acoesPorAbateMedio);
    const base = (inicio: number, extra: Partial<Sessao>): Sessao => ({
      ...novaSessao('geodude', 'Geodude', inicio),
      id: `s-${inicio}`,
      msAtivo: 3_600_000,
      abates: 100,
      fases: { lutaMs: 1_000_000, deslocamentoMs: 100_000, esperaMs: 10_000, ondas: 10 },
      pokemon: { id: '1', speciesId: 4, level: 5 },
      ...extra,
    });
    const diaSemBonus = base(1_000, {
      golpesDados: Math.round(semBonus.acoesPorAbateMedio * 100),
      sazonal: { tipo: null, escudo: false },
    });
    const c = servico.calibracao([diaSemBonus])!;
    expect(c.componentes?.fatorDano).toBeCloseTo(1, 1);

    const deHojeSemRegistro = base(FIM - 1_000, {
      golpesDados: Math.round(comFogo.acoesPorAbateMedio * 100),
    });
    const antigaSemRegistro = base(FIM - 3 * 86_400_000, { golpesDados: 1 });
    const c2 = servico.calibracao([deHojeSemRegistro, antigaSemRegistro])!;
    expect(c2.sessoes).toBe(1);
    expect(c2.componentes?.fatorDano).toBeCloseTo(1, 1);
  });

  it('simula a sessão no nível médio entre o inicial e o final', () => {
    const { servico, estado } = criar();
    const hunt = estado.huntPorSlug('geodude')!;
    const pk = estado.pokemonAtivo()!;
    const nivelMedio = servico.simuladorPara({ ...pk, level: 9 })!(hunt)!;
    const sessao: Sessao = {
      ...novaSessao('geodude', 'Geodude', 0),
      msAtivo: 3_600_000,
      abates: 100,
      golpesDados: Math.round(nivelMedio.acoesPorAbateMedio * 100),
      fases: { lutaMs: 1_000_000, deslocamentoMs: 100_000, esperaMs: 10_000, ondas: 10 },
      pokemon: { id: '1', speciesId: 4, level: 5, levelFinal: 13 },
      sazonal: { tipo: null, escudo: false },
    };
    expect(servico.calibracao([sessao])?.componentes?.fatorDano).toBeCloseTo(1, 1);
  });

  it('analisa o time na hunt, do melhor para o pior XP/h', () => {
    const { servico, estado } = criar();
    const hunt = estado.huntPorSlug('geodude')!;
    const time = servico.analisarTime(
      hunt,
      estado.jogador()!.pokemons,
      { fator: 1, sessoes: 1 },
      MULTIPLICADORES_NEUTROS,
    );
    expect(time.map((t) => t.pokemon.nome)).toEqual(['Squirtle', 'Charmander']);
    const [melhor] = time;
    expect(melhor!.xpPokemonH).toBeCloseTo(melhor!.abatesH * xpDoNivel(hunt.nivel), 6);
    expect(melhor!.tAbateS).toBeGreaterThan(0);
  });

  it('com slots no estado, analisa só a equipe', () => {
    const { servico, estado } = criar({
      pokemons: [{ ...welcome.estado.pokemons[0], slot: 0 }, { ...welcome.estado.pokemons[1] }],
    });
    expect(servico.equipe(estado.jogador()!).map((p) => p.nome)).toEqual(['Charmander']);
  });
});
