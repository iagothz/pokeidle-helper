import { useEffect, useState } from 'preact/hooks';
import type { Aplicacao, Modelo, ModeloSessao } from '../content/aplicacao';
import { ordenar, type Criterio, type LinhaRanking } from '../analysis/ranking';
import type { Classificacao } from '../analysis/dicasTipo';
import type { NivelLog } from '../shared/logger';
import { NIVEIS } from '../shared/logger';
import { duracao, fracao, numero } from './formatar';

export interface AcoesPainel {
  exportarDados(): void;
  exportarLogs(): void;
  limparHistorico(): Promise<void>;
  definirNivelLog(nivel: NivelLog): void;
  nivelLog(): NivelLog;
}

type Aba = 'sessao' | 'hunts' | 'opcoes';

const ROTULO_FONTE: Record<LinhaRanking['fonte'], string> = {
  real: 'real',
  'real-pouca-amostra': 'pouca amostra',
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
      {sessao.tipo?.perigo ? (
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
      </div>
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
    </>
  );
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
        </label>
      </div>
      {ranking.fatorEficiencia === null ? (
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

export function Painel({ app, acoes }: { app: Aplicacao; acoes: AcoesPainel }) {
  const modelo = usarModelo(app);
  const [aberto, definirAberto] = useState(false);
  const [aba, definirAba] = useState<Aba>('sessao');
  const alerta = modelo.avisos.length > 0 || modelo.sessao?.tipo?.classificacao === 'desvantagem';
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
        <section class="painel" aria-label="PokeIdle Helper">
          <div class="cabecalho">
            <h1>PokeIdle Helper</h1>
            <span class="muted">somente leitura</span>
          </div>
          <div class="abas" role="tablist">
            <button
              role="tab"
              aria-selected={aba === 'sessao'}
              onClick={() => definirAba('sessao')}
            >
              Sessão
            </button>
            <button role="tab" aria-selected={aba === 'hunts'} onClick={() => definirAba('hunts')}>
              Hunts
            </button>
            <button
              role="tab"
              aria-selected={aba === 'opcoes'}
              onClick={() => definirAba('opcoes')}
            >
              Opções
            </button>
          </div>
          <div class="conteudo">
            {modelo.avisos.map((a) => (
              <div class="aviso" key={a}>
                {a}
              </div>
            ))}
            {modelo.status === 'aguardando-login' ? (
              <div class="aviso">
                Aguardando os dados de login do jogo. Se o jogo já estava aberto antes do helper ser
                ativado, recarregue a página.
              </div>
            ) : null}
            {aba === 'sessao' ? <AbaSessao sessao={modelo.sessao} /> : null}
            {aba === 'hunts' ? <AbaHunts modelo={modelo} /> : null}
            {aba === 'opcoes' ? <AbaOpcoes modelo={modelo} acoes={acoes} /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
