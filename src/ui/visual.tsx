import type { ComponentChildren } from 'preact';
import type { Classificacao } from '../analysis/dicasTipo';
import { numero } from './formatar';
import { corDaNota, type Nota, type NotaDinamica } from './tons';

const ROTULO_TIPO: Record<Classificacao, string> = {
  vantagem: 'vantagem',
  neutro: 'neutro',
  desvantagem: 'desvantagem',
  desconhecido: '?',
};

const LINHA = 'var(--linha)';
const APAGADO = 'var(--texto-3)';

const destaque = (nota: Nota | null | undefined) =>
  nota !== null && nota !== undefined && Math.abs(nota - 0.5) > 0.12;

export function Valor({
  nota,
  children,
  titulo,
}: {
  nota: Nota | null;
  children: ComponentChildren;
  titulo?: string | undefined;
}) {
  return (
    <span
      class={destaque(nota) ? 'forte' : undefined}
      style={{ color: corDaNota(nota) ?? APAGADO }}
      title={titulo}
    >
      {children}
    </span>
  );
}

export function Kpi({
  rotulo,
  valor,
  nota,
  detalhe,
  titulo,
}: {
  rotulo: string;
  valor: string;
  nota: Nota | null;
  detalhe?: string | undefined;
  titulo?: string | undefined;
}) {
  const cor = corDaNota(nota);
  return (
    <div
      class="kpi"
      title={titulo}
      style={{
        borderTopColor: cor ?? LINHA,
        ...(cor
          ? {
              background: `linear-gradient(180deg, color-mix(in srgb, ${cor} 15%, transparent), var(--fundo-2) 75%)`,
            }
          : {}),
      }}
    >
      <span class="kpi-rotulo">{rotulo}</span>
      <strong class="kpi-valor" style={{ color: cor ?? APAGADO }}>
        {valor}
      </strong>
      {detalhe ? <span class="kpi-detalhe">{detalhe}</span> : null}
    </div>
  );
}

export function Metrica({
  rotulo,
  valor,
  nota,
  detalhe,
  titulo,
}: {
  rotulo: string;
  valor: string;
  nota?: Nota | null | undefined;
  detalhe?: string | undefined;
  titulo?: string | undefined;
}) {
  const cor = nota === undefined ? null : corDaNota(nota);
  return (
    <div class="metrica" title={titulo} style={{ borderLeftColor: cor ?? LINHA }}>
      <span>{rotulo}</span>
      <strong class={destaque(nota) ? 'forte' : undefined} style={cor ? { color: cor } : undefined}>
        {valor}
      </strong>
      {detalhe ? <em class="metrica-detalhe">{detalhe}</em> : null}
    </div>
  );
}

export function Barra({ fracao, nota }: { fracao: number; nota: Nota | null }) {
  const largura = Math.round(Math.min(1, Math.max(0, fracao)) * 100);
  return (
    <span class="barra" aria-hidden="true">
      <span
        class="barra-cheia"
        style={{ width: `${largura}%`, background: corDaNota(nota) ?? APAGADO }}
      />
    </span>
  );
}

export function Ponto({ nota }: { nota: Nota | null }) {
  return (
    <span class="ponto" aria-hidden="true" style={{ background: corDaNota(nota) ?? APAGADO }} />
  );
}

export function SeloTipo({ c, perigo }: { c: Classificacao; perigo?: boolean | undefined }) {
  return (
    <>
      <span class={`selo ${c}`}>{ROTULO_TIPO[c]}</span>
      {perigo ? <span class="selo perigo"> apanha forte</span> : null}
    </>
  );
}

export function explicar(d: NotaDinamica): string {
  const partes: string[] = [];
  if (d.percentil !== null)
    partes.push(`melhor que ${numero(Math.round(d.percentil * 100))}% das hunts`);
  if (d.vsHistorico !== null) {
    const pct = Math.round(d.vsHistorico * 100);
    partes.push(`${pct > 0 ? '+' : ''}${numero(pct)}% vs sua média`);
  }
  return partes.join(' · ');
}
