import type { Modelo } from '../content/aplicacao';
import type { Economia, FonteRitmo } from '../content/servicoEconomia';
import { duracao, fracao, numero } from './formatar';
import { Valor } from './visual';

const TEXTO_RITMO: Record<FonteRitmo, string> = {
  sessao: 'abates/h medidos nesta sessão',
  simulado: 'abates/h simulados para o seu ativo',
  nenhum: 'sem ritmo ainda',
};

const pct = (v: number) => `${fracao(v * 100)}%`;
const tempo = (ms: number | null) => (ms === null ? 'sem ritmo' : `~${duracao(ms)}`);

function TabelaCaptura({ e }: { e: Economia }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Espécie / bola</th>
          <th class="num">Chance</th>
          <th class="num">Bolas</th>
          <th class="num">Gold/captura</th>
        </tr>
      </thead>
      <tbody>
        {e.capturas.flatMap((c) => {
          const melhor = c.porBola.find((b) => b.bolaId === c.melhorBolaId);
          return [
            <tr key={`esp-${c.pokeId}`}>
              <td colSpan={4}>
                <strong>{c.nome}</strong>{' '}
                <span class="muted">
                  {pct(c.peso)} da hunt{melhor ? ` · melhor: ${melhor.nome}` : ''}
                </span>
              </td>
            </tr>,
            ...c.porBola.map((b) => (
              <tr
                key={`${c.pokeId}-${b.bolaId}`}
                class={b.bolaId === c.melhorBolaId ? 'linha-atual' : ''}
              >
                <td>
                  {b.nome}
                  {e.bolasNoInventario.has(b.bolaId) ? (
                    ''
                  ) : (
                    <span class="muted"> (sem estoque)</span>
                  )}
                </td>
                <td class="num">
                  <Valor
                    nota={
                      !e.bolasNoInventario.has(b.bolaId)
                        ? null
                        : b.bolaId === c.melhorBolaId
                          ? 1
                          : 0.5
                    }
                  >
                    {pct(b.chance)}
                  </Valor>
                </td>
                <td class="num">{numero(Math.round(b.bolasPorCaptura))}</td>
                <td class="num">{numero(b.custoPorCaptura)}</td>
              </tr>
            )),
          ];
        })}
      </tbody>
    </table>
  );
}

export function AbaEconomia({ modelo }: { modelo: Modelo }) {
  const e = modelo.economia;
  if (!e) return <p class="muted">Entre numa hunt para ver captura, shiny e drops dela.</p>;
  return (
    <>
      <p>
        <strong>Economia em {e.huntNome}</strong>{' '}
        <span class="muted">
          · {numero(e.abatesH)} {TEXTO_RITMO[e.fonteRitmo]}
        </span>
      </p>
      <h2 class="secao">Captura (corpo caído, sem boosts)</h2>
      <TabelaCaptura e={e} />
      {e.taxaRealCaptura !== null ? (
        <p class="muted">Sua taxa real nesta sessão: {pct(e.taxaRealCaptura)} dos arremessos.</p>
      ) : null}
      {e.shiny ? (
        <p class="dica">
          1 shiny a cada {numero(Math.round(e.shiny.arremessosPorShiny))} arremessos
          {e.shiny.msAteShiny !== null
            ? ` (${tempo(e.shiny.msAteShiny)} no seu ritmo de bolas)`
            : ''}
          . Shiny Lure dobra a chance.
        </p>
      ) : null}
      <h2 class="secao">Pedras de evolução por hora</h2>
      <table>
        <tbody>
          {e.pedrasH.map((p) => (
            <tr key={p.nome}>
              <td>{p.nome}</td>
              <td class="num">{fracao(p.porHora)}/h</td>
              <td class="num muted">
                {p.porHora > 0 ? `1 a cada ${duracao(3_600_000 / p.porHora)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {e.ovoShiny ? (
        <p class="dica">
          Fragmento de ovo shiny: 1 a cada {numero(Math.round(1 / e.ovoShiny.chancePorAbate))}{' '}
          abates. Você tem {numero(e.ovoShiny.fragmentos)}; faltam {numero(e.ovoShiny.faltam)} para
          o próximo ovo ({tempo(e.ovoShiny.msAte)}).
        </p>
      ) : null}
    </>
  );
}
