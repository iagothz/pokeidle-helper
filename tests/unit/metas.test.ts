import { describe, expect, it } from 'vitest';
import { previsaoDeNivel } from '../../src/analysis/metas';

const HORA = 3_600_000;

describe('previsaoDeNivel', () => {
  it('calcula XP restante, progresso e tempo até o próximo nível', () => {
    expect(previsaoDeNivel({ level: 9, xp: 1500, xpNivel: 1000, xpProximo: 3000 }, 750)).toEqual({
      nivelAlvo: 10,
      faltam: 1500,
      progresso: 0.25,
      msAte: 2 * HORA,
    });
  });

  it('com ritmo por faixas de bônus conta o vencimento do boost', () => {
    const p = previsaoDeNivel(
      { level: 9, xp: 1000, xpNivel: 1000, xpProximo: 3000 },
      {
        xpHBase: 500,
        quem: 'xpTreinador',
        faixas: [
          { horas: 1, xpTreinador: 2, xpPokemon: 1 },
          { horas: Infinity, xpTreinador: 1, xpPokemon: 1 },
        ],
      },
    );
    expect(p?.msAte).toBe(3 * HORA);
  });

  it('sem ritmo positivo não estima o tempo', () => {
    expect(previsaoDeNivel({ level: 1, xp: 0, xpNivel: 0, xpProximo: 10 }, 0)?.msAte).toBeNull();
  });

  it('sem os campos de XP não há previsão', () => {
    expect(previsaoDeNivel({ level: 1 }, 100)).toBeNull();
    expect(previsaoDeNivel(undefined, 100)).toBeNull();
  });

  it('limita o progresso entre 0 e 1 e o restante a zero', () => {
    const p = previsaoDeNivel({ level: 5, xp: 5000, xpNivel: 1000, xpProximo: 3000 }, 10)!;
    expect(p).toMatchObject({ faltam: 0, progresso: 1, msAte: 0, nivelAlvo: 6 });
    expect(previsaoDeNivel({ xp: 10, xpProximo: 20 }, 10)).toMatchObject({
      nivelAlvo: null,
      progresso: 0,
    });
  });
});
