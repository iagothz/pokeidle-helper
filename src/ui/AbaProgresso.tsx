import { useState } from 'preact/hooks';
import type { CurvaDaHunt, Modelo, ModeloProgresso } from '../content/aplicacao';
import { etaPelaCurva } from '../analysis/curvaNivel';
import type { BonusAtivo } from '../analysis/multiplicadores';
import { etaComBonus, xpTotalDoNivel, type Eta, type RitmoXp } from '../analysis/progressao';
import type { PokemonJogador } from '../domain/schemas';
import { duracao, fracao, numero } from './formatar';
import { Valor } from './visual';
import { comMeta, usarFiltros } from './filtros';

const nomeDe = (p: PokemonJogador) => p.nome ?? p.nick ?? `#${String(p.id)}`;
const tempo = (ms: number | null) =>
  ms === null ? 'sem ritmo' : ms === 0 ? 'já chegou' : `~${duracao(ms)}`;

const TEXTO_RITMO: Record<ModeloProgresso['ritmo'], string> = {
  sessao: 'no ritmo da sessão atual',
  simulado: 'no ritmo simulado na hunt atual',
  nenhum: 'sem ritmo (entre numa hunt)',
};

function Meta({
  rotulo,
  nivel,
  xp,
  ritmo,
  pelaCurva,
}: {
  rotulo: string;
  nivel: number | null;
  xp: number | null | undefined;
  ritmo: RitmoXp;
  pelaCurva: ((alvo: number) => Eta) | null;
}) {
  const { filtros, definir } = usarFiltros();
  const salvo = filtros.metas[rotulo];
  const [alvo, definirAlvoTexto] = useState(salvo !== undefined ? String(salvo) : '');
  const n = Number(alvo);
  const valido = Number.isInteger(n) && n > (nivel ?? 0) && n <= 1_000_000;
  const definirAlvo = (texto: string) => {
    definirAlvoTexto(texto);
    const lido = Number(texto);
    const guardar = texto !== '' && Number.isInteger(lido) && lido > 0 && lido <= 1_000_000;
    definir({ metas: comMeta(filtros.metas, rotulo, guardar ? lido : null) });
  };
  const eta = !valido
    ? null
    : pelaCurva
      ? pelaCurva(n)
      : etaComBonus(xp ?? xpTotalDoNivel(nivel ?? 1), n, ritmo);
  return (
    <tr>
      <td>
        {rotulo} <span class="muted">nv {numero(nivel)}</span>
      </td>
      <td>
        <input
          class="campo-nivel"
          type="number"
          min={(nivel ?? 0) + 1}
          aria-label={`Nível-alvo do ${rotulo.toLowerCase()}`}
          placeholder="nível-alvo"
          value={alvo}
          onInput={(e) => definirAlvo((e.target as HTMLInputElement).value)}
        />
      </td>
      <td class="num">
        {eta ? (
          <>
            faltam {numero(eta.faltam)} XP
            <br />
            <span class="muted">
              {tempo(eta.msAte)}
              {pelaCurva ? ' pela curva' : ''}
            </span>
          </>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}

function textoDoBonus(b: BonusAtivo, agora: number): string {
  const valor = 'mult' in b ? `×${fracao(b.mult)}` : `+${fracao(b.pct)}%`;
  const vence = b.ate !== undefined && b.ate > agora ? ` (vence em ${duracao(b.ate - agora)})` : '';
  return `${b.rotulo} ${valor}${vence}`;
}

function BonusDasMetas({ bonus }: { bonus: ModeloProgresso['bonus'] }) {
  if (!bonus.ativos.length) return null;
  const vencem = bonus.ativos.some((b) => b.ate !== undefined && b.ate > bonus.agora);
  return (
    <p class="dica">
      Bônus ativos: {bonus.ativos.map((b) => textoDoBonus(b, bonus.agora)).join(' · ')}.
      {vencem ? ' Os tempos já contam o fim de cada bônus.' : ''}
    </p>
  );
}

const NIVEIS_AMOSTRA_CONFIAVEL = 10;
const R2_CONFIAVEL = 0.5;

function ProgressaoPorNivel({ c }: { c: CurvaDaHunt }) {
  const { amostra, golpes } = c.curva;
  const { atual, teto, linhas, limiteNivel, fracaoTeto } = c.projecao;
  const fraca = amostra.niveis < NIVEIS_AMOSTRA_CONFIAVEL || golpes.r2 < R2_CONFIAVEL;
  return (
    <>
      <h2 class="secao">Progressão por nível em {c.huntNome}</h2>
      <p class="muted">
        Ajuste em {numero(amostra.niveis)} níveis (nv {numero(amostra.nivelMin)}–
        {numero(amostra.nivelMax)}, {numero(amostra.abates)} abates)
        {c.tipoSazonal ? ` no dia ${c.tipoSazonal}` : ''}.
      </p>
      <p>
        Agora: {fracao(atual.golpesPorAbate)} golpes/abate, {numero(atual.abatesH)} abates/h,{' '}
        {numero(atual.xpH)} XP/h. Você está em{' '}
        <Valor nota={fracaoTeto}>{Math.round(fracaoTeto * 100)}%</Valor> do teto da hunt (
        {numero(teto.xpH)} XP/h e {numero(teto.goldH)} gold/h com 1 golpe por abate).
      </p>
      {linhas.length ? (
        <table>
          <thead>
            <tr>
              <th>Nível</th>
              <th class="num">Golpes</th>
              <th class="num">XP/h</th>
              <th class="num">Gold/h</th>
              <th class="num">Chega em</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.level}>
                <td>nv {numero(l.level)}</td>
                <td class="num">{fracao(l.golpesPorAbate)}</td>
                <td class="num">{numero(l.xpH)}</td>
                <td class="num">{numero(l.goldH)}</td>
                <td class="num">{tempo(l.msAte)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {limiteNivel !== null ? (
        <p class="muted">
          Limite atual: nv {numero(limiteNivel)} (treinador + 5)
          {linhas.length ? '.' : '; o pokémon já está no limite.'}
        </p>
      ) : null}
      {fraca ? (
        <p class="dica">Amostra pequena ou dispersa: a projeção ainda pode mudar bastante.</p>
      ) : null}
    </>
  );
}

export function AbaProgresso({ modelo }: { modelo: Modelo }) {
  const p = modelo.progresso;
  if (!p) return <p class="muted">O progresso aparece depois do login no jogo.</p>;
  const ativo = p.ativo;
  const curva = p.curvaNivel?.curva ?? null;
  const nivelT = p.treinador.level;
  const nivelP = ativo?.pokemon.level;
  const pelaCurva = (quem: 'treinador' | 'pokemon') =>
    curva && nivelT !== null && nivelP !== undefined
      ? (alvo: number) =>
          etaPelaCurva(curva, {
            quem,
            alvo,
            treinador: { nivel: nivelT, xp: p.treinador.xp ?? undefined },
            pokemon: { nivel: nivelP, xp: ativo?.pokemon.xp },
            xpBasePorAbate: p.curvaNivel?.bonus.xpBasePorAbate ?? 0,
            faixas: p.curvaNivel?.bonus.faixas ?? [],
          })
      : null;
  return (
    <>
      <h2 class="secao">Metas de nível</h2>
      <p class="muted">
        {curva
          ? `Tempo pela curva de ${p.curvaNivel?.huntNome ?? 'hunt atual'}: o XP/h muda a cada nível do ativo, que sobe até treinador + 5.`
          : `Tempo ${TEXTO_RITMO[p.ritmo]}.`}
      </p>
      <BonusDasMetas bonus={p.bonus} />
      <table>
        <tbody>
          <Meta
            rotulo="Treinador"
            nivel={p.treinador.level}
            xp={p.treinador.xp}
            ritmo={p.ritmoTreinador}
            pelaCurva={pelaCurva('treinador')}
          />
          {ativo ? (
            <Meta
              rotulo="Ativo"
              nivel={ativo.pokemon.level ?? null}
              xp={ativo.pokemon.xp}
              ritmo={p.ritmoPokemon}
              pelaCurva={pelaCurva('pokemon')}
            />
          ) : null}
        </tbody>
      </table>
      {p.curvaNivel ? <ProgressaoPorNivel c={p.curvaNivel} /> : null}
      {ativo?.evolucao ? (
        <p class="dica">
          {nomeDe(ativo.pokemon)} evolui no nv {numero(ativo.evolucao.nivelEvolucao)}: faltam{' '}
          {numero(ativo.evolucao.faltamXp)} XP, cerca de {numero(ativo.evolucao.abates)} abates (
          {tempo(ativo.evolucao.msAte)}).
        </p>
      ) : null}
      <h2 class="secao">Pokémons travados pelo nível do treinador</h2>
      {p.travados.length ? (
        <table>
          <tbody>
            {p.travados.map((t) => (
              <tr key={String(t.pokemon.id)}>
                <td>
                  {nomeDe(t.pokemon)}{' '}
                  <span class="muted">
                    nv {numero(t.pokemon.level ?? null)} · libera com o treinador no nv{' '}
                    {numero(t.nivelTreinadorNecessario)}
                  </span>
                </td>
                <td class="num">
                  <Valor nota={0}>{numero(t.faltamXp)} XP</Valor>
                  <br />
                  <span class="muted">{tempo(t.msAte)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p class="muted">Nenhum: todos os seus pokémons podem lutar (nível ≤ treinador + 5).</p>
      )}
      {ativo && ativo.refino.length ? (
        <>
          <h2 class="secao">Refino de {nomeDe(ativo.pokemon)}</h2>
          <table>
            <thead>
              <tr>
                <th>Stat</th>
                <th class="num">Pontos</th>
                <th class="num">Próximo custa</th>
              </tr>
            </thead>
            <tbody>
              {ativo.refino.map((r) => (
                <tr key={r.stat}>
                  <td>{r.stat}</td>
                  <td class="num">{numero(r.pontos)}</td>
                  <td class="num">{numero(r.proximo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="muted">Cada ponto de refino soma +1 ao stat base; o custo cresce com o cubo.</p>
        </>
      ) : null}
    </>
  );
}
