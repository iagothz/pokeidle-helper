import { useState } from 'preact/hooks';
import type { Calibracao } from '../analysis/calibracao';
import type { Aplicacao, Modelo } from '../content/aplicacao';
import type { AnaliseDoPokemon } from '../content/servicoSimulacao';
import type { PokemonJogador } from '../domain/schemas';
import { duracao, fracao, numero } from './formatar';

const nomeDe = (p: PokemonJogador) => p.nome ?? p.nick ?? `#${String(p.id)}`;

function resistencia(s: number | null): string {
  if (s === null) return '—';
  return s >= 600 ? '10min+' : duracao(s * 1000);
}

function LinhaPokemon({ a, ativo }: { a: AnaliseDoPokemon; ativo: boolean }) {
  return (
    <tr class={ativo ? 'linha-atual' : ''}>
      <td>
        {nomeDe(a.pokemon)} <span class="muted">nv {numero(a.pokemon.level ?? null)}</span>
        <br />
        <span class="muted">
          {fracao(a.acoesPorAbate)} golpes · {fracao(a.tAbateS)} s/abate · aguenta{' '}
          {resistencia(a.segundosParaDesmaiar)}
        </span>
      </td>
      <td class="num">{numero(a.xpPokemonH)}</td>
      <td class="num">{numero(a.abatesH)}</td>
    </tr>
  );
}

function textoCalibracao(cal: Calibracao | null): string {
  return cal
    ? `calibrado por ${numero(cal.sessoes)} sessões: o real rende ${numero(Math.round(cal.fator * 100))}% do simulado`
    : 'sem calibração ainda (cace 5 min com um pokémon para calibrar)';
}

function MelhoresHunts({ app, time }: { app: Aplicacao; time: readonly PokemonJogador[] }) {
  const [escolhido, definirEscolhido] = useState('');
  const [criterio, definirCriterio] = useState<'xp' | 'gold'>('xp');
  const pk = time.find((p) => String(p.id) === escolhido);
  const linhas = pk ? app.melhoresHuntsPara(String(pk.id), criterio, 15) : [];
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
                    <span class="muted">
                      {fracao(l.acoesPorAbate)} golpes · aguenta{' '}
                      {resistencia(l.segundosParaDesmaiar)}
                    </span>
                  </td>
                  <td class="num">{numero(criterio === 'xp' ? l.xpPokemonH : l.goldH)}</td>
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
