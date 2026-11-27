import { describe, expect, it } from 'vitest';
import { MedidorFases, FASES_ZERADAS } from '../../src/domain/medidorFases';

const spawn = { k: 'spawn' } as const;
const ataque = { k: 'ataque', por: 'jogador' } as const;
const golpeRecebido = { k: 'ataque', por: 'selvagem' } as const;
const morte = { k: 'morte', quem: 'selvagem' } as const;

describe('MedidorFases', () => {
  it('separa espera de onda, deslocamento e luta pelo horário dos eventos', () => {
    const m = new MedidorFases(60_000);
    m.registrar(spawn, 0);
    m.registrar(spawn, 0);
    m.registrar(ataque, 2_000);
    m.registrar(golpeRecebido, 2_500);
    m.registrar(ataque, 3_000);
    m.registrar(morte, 5_000);
    m.registrar(ataque, 6_500);
    m.registrar(morte, 8_000);
    m.registrar(spawn, 11_000);
    m.registrar(ataque, 12_000);
    expect(m.resultado()).toEqual({
      lutaMs: 3_000 + 1_500,
      deslocamentoMs: 2_000 + 1_500 + 1_000,
      esperaMs: 3_000,
      ondas: 2,
    });
  });

  it('descarta intervalos acima da pausa máxima', () => {
    const m = new MedidorFases(60_000);
    m.registrar(spawn, 0);
    m.registrar(ataque, 1_000);
    m.registrar(morte, 2_000);
    m.registrar(spawn, 500_000);
    m.registrar(ataque, 501_000);
    expect(m.resultado()).toEqual({ lutaMs: 1_000, deslocamentoMs: 2_000, esperaMs: 0, ondas: 2 });
  });

  it('ignora morte do jogador e não deixa a contagem de vivos ficar negativa', () => {
    const m = new MedidorFases(60_000);
    m.registrar(morte, 0);
    m.registrar({ k: 'morte', quem: 'jogador' }, 100);
    m.registrar(spawn, 1_000);
    m.registrar(ataque, 1_500);
    m.registrar(morte, 2_500);
    expect(m.resultado()).toMatchObject({ lutaMs: 1_000, deslocamentoMs: 500, ondas: 1 });
  });

  it('começa zerado e pode recomeçar', () => {
    const m = new MedidorFases(60_000);
    expect(m.resultado()).toEqual(FASES_ZERADAS);
    m.registrar(spawn, 0);
    m.registrar(ataque, 1_000);
    m.reiniciar();
    expect(m.resultado()).toEqual(FASES_ZERADAS);
  });
});

describe('MedidorFases.fechar', () => {
  it('conta a fase em andamento até o fim da sessão, respeitando a pausa máxima', () => {
    const m = new MedidorFases(60_000);
    m.registrar({ k: 'spawn' }, 0);
    m.registrar({ k: 'ataque', por: 'jogador' }, 1_000);
    m.registrar({ k: 'morte', quem: 'selvagem' }, 2_000);
    m.fechar(5_000);
    expect(m.resultado().esperaMs).toBe(3_000);
    m.fechar(500_000);
    expect(m.resultado().esperaMs).toBe(3_000);
  });
});
