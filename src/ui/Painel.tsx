import { useEffect, useRef, useState } from 'preact/hooks';
import type { Aplicacao, Modelo, ModeloSessao } from '../content/aplicacao';
import { ordenar, type Criterio, type LinhaRanking } from '../analysis/ranking';
import type { Autonomia } from '../analysis/autonomia';
import type { Classificacao } from '../analysis/dicasTipo';
import type { PrevisaoNivel } from '../analysis/metas';
import type { BonusAtivo } from '../analysis/multiplicadores';
import type { NivelLog } from '../shared/logger';
import { NIVEIS } from '../shared/logger';
import type { AbaPainel, PreferenciasUi } from '../shared/preferencias';
import { AbaEconomia } from './AbaEconomia';
import { AbaProgresso } from './AbaProgresso';
import { AbaTime } from './AbaTime';
import { usarArraste } from './arraste';
import { duracao, fracao, numero } from './formatar';

export interface AcoesPainel {
  exportarDados(): void;
  exportarLogs(): void;
  limparHistorico(): Promise<void>;
  definirNivelLog(nivel: NivelLog): void;
  nivelLog(): NivelLog;
  preferencias(): PreferenciasUi;
  salvarPreferencias(p: PreferenciasUi): void;
}

type Aba = AbaPainel;

const ABAS: readonly (readonly [Aba, string])[] = [
  ['sessao', 'Sessão'],
  ['time', 'Time'],
  ['progresso', 'Progresso'],
  ['economia', 'Economia'],
  ['hunts', 'Hunts'],
  ['historico', 'Histórico'],
  ['opcoes', 'Opções'],
];

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const ROTULO_FONTE: Record<LinhaRanking['fonte'], string> = {
  real: 'real',
  'real-pouca-amostra': 'pouca amostra',
  simulado: 'simulado',
  estimado: 'estimado',
  teorico: 'teto teórico',
};

const ROTULO_TIPO: Record<Classificacao, string> = {
  vantagem: 'vantagem',
  neutro: 'neutro',
  desvantagem: 'desvantagem',
  desconhecido: '?',
};

function usarModelo(app: Aplicacao, intervaloMs = 1000): Modelo {
  const [modelo, definir] = useState(() => app.modelo());
  useEffect(() => {
    let pendente = false;
    const atualizar = () => {
      if (pendente) return;
      pendente = true;
      setTimeout(() => {
        pendente = false;
        definir(app.modelo());
      }, 250);
    };
    const parar = app.inscrever(atualizar);
    const relogio = setInterval(() => definir(app.modelo()), intervaloMs);
    return () => {
      parar();
      clearInterval(relogio);
    };
  }, [app, intervaloMs]);
  return modelo;
}

function Metrica({ rotulo, valor, classe }: { rotulo: string; valor: string; classe?: string }) {
  return (
    <div class="metrica">
      <span>{rotulo}</span>
      <strong class={classe}>{valor}</strong>
    </div>
  );
}

function SeloTipo({ c, perigo }: { c: Classificacao; perigo?: boolean }) {
  return (
    <>
      <span class={`selo ${c}`}>{ROTULO_TIPO[c]}</span>
      {perigo ? <span class="selo perigo"> apanha forte</span> : null}
    </>
  );
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
              <td class="num">{l.msRestante !== null ? duracao(l.msRestante) : 'medindo'}</td>
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

function AbaSessao({ sessao }: { sessao: ModeloSessao | null }) {
  if (!sessao)
    return <p class="muted">Nenhuma hunt ativa. Entre numa hunt para começar a medir.</p>;
  const t = sessao.taxas;
  const nomeAtivo = sessao.ativo?.nome ?? sessao.ativo?.nick ?? 'seu pokémon ativo';
  return (
    <>
      <p>
        <strong>{sessao.huntNome}</strong>{' '}
        <span class="muted">
          · {duracao(t.msAtivo)} ativo · {numero(sessao.abates)} abates
        </span>
      </p>
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
      <div class="grade">
        <Metrica rotulo="XP pokémon/h" valor={numero(t.xpPokemonH)} />
        <Metrica rotulo="XP treinador/h" valor={numero(t.xpTreinadorH)} />
        <Metrica rotulo="Gold/h" valor={numero(t.goldH)} />
        <Metrica rotulo="Abates/min" valor={fracao(t.abatesMin)} />
        <Metrica rotulo="Consumíveis/h" valor={numero(t.custoH)} />
        <Metrica
          rotulo="Lucro líquido/h"
          valor={numero(t.lucroLiquidoH)}
          classe={t.lucroLiquidoH >= 0 ? 'positivo' : 'negativo'}
        />
        <Metrica rotulo="Vendas auto/h" valor={numero(t.vendasAutoH)} />
        <Metrica
          rotulo="Lucro real/h"
          valor={numero(t.lucroRealH)}
          classe={t.lucroRealH >= 0 ? 'positivo' : 'negativo'}
        />
        <Metrica rotulo="Desmaios" valor={numero(sessao.desmaios)} />
        <Metrica rotulo="XP perdido" valor={numero(sessao.xpPerdido)} />
        <Metrica
          rotulo="Captura"
          valor={
            sessao.capturas + sessao.fugas > 0
              ? `${numero(Math.round((sessao.capturas / (sessao.capturas + sessao.fugas)) * 100))}%`
              : '—'
          }
        />
      </div>
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

function textoBonus(b: BonusAtivo): string {
  return 'mult' in b ? `${b.rotulo} ×${fracao(b.mult)}` : `${b.rotulo} +${fracao(b.pct)}%`;
}

function AbaHunts({ modelo }: { modelo: Modelo }) {
  const [criterio, definirCriterio] = useState<Criterio>('lucro');
  const [ocultarAltas, definirOcultar] = useState(false);
  const ranking = modelo.ranking;
  if (!ranking) return <p class="muted">O ranking aparece depois do login no jogo.</p>;
  const limite = ocultarAltas && modelo.nivelAtivo !== null ? modelo.nivelAtivo : undefined;
  const linhas = ordenar(ranking.linhas, criterio, limite).slice(0, 60);
  return (
    <>
      <div class="controles">
        <div class="seg" role="group" aria-label="Ordenar por">
          <button aria-pressed={criterio === 'lucro'} onClick={() => definirCriterio('lucro')}>
            Lucro/h
          </button>
          <button aria-pressed={criterio === 'xp'} onClick={() => definirCriterio('xp')}>
            XP/h
          </button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={ocultarAltas}
            onChange={(e) => definirOcultar((e.target as HTMLInputElement).checked)}
          />
          até o nível do ativo
          {modelo.nivelAtivo !== null ? ` (${numero(modelo.nivelAtivo)})` : ''}
        </label>
      </div>
      {ranking.multiplicadores.ativos.length ? (
        <p class="dica">
          Estimativas com bônus ativos: {ranking.multiplicadores.ativos.map(textoBonus).join(' · ')}
          . As linhas reais ficam como foram medidas.
        </p>
      ) : null}
      {ocultarAltas && modelo.nivelAtivo === null ? (
        <p class="aviso">
          O nível do pokémon ativo ainda não foi identificado; mostrando todas as hunts.
        </p>
      ) : null}
      {ranking.linhas.some((l) => l.fonte === 'simulado') ? (
        <p class="muted">
          Hunts não visitadas simuladas pela força do seu pokémon ativo (stats, golpes, tipos e HP
          dos selvagens)
          {ranking.calibracao
            ? `, ajustadas pelo seu ritmo real (${numero(Math.round(ranking.calibracao.fator * 100))}% do simulado).`
            : '. Cace 5 min para calibrar com o seu ritmo real.'}
        </p>
      ) : ranking.fatorEficiencia === null ? (
        <p class="muted">
          Sem hunts medidas ainda: os valores são o teto teórico do jogo. Cace pelo menos 15 min
          numa hunt para calibrar.
        </p>
      ) : (
        <p class="muted">
          Estimativas calibradas pelo seu ritmo real ({fracao(ranking.fatorEficiencia * 100)}% do
          teto teórico).
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Hunt</th>
            <th class="num">{criterio === 'xp' ? 'XP/h' : 'Lucro/h'}</th>
            <th>Tipo</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.slug} class={modelo.sessao?.huntSlug === l.slug ? 'linha-atual' : ''}>
              <td>
                {l.nome} <span class="muted">nv {numero(l.nivel)}</span>
                <br />
                <span class={`selo ${l.fonte}`}>{ROTULO_FONTE[l.fonte]}</span>
                {l.melhorPokemon ? (
                  <span class="muted">
                    {' '}
                    · melhor: {l.melhorPokemon.nome ?? l.melhorPokemon.nick}
                  </span>
                ) : null}
                {l.simulacao ? (
                  <span class="muted">
                    {' '}
                    · {fracao(l.simulacao.tAbateS)} s/abate ({fracao(l.simulacao.acoesPorAbate)}{' '}
                    golpes)
                  </span>
                ) : null}
              </td>
              <td class="num">
                {criterio === 'xp'
                  ? numero(l.xpH)
                  : l.lucroH !== null
                    ? numero(l.lucroH)
                    : `${numero(l.goldH)}*`}
              </td>
              <td>
                <SeloTipo c={l.tipo.classificacao} perigo={l.tipo.perigo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {criterio === 'lucro' && linhas.some((l) => l.lucroH === null) ? (
        <p class="muted">* gold bruto: sem dados de consumo para descontar ainda.</p>
      ) : null}
    </>
  );
}

function AbaOpcoes({ modelo, acoes }: { modelo: Modelo; acoes: AcoesPainel }) {
  const [confirmando, definirConfirmando] = useState(false);
  const [nivel, definirNivel] = useState<NivelLog>(acoes.nivelLog());
  const d = modelo.diagnostico;
  return (
    <>
      <div class="controles">
        <button class="acao" onClick={acoes.exportarDados}>
          Exportar dados (JSON)
        </button>
        <button class="acao" onClick={acoes.exportarLogs}>
          Exportar logs
        </button>
      </div>
      <div class="controles">
        <label>
          Nível de log
          <select
            value={nivel}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value as NivelLog;
              definirNivel(v);
              acoes.definirNivelLog(v);
            }}
          >
            {NIVEIS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div class="controles">
        {confirmando ? (
          <>
            <span>Apagar todas as sessões salvas?</span>
            <button
              class="acao perigo-btn"
              onClick={() => {
                definirConfirmando(false);
                void acoes.limparHistorico();
              }}
            >
              Sim, apagar
            </button>
            <button class="acao" onClick={() => definirConfirmando(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button class="acao perigo-btn" onClick={() => definirConfirmando(true)}>
            Limpar histórico
          </button>
        )}
      </div>
      <dl>
        <dt>Versão</dt>
        <dd>{d.versao}</dd>
        <dt>Versão do jogo</dt>
        <dd>{d.versaoJogo ?? 'desconhecida'}</dd>
        <dt>Login capturado</dt>
        <dd>{d.welcome ? 'sim' : 'não'}</dd>
        <dt>Espécies no catálogo</dt>
        <dd>{numero(d.especies)}</dd>
        <dt>Sessões salvas</dt>
        <dd>{numero(d.sessoesSalvas)}</dd>
        <dt>Dados de combate do ativo</dt>
        <dd>
          {d.dadosAtivo
            ? [
                'IVs ' + (d.dadosAtivo.ivs ? 'sim' : 'não'),
                'qualidade ' + (d.dadosAtivo.qualidade ? 'sim' : 'não'),
                'stats ' + (d.dadosAtivo.stats ? 'sim' : 'não'),
              ].join(' · ')
            : 'sem ativo'}
        </dd>
        <dt>Golpes da espécie do ativo</dt>
        <dd>{d.dadosAtivo ? numero(d.dadosAtivo.golpes) : '—'}</dd>
        <dt>Eventos ignorados</dt>
        <dd>{numero(d.eventosInvalidos)}</dd>
        <dt>Captura</dt>
        <dd>
          {d.captura
            ? `${numero(d.captura.publicadas)} publicadas · ${numero(d.captura.erros)} erros`
            : 'aguardando'}
        </dd>
      </dl>
    </>
  );
}

function AbaHistorico({ app }: { app: Aplicacao }) {
  const [filtro, definirFiltro] = useState('');
  const h = app.historico(filtro || undefined);
  if (h.hunts.length === 0)
    return (
      <p class="muted">
        Nenhuma sessão salva ainda. Uma sessão é salva ao trocar de hunt depois de 3 min ativos.
      </p>
    );
  return (
    <>
      <div class="controles">
        <select
          aria-label="Filtrar por hunt"
          value={filtro}
          onChange={(e) => definirFiltro((e.target as HTMLSelectElement).value)}
        >
          <option value="">Todas as hunts</option>
          {h.hunts.map((hunt) => (
            <option key={hunt.slug} value={hunt.slug}>
              {hunt.nome}
            </option>
          ))}
        </select>
      </div>
      {h.resumo ? (
        <div class="grade">
          <Metrica
            rotulo={h.resumo.sessoes === 1 ? '1 sessão' : `${numero(h.resumo.sessoes)} sessões`}
            valor={duracao(h.resumo.msAtivo)}
          />
          <Metrica rotulo="XP pokémon/h" valor={numero(h.resumo.xpPokemonH)} />
          <Metrica
            rotulo="Lucro líquido/h"
            valor={numero(h.resumo.lucroH)}
            classe={h.resumo.lucroH >= 0 ? 'positivo' : 'negativo'}
          />
          <Metrica rotulo="Vendas auto/h" valor={numero(h.resumo.vendasAutoH)} />
        </div>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Sessão</th>
            <th class="num">XP/h</th>
            <th class="num">Lucro/h</th>
          </tr>
        </thead>
        <tbody>
          {h.linhas.map((l) => (
            <tr key={l.id}>
              <td>
                {l.huntNome}
                <br />
                <span class="muted">
                  {formatoData.format(l.inicio)} · {duracao(l.msAtivo)}
                  {l.desmaios ? ` · ${numero(l.desmaios)} desmaios` : ''}
                </span>
              </td>
              <td class="num">{numero(l.xpPokemonH)}</td>
              <td class={`num ${l.lucroH >= 0 ? 'positivo' : 'negativo'}`}>{numero(l.lucroH)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function Painel({ app, acoes }: { app: Aplicacao; acoes: AcoesPainel }) {
  const modelo = usarModelo(app);
  const [inicial] = useState(() => acoes.preferencias());
  const [aberto, definirAberto] = useState(false);
  const [aba, definirAbaEstado] = useState<Aba>(inicial.aba);
  const [minimizado, definirMinimizadoEstado] = useState(inicial.minimizado);
  const preferencias = useRef<PreferenciasUi>(inicial);
  const secao = useRef<HTMLElement>(null);
  const salvar = (parcial: Partial<PreferenciasUi>) => {
    preferencias.current = { ...preferencias.current, ...parcial };
    acoes.salvarPreferencias(preferencias.current);
  };
  const { posicao, iniciar } = usarArraste(inicial.posicao, (p) => salvar({ posicao: p }));
  const definirAba = (a: Aba) => {
    definirAbaEstado(a);
    salvar({ aba: a });
  };
  const definirMinimizado = (m: boolean) => {
    definirMinimizadoEstado(m);
    salvar({ minimizado: m });
  };
  const alerta =
    modelo.avisos.length > 0 ||
    modelo.sessao?.tipo?.classificacao === 'desvantagem' ||
    modelo.sessao?.dano.perigo === true;
  const estiloPosicao = posicao
    ? { left: `${posicao.x}px`, top: `${posicao.y}px`, right: 'auto', bottom: 'auto' }
    : undefined;
  return (
    <>
      <button
        class={`botao-flutuante${alerta ? ' alerta' : ''}`}
        title="PokeIdle Helper"
        aria-expanded={aberto}
        onClick={() => definirAberto(!aberto)}
      >
        PH
      </button>
      {aberto ? (
        <section
          ref={secao}
          class={`painel${minimizado ? ' minimizado' : ''}`}
          aria-label="PokeIdle Helper"
          style={estiloPosicao}
        >
          <div
            class="cabecalho"
            title="Arraste para mover"
            onMouseDown={(e) => iniciar(e, secao.current)}
          >
            <h1>PokeIdle Helper</h1>
            <span class="muted">somente leitura</span>
            <button
              class="botao-janela"
              aria-label={minimizado ? 'Restaurar' : 'Minimizar'}
              title={minimizado ? 'Restaurar' : 'Minimizar'}
              onClick={() => definirMinimizado(!minimizado)}
            >
              {minimizado ? '+' : '–'}
            </button>
          </div>
          {minimizado ? null : (
            <>
              <div class="abas" role="tablist">
                {ABAS.map(([id, rotulo]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={aba === id}
                    onClick={() => definirAba(id)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              <div class="conteudo">
                {modelo.avisos.map((a) => (
                  <div class="aviso" key={a}>
                    {a}
                  </div>
                ))}
                {modelo.status === 'aguardando-login' ? (
                  <div class="aviso">
                    Aguardando os dados de login do jogo. Se o jogo já estava aberto antes do helper
                    ser ativado, recarregue a página.
                  </div>
                ) : null}
                {aba === 'sessao' ? <AbaSessao sessao={modelo.sessao} /> : null}
                {aba === 'hunts' ? <AbaHunts modelo={modelo} /> : null}
                {aba === 'time' ? <AbaTime app={app} modelo={modelo} /> : null}
                {aba === 'progresso' ? <AbaProgresso modelo={modelo} /> : null}
                {aba === 'economia' ? <AbaEconomia modelo={modelo} /> : null}
                {aba === 'historico' ? <AbaHistorico app={app} /> : null}
                {aba === 'opcoes' ? <AbaOpcoes modelo={modelo} acoes={acoes} /> : null}
              </div>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
