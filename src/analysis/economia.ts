import type { CatalogoEspecies } from '../domain/catalogo';
import type { ParametrosCaptura } from '../domain/parametros';
import type { Bola, Hunt } from '../domain/schemas';

export interface Estagio {
  estagio: number;
  elos: number;
}

const ESCADA_TETO: Record<number, number[]> = {
  1: [100],
  2: [40, 100],
  3: [20, 40, 100],
  4: [20, 40, 70, 100],
};
const FATOR_DO_DEGRAU: Record<number, number> = { 20: 2.8669, 40: 3.5745, 100: 4.4681 };
const MULT_CORPO_CAIDO = 1.4;
const CATCH_RATE_GARANTIDO = 255;
const CHANCE_PEDRA_POR_ESTAGIO = [0.2, 0.35, 0.5];
const PEDRA_POR_TIPO: Record<string, string> = {
  NORMAL: 'Sun Stone',
  FIRE: 'Fire Stone',
  WATER: 'Water Stone',
  GRASS: 'Leaf Stone',
  ELECTRIC: 'Thunder Stone',
  ICE: 'Ice Stone',
  FIGHTING: 'Punch Stone',
  POISON: 'Venom Stone',
  GROUND: 'Earth Stone',
  FLYING: 'Feather Stone',
  PSYCHIC: 'Enigma Stone',
  BUG: 'Cocoon Stone',
  ROCK: 'Rock Stone',
  GHOST: 'Darkness Stone',
  DRAGON: 'Ancient Stone',
  DARK: 'Darkness Stone',
  STEEL: 'Metal Stone',
  FAIRY: 'Heart Stone',
};
const CHANCE_OVO_BASE = 1 / 150_000;
const PASSO_OVO = 0.04;
const DEGRAUS_OVO = [
  5000, 5400, 5900, 6400, 6950, 8000, 8600, 10000, 11250, 12750, 14350, 16000, 20000, 21200, 25000,
  26150, 27500, 28950, 30450, 35150, 40000, 42800, 46150, 49650, 53350, 64950, 75000, 84650, 95950,
  108000, 120550, 160300,
];
export const FRAGMENTOS_POR_OVO = 10;

export function estagiosEvolutivos(catalogo: CatalogoEspecies): Map<number, Estagio> {
  const anteriores = new Map<number, number>();
  for (const e of catalogo.todas())
    if (e.evolvesToId && e.evolvesToId !== e.pokeId) anteriores.set(e.evolvesToId, e.pokeId);
  const profundidade = (id: number, sentido: (x: number) => number | undefined) => {
    let n = 0;
    let atual = sentido(id);
    while (atual !== undefined && n < 8) {
      n++;
      atual = sentido(atual);
    }
    return n;
  };
  const proximo = (id: number) => {
    const destino = catalogo.obter(id)?.evolvesToId;
    return destino && destino !== id && catalogo.obter(destino) ? destino : undefined;
  };
  const r = new Map<number, Estagio>();
  for (const e of catalogo.todas()) {
    const atras = profundidade(e.pokeId, (x) => anteriores.get(x));
    const frente = profundidade(e.pokeId, proximo);
    r.set(e.pokeId, { estagio: atras, elos: atras + frente + 1 });
  }
  return r;
}

export function tetoDeCaptura(pokeId: number, estagios: ReadonlyMap<number, Estagio>): number {
  const info = estagios.get(pokeId);
  if (!info) return 100;
  const escada = ESCADA_TETO[Math.min(Math.max(info.elos, 1), 4)] ?? [100];
  return escada[Math.min(info.estagio, escada.length - 1)] ?? 100;
}

export function fatorDeCaptura(
  teto: number,
  peloDegrau: boolean,
  preco: number,
  raridadeDiv: number,
): number {
  if (peloDegrau) return FATOR_DO_DEGRAU[teto] ?? FATOR_DO_DEGRAU[100] ?? 4.4681;
  const raridade = Math.log10(Math.max(100, Number(preco) || 0)) - 1;
  return 1 + raridade ** 3 / raridadeDiv;
}

export function chanceDeCaptura(catchRate: number, fator: number, c: ParametrosCaptura): number {
  if (catchRate >= CATCH_RATE_GARANTIDO) return 1;
  return Math.max(c.piso, Math.min(c.teto, c.base * (catchRate / fator) * MULT_CORPO_CAIDO));
}

const dexDe = (id: number) => (id < 1000 ? id : id % 1000);

export interface CapturaPorBola {
  bolaId: number;
  nome: string;
  preco: number;
  chance: number;
  bolasPorCaptura: number;
  custoPorCaptura: number;
}

export interface CapturaDaEspecie {
  pokeId: number;
  nome: string;
  peso: number;
  porBola: CapturaPorBola[];
  melhorBolaId: number | null;
}

export function analisarCaptura(
  hunt: Hunt,
  catalogo: CatalogoEspecies,
  bolas: readonly Bola[],
  c: ParametrosCaptura,
  todasHunts: readonly Hunt[],
): CapturaDaEspecie[] {
  const estagios = estagiosEvolutivos(catalogo);
  const emHunt = new Set(todasHunts.flatMap((h) => h.especies.map((e) => dexDe(e.pokeId))));
  const total = hunt.especies.reduce((s, e) => s + Math.max(0, e.pontos), 0) || 1;
  const comTaxa = bolas.filter((b) => (b.catchRate ?? 0) > 0);
  return hunt.especies.flatMap(({ pokeId, pontos }) => {
    const esp = catalogo.obter(pokeId);
    if (!esp) return [];
    const fator = fatorDeCaptura(
      tetoDeCaptura(pokeId, estagios),
      emHunt.has(dexDe(pokeId)),
      esp.priceNpc > 0 ? esp.priceNpc : 6.5e9,
      c.raridadeDiv,
    );
    const porBola = comTaxa.map((b): CapturaPorBola => {
      const chance = chanceDeCaptura(b.catchRate ?? 0, fator, c);
      const preco = b.priceGold ?? 0;
      return {
        bolaId: b.id,
        nome: b.name ?? b.nome ?? `Bola ${b.id}`,
        preco,
        chance,
        bolasPorCaptura: 1 / chance,
        custoPorCaptura: preco / chance,
      };
    });
    const melhor = porBola.toSorted((a, b) => a.custoPorCaptura - b.custoPorCaptura)[0];
    return [
      {
        pokeId,
        nome: esp.nome,
        peso: Math.max(0, pontos) / total,
        porBola,
        melhorBolaId: melhor?.bolaId ?? null,
      },
    ];
  });
}

export function pedrasPorAbate(hunt: Hunt, catalogo: CatalogoEspecies): Map<string, number> {
  const estagios = estagiosEvolutivos(catalogo);
  const total = hunt.especies.reduce((s, e) => s + Math.max(0, e.pontos), 0) || 1;
  const r = new Map<string, number>();
  for (const { pokeId, pontos } of hunt.especies) {
    const esp = catalogo.obter(pokeId);
    if (!esp) continue;
    const info = estagios.get(pokeId);
    const estagio = !info || info.elos <= 1 ? 2 : Math.min(Math.max(info.estagio, 0), 2);
    const pct = CHANCE_PEDRA_POR_ESTAGIO[estagio] ?? 0;
    const pedras = new Set(esp.tipos.map((t) => PEDRA_POR_TIPO[t]).filter((p): p is string => !!p));
    for (const pedra of pedras)
      r.set(pedra, (r.get(pedra) ?? 0) + (Math.max(0, pontos) / total) * (pct / 100));
  }
  return r;
}

export function chanceFragmentoOvoShiny(hunt: {
  nivel: number;
  area?: string | undefined;
}): number {
  if (hunt.area === 'outland' || !(hunt.nivel >= (DEGRAUS_OVO[0] ?? Infinity))) return 0;
  const degrau = DEGRAUS_OVO.filter((n) => n <= hunt.nivel).length;
  return CHANCE_OVO_BASE + (degrau - 1) * CHANCE_OVO_BASE * PASSO_OVO;
}
