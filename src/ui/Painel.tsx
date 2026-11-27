import { useEffect, useRef, useState } from 'preact/hooks';
import type { RespostaBackup } from '../background/gravadorBackup';
import type { Aplicacao, Modelo, ResultadoImportacao } from '../content/aplicacao';
import { ordenar, type Criterio, type LinhaRanking } from '../analysis/ranking';
import type { BonusAtivo } from '../analysis/multiplicadores';
import type { NivelLog } from '../shared/logger';
import { NIVEIS } from '../shared/logger';
import {
  TAMANHOS_PAINEL,
  type AbaPainel,
  type FiltrosUi,
  type PreferenciasUi,
} from '../shared/preferencias';
import { AbaEconomia } from './AbaEconomia';
import { AbaSessao } from './AbaSessao';
import { AbaProgresso } from './AbaProgresso';
import { AbaTime } from './AbaTime';
import { usarArraste } from './arraste';
import { FiltrosContexto, usarFiltros } from './filtros';
import { comSinal, curto, duracao, fracao, numero } from './formatar';
import { notaGeral, notaSinal, notaPercentil } from './tons';
import { Barra, Metrica, Ponto, SeloTipo, Valor } from './visual';

export interface AcoesPainel {
  exportarDados(): void;
  exportarLogs(): void;
  limparHistorico(): Promise<void>;
  definirNivelLog(nivel: NivelLog): void;
  nivelLog(): NivelLog;
  preferencias(): PreferenciasUi;
  salvarPreferencias(p: PreferenciasUi): void;
  fazerBackup(): Promise<RespostaBackup>;
  importarBackup(textos: string[]): Promise<ResultadoImportacao>;
}

function textoImportacao(r: ResultadoImportacao): string {
  if (!r.formatoValido) return 'Arquivo não reconhecido como backup do helper.';
  const partes = [
    `${numero(r.novas)} novas`,
    `${numero(r.atualizadas)} ${r.atualizadas === 1 ? 'atualizada' : 'atualizadas'}`,
    `${numero(r.mantidas)} já existiam`,
  ];
  if (r.invalidas) partes.push(`${numero(r.invalidas)} inválidas ignoradas`);
  return `Importado: ${partes.join(' · ')}.`;
}

const BARRA = String.fromCharCode(92);

function SecaoBackup({
  acoes,
  automatico,
  definirAutomatico,
}: {
  acoes: AcoesPainel;
  automatico: boolean;
  definirAutomatico: (v: boolean) => void;
}) {
  const [mensagem, definirMensagem] = useState<string | null>(null);
  const backupAgora = async () => {
    const r = await acoes.fazerBackup();
    definirMensagem(
      r.ok
        ? `Backup gravado em Downloads${BARRA}${r.arquivos.map((a) => a.replaceAll('/', BARRA)).join(', ')}`
        : `Não foi possível gravar o backup: ${r.erro}`,
    );
  };
  const importar = async (arquivos: FileList | File[] | null) => {
    const lista = [...(arquivos ?? [])];
    if (lista.length === 0) return;
    try {
      const textos = await Promise.all(lista.map((a) => a.text()));
      definirMensagem(textoImportacao(await acoes.importarBackup(textos)));
    } catch (erro) {
      definirMensagem(
        `Falha ao ler o arquivo: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
    }
  };
  return (
    <>
      <h2 class="secao">Backup em arquivo</h2>
      <div class="controles">
        <label>
          <input
            type="checkbox"
            aria-label="Backup automático"
            checked={automatico}
            onChange={(e) => definirAutomatico((e.target as HTMLInputElement).checked)}
          />
          Backup automático ao fechar cada sessão
        </label>
      </div>
      <div class="controles">
        <button class="acao" onClick={() => void backupAgora()}>
          Fazer backup agora
        </button>
        <label class="acao">
          Importar backup
          <input
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={(e) => void importar((e.target as HTMLInputElement).files)}
          />
        </label>
      </div>
      <p class="muted">
        Grava todas as sessões em{' '}
        {['Downloads', 'pokeidle-helper', 'pokeidle-helper-backup.json'].join(BARRA)} (sobrescreve o
        anterior). Importar mescla sem duplicar.
      </p>
      {mensagem ? <p class="dica">{mensagem}</p> : null}
    </>
  );
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

const PAGINA_HISTORICO = 50;

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

function textoBonus(b: BonusAtivo): string {
  return 'mult' in b ? `${b.rotulo} ×${fracao(b.mult)}` : `${b.rotulo} +${fracao(b.pct)}%`;
}

function AbaHunts({ modelo }: { modelo: Modelo }) {
  const { filtros, definir } = usarFiltros();
  const criterio: Criterio = filtros.huntsCriterio;
  const ocultarAltas = filtros.huntsAteNivelAtivo;
  const definirCriterio = (c: Criterio) => definir({ huntsCriterio: c });
  const definirOcultar = (v: boolean) => definir({ huntsAteNivelAtivo: v });
  const ranking = modelo.ranking;
  if (!ranking) return <p class="muted">O ranking aparece depois do login no jogo.</p>;
  const limite = ocultarAltas && modelo.nivelAtivo !== null ? modelo.nivelAtivo : undefined;
  const linhas = ordenar(ranking.linhas, criterio, limite).slice(0, 60);
  const valorDe = (l: LinhaRanking) => (criterio === 'xp' ? l.xpH : (l.lucroH ?? l.goldH));
  const valores = linhas.map(valorDe);
  const maior = Math.max(1, ...valores);
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
              <td class="num celula-valor">
                <Valor
                  nota={valorDe(l) < 0 ? 0 : notaPercentil(valorDe(l), valores)}
                  titulo={numero(valorDe(l))}
                >
                  {curto(valorDe(l))}
                  {criterio === 'lucro' && l.lucroH === null ? '*' : ''}
                </Valor>
                <Barra
                  fracao={valorDe(l) / maior}
                  nota={valorDe(l) < 0 ? 0 : notaPercentil(valorDe(l), valores)}
                />
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

function AbaOpcoes({
  modelo,
  acoes,
  backupAutomatico,
  definirBackupAutomatico,
}: {
  modelo: Modelo;
  acoes: AcoesPainel;
  backupAutomatico: boolean;
  definirBackupAutomatico: (v: boolean) => void;
}) {
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
      <SecaoBackup
        acoes={acoes}
        automatico={backupAutomatico}
        definirAutomatico={definirBackupAutomatico}
      />
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
  const { filtros, definir } = usarFiltros();
  const filtro = filtros.historicoHunt;
  const definirFiltro = (slug: string) => definir({ historicoHunt: slug });
  const [limite, definirLimite] = useState(PAGINA_HISTORICO);
  const h = app.historico(filtro || undefined, limite);
  const restantes = h.total - h.linhas.length;
  const xpsHistorico = h.linhas.map((l) => l.xpPokemonH);
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
          onChange={(e) => {
            definirFiltro((e.target as HTMLSelectElement).value);
            definirLimite(PAGINA_HISTORICO);
          }}
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
          <Metrica rotulo="XP pokémon/h" valor={curto(h.resumo.xpPokemonH)} />
          <Metrica
            rotulo="Lucro líquido/h"
            valor={comSinal(h.resumo.lucroH)}
            nota={notaSinal(h.resumo.lucroH)}
          />
          <Metrica rotulo="Vendas auto/h" valor={curto(h.resumo.vendasAutoH)} />
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
              <td class="num">
                <Valor
                  nota={notaPercentil(l.xpPokemonH, xpsHistorico)}
                  titulo={numero(l.xpPokemonH)}
                >
                  {curto(l.xpPokemonH)}
                </Valor>
              </td>
              <td class="num">
                <Valor nota={notaSinal(l.lucroH)} titulo={numero(l.lucroH)}>
                  {comSinal(l.lucroH)}
                </Valor>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {restantes > 0 ? (
        <button class="acao mostrar-mais" onClick={() => definirLimite(limite + PAGINA_HISTORICO)}>
          Mostrar mais ({numero(restantes)} restantes)
        </button>
      ) : null}
    </>
  );
}

export function Painel({ app, acoes }: { app: Aplicacao; acoes: AcoesPainel }) {
  const modelo = usarModelo(app);
  const [inicial] = useState(() => acoes.preferencias());
  const [aberto, definirAberto] = useState(false);
  const [aba, definirAbaEstado] = useState<Aba>(inicial.aba);
  const [minimizado, definirMinimizadoEstado] = useState(inicial.minimizado);
  const [tamanho, definirTamanhoEstado] = useState(inicial.tamanho);
  const [backupAutomatico, definirBackupAutomaticoEstado] = useState(inicial.backupAutomatico);
  const [filtros, definirFiltrosEstado] = useState<FiltrosUi>(inicial.filtros);
  const preferencias = useRef<PreferenciasUi>(inicial);
  const secao = useRef<HTMLElement>(null);
  const salvar = (parcial: Partial<PreferenciasUi>) => {
    preferencias.current = { ...preferencias.current, ...parcial };
    acoes.salvarPreferencias(preferencias.current);
  };
  const definirFiltros = (parcial: Partial<FiltrosUi>) => {
    const novos = { ...preferencias.current.filtros, ...parcial };
    definirFiltrosEstado(novos);
    salvar({ filtros: novos });
  };
  const { posicao, iniciar } = usarArraste(inicial.posicao, (p) => salvar({ posicao: p }));
  const definirAba = (a: Aba) => {
    definirAbaEstado(a);
    salvar({ aba: a });
  };
  const definirTamanho = (t: number) => {
    const limitado = Math.min(Math.max(0, t), TAMANHOS_PAINEL.length - 1);
    definirTamanhoEstado(limitado);
    salvar({ tamanho: limitado });
  };
  const dimensao = TAMANHOS_PAINEL[tamanho] ?? TAMANHOS_PAINEL[0];
  const definirMinimizado = (m: boolean) => {
    definirMinimizadoEstado(m);
    salvar({ minimizado: m });
  };
  const alerta =
    modelo.avisos.length > 0 ||
    modelo.sessao?.tipo?.classificacao === 'desvantagem' ||
    modelo.sessao?.dano.perigo === true;
  const s = modelo.sessao;
  const estadoGeral = notaGeral(
    s
      ? {
          lucroRealH: s.taxas.lucroRealH,
          autonomiaMs: s.autonomia.limitante?.msRestante ?? null,
          desmaios: s.desmaios,
          perigo: s.dano.perigo,
        }
      : null,
  );
  const estiloPainel = {
    ...(dimensao ? { width: `${dimensao.largura}px`, maxHeight: `${dimensao.alturaVh}vh` } : {}),
    ...(posicao
      ? { left: `${posicao.x}px`, top: `${posicao.y}px`, right: 'auto', bottom: 'auto' }
      : {}),
  };
  return (
    <FiltrosContexto.Provider value={{ filtros, definir: definirFiltros }}>
      <button
        class={`botao-flutuante${alerta ? ' alerta' : ''}`}
        title="PokeIdle Helper"
        aria-expanded={aberto}
        onClick={() => definirAberto(!aberto)}
      >
        PH
        <Ponto nota={estadoGeral} />
      </button>
      {aberto ? (
        <section
          ref={secao}
          class={`painel${minimizado ? ' minimizado' : ''}`}
          aria-label="PokeIdle Helper"
          style={estiloPainel}
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
              aria-label="Diminuir painel"
              title="Diminuir painel"
              disabled={tamanho <= 0}
              onClick={() => definirTamanho(tamanho - 1)}
            >
              ↙
            </button>
            <button
              class="botao-janela"
              aria-label="Aumentar painel"
              title="Aumentar painel"
              disabled={tamanho >= TAMANHOS_PAINEL.length - 1}
              onClick={() => definirTamanho(tamanho + 1)}
            >
              ↗
            </button>
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
                {aba === 'opcoes' ? (
                  <AbaOpcoes
                    modelo={modelo}
                    acoes={acoes}
                    backupAutomatico={backupAutomatico}
                    definirBackupAutomatico={(v) => {
                      definirBackupAutomaticoEstado(v);
                      salvar({ backupAutomatico: v });
                    }}
                  />
                ) : null}
              </div>
            </>
          )}
        </section>
      ) : null}
    </FiltrosContexto.Provider>
  );
}
