import type { Autonomia } from '../analysis/autonomia';
import type { PrevisaoNivel } from '../analysis/metas';
import type { ModeloSessao } from '../content/aplicacao';
import { comSinal, curto, duracao, fracao, numero } from './formatar';
import {
  notaAutonomia,
  notaContagem,
  notaDinamica,
  notaSuperEfetivos,
  type Nota,
  type NotaDinamica,
} from './tons';
import { Kpi, Metrica, SeloTipo, Valor, explicar } from './visual';

const AMOSTRA_PARA_COMPARAR_MS = 2 * 60_000;

function dinamico(
  sessao: ModeloSessao,
  valor: number,
  chave: 'xp' | 'lucro' | 'gold' | 'abates',
): NotaDinamica {
  if (sessao.taxas.msAtivo < AMOSTRA_PARA_COMPARAR_MS)
    return { nota: valor < 0 ? 0 : 0.5, percentil: null, vsHistorico: null };
  const ref = sessao.referencia;
  return notaDinamica(valor, ref.outras[chave], ref.historico?.[chave] ?? null);
}

function detalheDe(d: NotaDinamica, sessao: ModeloSessao): string {
  if (sessao.taxas.msAtivo < AMOSTRA_PARA_COMPARAR_MS) return 'medindo…';
  return explicar(d) || 'sem outras hunts para comparar';
}

function PainelAutonomia({ autonomia }: { autonomia: Autonomia }) {
  if (autonomia.linhas.length === 0) return null;
  const limite = autonomia.limitante;
  return (
    <>
      <h2 class="secao">Autonomia</h2>
      {limite ? (
        <p class={limite.msRestante !== null && limite.msRestante < 15 * 60_000 ? 'aviso' : ''}>
          Dá para ficar ~{duracao(limite.msRestante ?? 0)} no ritmo atual (acaba primeiro:{' '}
          {limite.nome}).
        </p>
      ) : (
        <p class="muted">Medindo o consumo: precisa de 5 min ativos e 3 usos de cada item.</p>
      )}
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Estoque</th>
            <th class="num">Uso/h</th>
            <th class="num">Acaba em</th>
          </tr>
        </thead>
        <tbody>
          {autonomia.linhas.map((l) => (
            <tr key={`${l.categoria}-${l.id}`}>
              <td>{l.nome}</td>
              <td class="num">{numero(l.estoque)}</td>
              <td class="num">{l.suficiente ? numero(Math.round(l.porHora)) : '—'}</td>
              <td class="num">
                {l.msRestante !== null ? (
                  <Valor nota={l.categoria === 'bola' ? 0.5 : notaAutonomia(l.msRestante)}>
                    {duracao(l.msRestante)}
                  </Valor>
                ) : (
                  <span class="muted">medindo</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function LinhaMeta({ rotulo, p }: { rotulo: string; p: PrevisaoNivel }) {
  return (
    <tr>
      <td>
        {rotulo}
        {p.nivelAlvo !== null ? ` nv ${numero(p.nivelAlvo)}` : ''}
      </td>
      <td class="num">{numero(Math.floor(p.progresso * 100))}%</td>
      <td class="num">{numero(p.faltam)}</td>
      <td class="num">{p.msAte !== null ? `~${duracao(p.msAte)}` : '—'}</td>
    </tr>
  );
}

function PainelMetas({ metas, nomeAtivo }: { metas: ModeloSessao['metas']; nomeAtivo: string }) {
  if (!metas.treinador && !metas.pokemon) return null;
  return (
    <>
      <h2 class="secao">Próximo nível</h2>
      <table>
        <thead>
          <tr>
            <th>Alvo</th>
            <th class="num">Feito</th>
            <th class="num">Faltam</th>
            <th class="num">No ritmo</th>
          </tr>
        </thead>
        <tbody>
          {metas.treinador ? <LinhaMeta rotulo="Treinador" p={metas.treinador} /> : null}
          {metas.pokemon ? <LinhaMeta rotulo={nomeAtivo} p={metas.pokemon} /> : null}
        </tbody>
      </table>
    </>
  );
}

function Alertas({ sessao, nomeAtivo }: { sessao: ModeloSessao; nomeAtivo: string }) {
  return (
    <>
      {sessao.tipo && sessao.tipo.classificacao === 'desvantagem' ? (
        <div class="aviso">
          {nomeAtivo} está em desvantagem de tipo aqui (dano médio ×{fracao(sessao.tipo.ofensiva)}).
        </div>
      ) : null}
      {sessao.dano.suficiente ? (
        <div class={sessao.dano.perigo ? 'aviso' : 'dica'}>
          {numero(Math.round(sessao.dano.fracaoSuperEfetivos * 100))}% dos golpes recebidos foram
          super efetivos ({numero(sessao.dano.golpes)} golpes, dano médio{' '}
          {numero(Math.round(sessao.dano.danoMedio))}).
          {sessao.dano.perigo ? ' Atenção às poções.' : ''}
        </div>
      ) : sessao.tipo?.perigo ? (
        <div class="aviso">
          Os pokémon desta hunt acertam {nomeAtivo} com super efetivo; atenção às poções.
        </div>
      ) : null}
      {sessao.sugestao ? (
        <div class="dica">
          Dica: {sessao.sugestao.nome ?? sessao.sugestao.nick ?? 'outro pokémon'} do seu time rende
          mais nesta hunt.
        </div>
      ) : null}
    </>
  );
}

function Placar({ sessao }: { sessao: ModeloSessao }) {
  const t = sessao.taxas;
  const lucro = dinamico(sessao, t.lucroLiquidoH, 'lucro');
  const xp = dinamico(sessao, t.xpPokemonH, 'xp');
  const limite = sessao.autonomia.limitante;
  const notaAuto: Nota | null = limite ? notaAutonomia(limite.msRestante) : null;
  return (
    <div class="placar">
      <Kpi
        rotulo="Lucro/h"
        valor={comSinal(t.lucroRealH)}
        nota={t.lucroRealH < 0 ? 0 : lucro.nota}
        detalhe={detalheDe(lucro, sessao)}
        titulo={`Real (com vendas automáticas): ${numero(t.lucroRealH)} · líquido como o jogo: ${numero(t.lucroLiquidoH)}`}
      />
      <Kpi
        rotulo="XP/h"
        valor={curto(t.xpPokemonH)}
        nota={xp.nota}
        detalhe={detalheDe(xp, sessao)}
        titulo={`${numero(t.xpPokemonH)} XP de pokémon por hora`}
      />
      <Kpi
        rotulo="Autonomia"
        valor={limite?.msRestante != null ? `~${duracao(limite.msRestante)}` : '—'}
        nota={notaAuto}
        detalhe={limite ? `acaba: ${limite.nome}` : 'medindo consumo'}
      />
    </div>
  );
}

function Grade({ sessao }: { sessao: ModeloSessao }) {
  const t = sessao.taxas;
  const gold = dinamico(sessao, t.goldH, 'gold');
  const abates = dinamico(sessao, t.abatesH, 'abates');
  const tentativas = sessao.capturas + sessao.fugas;
  return (
    <div class="grade">
      <Metrica rotulo="Gold/h" valor={curto(t.goldH)} nota={gold.nota} titulo={explicar(gold)} />
      <Metrica
        rotulo="Abates/min"
        valor={fracao(t.abatesMin)}
        nota={abates.nota}
        titulo={explicar(abates)}
      />
      <Metrica rotulo="XP treinador/h" valor={curto(t.xpTreinadorH)} />
      <Metrica rotulo="Consumíveis/h" valor={curto(t.custoH)} />
      <Metrica
        rotulo="Lucro líquido/h"
        valor={comSinal(t.lucroLiquidoH)}
        nota={t.lucroLiquidoH < 0 ? 0 : 0.5}
      />
      <Metrica
        rotulo="Vendas auto/h"
        valor={curto(t.vendasAutoH)}
        nota={t.vendasAutoH > 0 ? 1 : 0.5}
      />
      <Metrica
        rotulo="Lucro real/h"
        valor={comSinal(t.lucroRealH)}
        nota={t.lucroRealH < 0 ? 0 : 0.5}
      />
      <Metrica
        rotulo="Desmaios"
        valor={numero(sessao.desmaios)}
        nota={notaContagem(sessao.desmaios)}
      />
      <Metrica
        rotulo="XP perdido"
        valor={numero(sessao.xpPerdido)}
        nota={notaContagem(sessao.xpPerdido)}
      />
      <Metrica
        rotulo="Captura"
        valor={
          tentativas > 0 ? `${numero(Math.round((sessao.capturas / tentativas) * 100))}%` : '—'
        }
      />
      {sessao.dano.suficiente ? (
        <Metrica
          rotulo="Super efetivos recebidos"
          valor={`${numero(Math.round(sessao.dano.fracaoSuperEfetivos * 100))}%`}
          nota={notaSuperEfetivos(sessao.dano.fracaoSuperEfetivos)}
        />
      ) : null}
    </div>
  );
}

function PainelTempo({ sessao }: { sessao: ModeloSessao }) {
  const f = sessao.fases;
  const total = f.lutaMs + f.deslocamentoMs + f.esperaMs;
  if (total <= 0) return null;
  const abates = Math.max(1, sessao.abates);
  const partes = [
    {
      chave: 'luta',
      rotulo: 'Lutando',
      ms: f.lutaMs,
      por: `${fracao(f.lutaMs / 1000 / abates)} s/abate`,
    },
    {
      chave: 'deslocamento',
      rotulo: 'Andando',
      ms: f.deslocamentoMs,
      por: `${fracao(f.deslocamentoMs / 1000 / abates)} s/abate`,
    },
    {
      chave: 'espera',
      rotulo: 'Esperando onda',
      ms: f.esperaMs,
      por: f.ondas > 0 ? `${fracao(f.esperaMs / 1000 / f.ondas)} s/onda` : '—',
    },
  ];
  const pct = (ms: number) => Math.round((ms / total) * 100);
  return (
    <>
      <h2 class="secao">Onde vai o tempo</h2>
      <div class="barra-fases" aria-hidden="true">
        {partes.map((p) => (
          <span
            key={p.chave}
            class={`fase-${p.chave}`}
            style={{ width: `${(p.ms / total) * 100}%` }}
          />
        ))}
      </div>
      <div class="legenda-fases">
        {partes.map((p) => (
          <span key={p.chave}>
            <i class={`fase-${p.chave}`} />
            {p.rotulo} <strong>{numero(pct(p.ms))}%</strong> <span class="muted">{p.por}</span>
          </span>
        ))}
      </div>
      {sessao.golpesDados > 0 ? (
        <p class="muted">
          {fracao(sessao.golpesDados / abates)} golpes por abate · dano médio{' '}
          {numero(Math.round(sessao.danoCausado / sessao.golpesDados))}
        </p>
      ) : null}
    </>
  );
}

export function AbaSessao({ sessao }: { sessao: ModeloSessao | null }) {
  if (!sessao)
    return <p class="muted">Nenhuma hunt ativa. Entre numa hunt para começar a medir.</p>;
  const nomeAtivo = sessao.ativo?.nome ?? sessao.ativo?.nick ?? 'seu pokémon ativo';
  return (
    <>
      <p>
        <strong>{sessao.huntNome}</strong>{' '}
        <span class="muted">
          · {duracao(sessao.taxas.msAtivo)} ativo · {numero(sessao.abates)} abates
        </span>
      </p>
      <Alertas sessao={sessao} nomeAtivo={nomeAtivo} />
      <Placar sessao={sessao} />
      <Grade sessao={sessao} />
      <PainelTempo sessao={sessao} />
      <PainelMetas
        metas={sessao.metas}
        nomeAtivo={sessao.ativo?.nome ?? sessao.ativo?.nick ?? 'Pokémon ativo'}
      />
      {sessao.tipo ? (
        <p>
          Tipo do ativo nesta hunt:{' '}
          <SeloTipo c={sessao.tipo.classificacao} perigo={sessao.tipo.perigo} />
        </p>
      ) : null}
      {sessao.consumidos.length ? (
        <table>
          <thead>
            <tr>
              <th>Consumível</th>
              <th class="num">Qtd</th>
              <th class="num">Custo</th>
            </tr>
          </thead>
          <tbody>
            {sessao.consumidos.map((c) => (
              <tr key={c.nome}>
                <td>{c.nome}</td>
                <td class="num">{numero(c.qtd)}</td>
                <td class="num">{numero(c.custo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p class="muted">Nenhum consumível usado nesta sessão.</p>
      )}
      <PainelAutonomia autonomia={sessao.autonomia} />
      {sessao.drops.length ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Drop</th>
                <th class="num">Qtd</th>
                <th class="num">1 a cada</th>
              </tr>
            </thead>
            <tbody>
              {sessao.drops.map((d) => (
                <tr key={d.nome}>
                  <td>{d.nome}</td>
                  <td class="num">{numero(d.qtd)}</td>
                  <td class="num">
                    {d.aCadaAbates !== null ? `${numero(Math.round(d.aCadaAbates))} abates` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="muted">
            Desde 15/10/2026 o NPC não compra esses itens: só valem no Mercado da comunidade.
          </p>
        </>
      ) : null}
    </>
  );
}
