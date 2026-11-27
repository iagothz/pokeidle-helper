import { useState } from 'preact/hooks';
import type { Modelo, ModeloProgresso } from '../content/aplicacao';
import { etaParaNivel, xpTotalDoNivel } from '../analysis/progressao';
import type { PokemonJogador } from '../domain/schemas';
import { duracao, numero } from './formatar';

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
  xpH,
}: {
  rotulo: string;
  nivel: number | null;
  xp: number | null | undefined;
  xpH: number;
}) {
  const [alvo, definirAlvo] = useState('');
  const n = Number(alvo);
  const valido = Number.isInteger(n) && n > (nivel ?? 0) && n <= 1_000_000;
  const eta = valido ? etaParaNivel(xp ?? xpTotalDoNivel(nivel ?? 1), n, xpH) : null;
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
            <span class="muted">{tempo(eta.msAte)}</span>
          </>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}

export function AbaProgresso({ modelo }: { modelo: Modelo }) {
  const p = modelo.progresso;
  if (!p) return <p class="muted">O progresso aparece depois do login no jogo.</p>;
  const ativo = p.ativo;
  return (
    <>
      <h2 class="secao">Metas de nível</h2>
      <p class="muted">Tempo {TEXTO_RITMO[p.ritmo]}.</p>
      <table>
        <tbody>
          <Meta
            rotulo="Treinador"
            nivel={p.treinador.level}
            xp={p.treinador.xp}
            xpH={p.treinador.xpH}
          />
          {ativo ? (
            <Meta
              rotulo="Ativo"
              nivel={ativo.pokemon.level ?? null}
              xp={ativo.pokemon.xp}
              xpH={ativo.xpH}
            />
          ) : null}
        </tbody>
      </table>
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
                  {numero(t.faltamXp)} XP
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
