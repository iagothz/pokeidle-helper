import type { Calibracao } from '../analysis/calibracao';
import type { Aplicacao, Modelo } from '../content/aplicacao';
import type { AnaliseDoPokemon } from '../content/servicoSimulacao';
import type { PokemonJogador } from '../domain/schemas';
import { curto, duracao, fracao, numero } from './formatar';
import { notaGolpes, notaResistencia, notaVsMelhor } from './tons';
import { Barra, Valor } from './visual';
import { usarFiltros } from './filtros';

const nomeDe = (p: PokemonJogador) => p.nome ?? p.nick ?? `#${String(p.id)}`;

function resistencia(s: number | null): string {
  if (s === null) return '—';
  return s >= 600 ? '10min+' : duracao(s * 1000);
}

function Detalhes({
  golpes,
  tAbateS,
  segundosParaDesmaiar,
}: {
  golpes: number;
  tAbateS: number;
  segundosParaDesmaiar: number | null;
}) {
  return (
    <span class="muted">
      <Valor nota={notaGolpes(golpes)}>{fracao(golpes)} golpes</Valor> · {fracao(tAbateS)} s/abate ·
      aguenta{' '}
      <Valor nota={notaResistencia(segundosParaDesmaiar, tAbateS)}>
        {resistencia(segundosParaDesmaiar)}
      </Valor>
    </span>
  );
}

function LinhaPokemon({
  a,
  ativo,
  melhor,
}: {
  a: AnaliseDoPokemon;
  ativo: boolean;
  melhor: number;
}) {
  const tom = notaVsMelhor(a.xpPokemonH, melhor);
  return (
    <tr class={ativo ? 'linha-atual' : ''}>
      <td>
        {nomeDe(a.pokemon)} <span class="muted">nv {numero(a.pokemon.level ?? null)}</span>
        <br />
        <Detalhes
          golpes={a.acoesPorAbate}
          tAbateS={a.tAbateS}
          segundosParaDesmaiar={a.segundosParaDesmaiar}
        />
      </td>
      <td class="num celula-valor">
        <Valor nota={tom} titulo={numero(a.xpPokemonH)}>
          {curto(a.xpPokemonH)}
        </Valor>
        <Barra fracao={melhor > 0 ? a.xpPokemonH / melhor : 0} nota={tom} />
      </td>
      <td class="num">{numero(a.abatesH)}</td>
    </tr>
  );
}

function textoCalibracao(cal: Calibracao | null): string {
  if (!cal) return 'sem calibração ainda (cace 5 min com um pokémon para calibrar)';
  const partes = [`calibrado por ${numero(cal.sessoes)} sessões`];
  const c = cal.componentes;
  if (c?.fatorDano) partes.push(`dano real ×${fracao(c.fatorDano)} do simulado`);
  if (c?.deslocamentoPorAbateS !== null && c?.deslocamentoPorAbateS !== undefined)
    partes.push(`andando ${fracao(c.deslocamentoPorAbateS)} s/abate`);
  if (c?.esperaPorOndaS !== null && c?.esperaPorOndaS !== undefined)
    partes.push(`espera ${fracao(c.esperaPorOndaS)} s/onda`);
  partes.push(`ajuste final ×${fracao(cal.fator)}`);
  return partes.join(' · ');
}

function MelhoresHunts({ app, time }: { app: Aplicacao; time: readonly PokemonJogador[] }) {
  const { filtros, definir } = usarFiltros();
  const escolhido = filtros.timePokemon;
  const criterio = filtros.timeCriterio;
  const definirEscolhido = (id: string) => definir({ timePokemon: id });
  const definirCriterio = (c: 'xp' | 'gold') => definir({ timeCriterio: c });
  const pk = time.find((p) => String(p.id) === escolhido);
  const linhas = pk ? app.melhoresHuntsPara(String(pk.id), criterio, 15) : [];
  const valorDe = (l: (typeof linhas)[number]) => (criterio === 'xp' ? l.xpPokemonH : l.goldH);
  const melhorValor = linhas[0] ? valorDe(linhas[0]) : 0;
  return (
    <>
      <h2 class="secao">Simular outras hunts</h2>
      <div class="controles">
        <select
          aria-label="Pokémon"
          value={escolhido}
          onChange={(e) => definirEscolhido((e.target as HTMLSelectElement).value)}
        >
          <option value="">Escolha um pokémon</option>
          {time.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {nomeDe(p)} (nv {numero(p.level ?? null)})
            </option>
          ))}
        </select>
        <div class="seg" role="group" aria-label="Ordenar hunts por">
          <button aria-pressed={criterio === 'xp'} onClick={() => definirCriterio('xp')}>
            XP/h
          </button>
          <button aria-pressed={criterio === 'gold'} onClick={() => definirCriterio('gold')}>
            Gold/h
          </button>
        </div>
      </div>
      {pk ? (
        <>
          <p class="muted">Melhores hunts para {nomeDe(pk)}, simuladas pela força dele:</p>
          <table>
            <thead>
              <tr>
                <th>Hunt</th>
                <th class="num">{criterio === 'xp' ? 'XP/h' : 'Gold/h'}</th>
                <th class="num">s/abate</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.slug}>
                  <td>
                    {l.nome} <span class="muted">nv {numero(l.nivel)}</span>
                    <br />
                    <Detalhes
                      golpes={l.acoesPorAbate}
                      tAbateS={l.tAbateS}
                      segundosParaDesmaiar={l.segundosParaDesmaiar}
                    />
                  </td>
                  <td class="num celula-valor">
                    <Valor nota={notaVsMelhor(valorDe(l), melhorValor)} titulo={numero(valorDe(l))}>
                      {curto(valorDe(l))}
                    </Valor>
                    <Barra
                      fracao={melhorValor > 0 ? valorDe(l) / melhorValor : 0}
                      nota={notaVsMelhor(valorDe(l), melhorValor)}
                    />
                  </td>
                  <td class="num">{fracao(l.tAbateS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </>
  );
}

export function AbaTime({ app, modelo }: { app: Aplicacao; modelo: Modelo }) {
  const t = modelo.time;
  if (!t)
    return <p class="muted">Entre numa hunt para simular o seu time contra os selvagens dela.</p>;
  const time = t.linhas.map((l) => l.pokemon);
  return (
    <>
      <p>
        <strong>Seu time em {t.huntNome}</strong>{' '}
        <span class="muted">nv {numero(t.huntNivel)}</span>
      </p>
      <p class="muted">{textoCalibracao(t.calibracao)}</p>
      {t.linhas.length ? (
        <table>
          <thead>
            <tr>
              <th>Pokémon</th>
              <th class="num">XP/h</th>
              <th class="num">Abates/h</th>
            </tr>
          </thead>
          <tbody>
            {t.linhas.map((a) => (
              <LinhaPokemon
                key={String(a.pokemon.id)}
                a={a}
                ativo={String(a.pokemon.id) === t.ativoId}
                melhor={t.linhas[0]?.xpPokemonH ?? 0}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <p class="muted">Faltam os dados de espécie dos seus pokémons para simular.</p>
      )}
      <p class="muted">
        “Golpes” é quantos ataques seu pokémon precisa por abate; “aguenta” é quanto tempo ele
        resiste a um selvagem sem poção.
      </p>
      <MelhoresHunts app={app} time={time} />
    </>
  );
}
