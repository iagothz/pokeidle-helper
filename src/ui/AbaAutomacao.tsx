import { useEffect, useState } from 'preact/hooks';
import type { ModeloAutomacao } from '../content/automacao/servicoAutomacao';
import type { FimViagem } from '../content/automacao/viagem';
import {
  regraPadrao,
  type CriterioRotacao,
  type KindCompra,
  type PreferenciasAutomacao,
  type RegraReposicao,
} from '../shared/preferenciasAutomacao';
import { numero } from './formatar';

export interface ItemCompravel {
  kind: KindCompra;
  id: number;
  nome: string;
  preco: number;
  estoque: number;
}

export interface AcoesAutomacao {
  preferencias(): PreferenciasAutomacao;
  salvar(p: PreferenciasAutomacao): void;
  modelo(): ModeloAutomacao;
  viajar(slug: string): boolean;
  cancelarViagem(): void;
  itensCompraveis(): ItemCompravel[];
}

const TEXTO_FIM: Record<FimViagem, string> = {
  chegou: 'chegou',
  'tempo-esgotado': 'desistiu após 60 s',
  cancelada: 'cancelada',
  'troca-manual': 'cancelada (troca manual)',
};

const CRITERIOS: readonly (readonly [CriterioRotacao, string])[] = [
  ['lucro', 'Lucro/h'],
  ['xp', 'XP/h'],
  ['nivel', 'Maior nível'],
];

export function usarModeloAutomacao(acoes: AcoesAutomacao, intervaloMs = 1000): ModeloAutomacao {
  const [modelo, definir] = useState(() => acoes.modelo());
  useEffect(() => {
    const relogio = setInterval(() => definir(acoes.modelo()), intervaloMs);
    return () => clearInterval(relogio);
  }, [acoes, intervaloMs]);
  return modelo;
}

const formatoHora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function Chave({
  rotulo,
  marcado,
  aoMudar,
  desabilitado = false,
}: {
  rotulo: string;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  desabilitado?: boolean;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={marcado}
        disabled={desabilitado}
        onChange={(e) => aoMudar((e.target as HTMLInputElement).checked)}
      />
      {rotulo}
    </label>
  );
}

function inteiro(valor: string, padrao: number): number {
  const n = Math.floor(Number(valor));
  return Number.isFinite(n) && n >= 0 ? n : padrao;
}

function SecaoReposicao({
  prefs,
  itens,
  salvar,
  desabilitado,
}: {
  prefs: PreferenciasAutomacao;
  itens: ItemCompravel[];
  salvar: (r: PreferenciasAutomacao['reposicao']) => void;
  desabilitado: boolean;
}) {
  const r = prefs.reposicao;
  const regraDe = (i: ItemCompravel) => r.regras.find((x) => x.kind === i.kind && x.id === i.id);
  const trocarRegra = (i: ItemCompravel, nova: RegraReposicao | null) => {
    const resto = r.regras.filter((x) => !(x.kind === i.kind && x.id === i.id));
    salvar({ ...r, regras: nova ? [...resto, nova] : resto });
  };
  return (
    <>
      <div class="controles">
        <Chave
          rotulo="Comprar balls, poções e revives automaticamente"
          marcado={r.ligada}
          desabilitado={desabilitado}
          aoMudar={(v) => salvar({ ...r, ligada: v })}
        />
        <label>
          Reserva de gold
          <input
            class="campo-nivel"
            type="number"
            min={0}
            value={r.reservaGold}
            onChange={(e) =>
              salvar({ ...r, reservaGold: inteiro((e.target as HTMLInputElement).value, 0) })
            }
          />
        </label>
      </div>
      {itens.length === 0 ? (
        <p class="muted">A lista da loja aparece depois do login no jogo.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="num">Tem</th>
              <th class="num">Mínimo</th>
              <th class="num">Alvo</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const regra = regraDe(i);
              return (
                <tr key={`${i.kind}:${i.id}`}>
                  <td>
                    <Chave
                      rotulo={i.nome}
                      marcado={!!regra}
                      aoMudar={(v) => trocarRegra(i, v ? regraPadrao(i.kind, i.id) : null)}
                    />{' '}
                    <span class="muted">{numero(i.preco)} gold</span>
                  </td>
                  <td class="num">{numero(i.estoque)}</td>
                  {(['minimo', 'alvo'] as const).map((campo) => (
                    <td class="num" key={campo}>
                      {regra ? (
                        <input
                          class="campo-nivel"
                          type="number"
                          min={0}
                          value={regra[campo]}
                          onChange={(e) => {
                            const v = inteiro((e.target as HTMLInputElement).value, regra[campo]);
                            const nova = { ...regra, [campo]: v };
                            if (nova.alvo > nova.minimo) trocarRegra(i, nova);
                          }}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export function AbaAutomacao({ acoes }: { acoes: AcoesAutomacao }) {
  const modelo = usarModeloAutomacao(acoes);
  const [prefs, definirPrefs] = useState(() => acoes.preferencias());
  const salvar = (parcial: Partial<PreferenciasAutomacao>) => {
    const novo = { ...prefs, ...parcial };
    definirPrefs(novo);
    acoes.salvar(novo);
  };
  const desligada = !prefs.ligada;
  const v = modelo.viagem;
  return (
    <>
      <div class="controles">
        <Chave
          rotulo="Ligar automações"
          marcado={prefs.ligada}
          aoMudar={(ligada) => salvar({ ligada })}
        />
      </div>
      <p class="muted">
        Com a chave desligada o helper não envia nada ao jogo. Ligada, ele só envia as ações abaixo,
        no máximo uma por segundo de cada tipo.
      </p>

      <h2 class="secao">Viagem</h2>
      <div class="controles">
        <Chave
          rotulo="Viajar ao clicar numa hunt (aba Hunts)"
          marcado={prefs.viagem}
          desabilitado={desligada}
          aoMudar={(viagem) => salvar({ viagem })}
        />
      </div>
      {v ? (
        <div class="dica">
          Indo para <b>{v.alvo}</b> · tentativa {numero(v.tentativas)}{' '}
          <button class="acao" onClick={() => acoes.cancelarViagem()}>
            Cancelar
          </button>
        </div>
      ) : modelo.ultimaViagem ? (
        <p class="muted">
          Última viagem: {modelo.ultimaViagem.alvo} · {TEXTO_FIM[modelo.ultimaViagem.fim]} (
          {numero(modelo.ultimaViagem.tentativas)} tentativas)
        </p>
      ) : null}

      <h2 class="secao">Captura</h2>
      <div class="controles">
        <Chave
          rotulo="Capturar espécies que faltam na pokédex"
          marcado={prefs.autoBallDex}
          desabilitado={desligada}
          aoMudar={(autoBallDex) => salvar({ autoBallDex })}
        />
      </div>
      <p class="muted">
        {modelo.vip
          ? 'VIP: liga o "lançar até capturar" do jogo quando aparece uma espécie sem captura.'
          : 'Sem VIP: arremessa a bola escolhida no painel de caídos do jogo, só nas espécies sem captura.'}
      </p>

      <h2 class="secao">Time</h2>
      <div class="controles">
        <Chave
          rotulo="Trocar o ativo pelo melhor da hunt ao chegar"
          marcado={prefs.melhorAtivo}
          desabilitado={desligada}
          aoMudar={(melhorAtivo) => salvar({ melhorAtivo })}
        />
      </div>

      <h2 class="secao">Rotação de hunts</h2>
      <div class="controles">
        <Chave
          rotulo="Ir para outra hunt quando o nível liberar uma nova"
          marcado={prefs.rotacao.ligada}
          desabilitado={desligada}
          aoMudar={(ligada) => salvar({ rotacao: { ...prefs.rotacao, ligada } })}
        />
        <label>
          Escolher por
          <select
            value={prefs.rotacao.criterio}
            onChange={(e) =>
              salvar({
                rotacao: {
                  ...prefs.rotacao,
                  criterio: (e.target as HTMLSelectElement).value as CriterioRotacao,
                },
              })
            }
          >
            {CRITERIOS.map(([id, rotulo]) => (
              <option key={id} value={id}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h2 class="secao">Reposição</h2>
      <SecaoReposicao
        prefs={prefs}
        itens={acoes.itensCompraveis()}
        desabilitado={desligada}
        salvar={(reposicao) => salvar({ reposicao })}
      />

      {modelo.comandos.length ? (
        <>
          <h2 class="secao">Últimas ações</h2>
          <table>
            <tbody>
              {modelo.comandos.map((c) => (
                <tr key={c.id}>
                  <td class="muted">{formatoHora.format(c.em)}</td>
                  <td>
                    {c.t} · {c.resumo}
                  </td>
                  <td class={c.situacao === 'recusado' ? 'erro-texto' : 'muted'}>
                    {c.situacao}
                    {c.motivo ? ` (${c.motivo})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </>
  );
}
