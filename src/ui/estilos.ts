export const ESTILOS = `
:host {
  all: initial;
  --fundo: #161a22; --fundo-2: #1f242f; --fundo-3: #2a303d; --linha: #333a48;
  --texto: #f1f4f8; --texto-2: #a7afbe; --texto-3: #6f7889;
  --bom: #34d27b; --bom-fundo: rgba(52, 210, 123, .14);
  --ruim: #ff5d5d; --ruim-fundo: rgba(255, 93, 93, .14);
  --neutro: #f1f4f8; --info: #7aa7ff; --info-fundo: rgba(122, 167, 255, .12);
  --alerta: #ffb547; --alerta-fundo: rgba(255, 181, 71, .12);
}
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.botao-flutuante { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; width: 46px; height: 46px; border-radius: 50%;
  border: 1px solid var(--linha); background: var(--fundo); color: var(--texto); font-weight: 800; font-size: 13px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,.45); }
.botao-flutuante.alerta { border-color: var(--alerta); }
.botao-flutuante .ponto { position: absolute; top: 2px; right: 2px; width: 12px; height: 12px; border: 2px solid var(--fundo); }
.ponto { display: inline-block; border-radius: 50%; width: 9px; height: 9px; }
.painel { position: fixed; right: 16px; bottom: 72px; z-index: 2147483647; width: 400px; max-height: 76vh; display: flex; flex-direction: column;
  background: var(--fundo); color: var(--texto); border: 1px solid var(--linha); border-radius: 12px; font-size: 12.5px;
  box-shadow: 0 10px 32px rgba(0,0,0,.55); }
.cabecalho { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px;
  border-bottom: 1px solid var(--linha); cursor: move; user-select: none; }
.painel.minimizado .cabecalho { border-bottom: none; }
.cabecalho h1 { font-size: 13px; margin: 0; font-weight: 800; letter-spacing: .2px; }
.botao-janela { background: var(--fundo-3); color: var(--texto); border: 1px solid var(--linha); border-radius: 6px; width: 24px; height: 24px;
  cursor: pointer; font-weight: 700; line-height: 1; }
.botao-janela:disabled { opacity: .35; cursor: default; }
.abas { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 12px 0; }
.abas button, .acao, .seg button { background: var(--fundo-2); color: var(--texto-2); border: 1px solid var(--linha); border-radius: 7px;
  padding: 5px 10px; cursor: pointer; font-size: 12px; font-weight: 600; }
.abas button:hover, .acao:hover, .seg button:hover { color: var(--texto); }
.abas button[aria-selected="true"], .seg button[aria-pressed="true"] { background: var(--texto); color: var(--fundo); border-color: var(--texto); }
.conteudo { overflow: auto; padding: 10px 12px 14px; }


.forte { font-weight: 700; }

.placar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; }
.kpi { background: var(--fundo-2); border-radius: 10px; padding: 8px 9px; border-top: 3px solid var(--linha); min-width: 0; }
.kpi-rotulo { display: block; color: var(--texto-2); font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
.kpi-valor { display: block; font-size: 21px; font-weight: 800; line-height: 1.2; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi-detalhe { display: block; color: var(--texto-2); font-size: 10.5px; line-height: 1.25; }

.grade { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.metrica { background: var(--fundo-2); border-radius: 8px; padding: 6px 8px; border-left: 3px solid var(--linha); }
.metrica span { display: block; color: var(--texto-2); font-size: 11px; }
.metrica strong { font-size: 15px; }
.metrica-detalhe { display: block; color: var(--texto-3); font-size: 10px; font-style: normal; }

.celula-valor { min-width: 86px; }
.barra { display: block; height: 4px; border-radius: 2px; background: var(--fundo-3); margin-top: 3px; overflow: hidden; }
.barra-cheia { display: block; height: 100%; border-radius: 2px; }

.barra-fases { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: var(--fundo-3); margin: 4px 0 6px; }
.fase-luta { background: var(--info); } .fase-deslocamento { background: var(--alerta); } .fase-espera { background: var(--texto-3); }
.legenda-fases { display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
.legenda-fases i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }

.aviso { background: var(--ruim-fundo); border: 1px solid var(--ruim); border-radius: 8px; padding: 7px 9px; margin-bottom: 8px; }
.dica { background: var(--info-fundo); border: 1px solid var(--info); border-radius: 8px; padding: 7px 9px; margin: 8px 0; }
.selo { display: inline-block; border-radius: 4px; padding: 1px 6px; font-size: 10.5px; font-weight: 700; }
.selo.real { background: var(--bom-fundo); color: var(--bom); }
.selo.real-pouca-amostra { background: var(--alerta-fundo); color: var(--alerta); }
.selo.estimado, .selo.simulado { background: var(--info-fundo); color: var(--info); }
.selo.teorico, .selo.neutro, .selo.desconhecido { background: var(--fundo-3); color: var(--texto-2); }
.selo.vantagem { background: var(--bom-fundo); color: var(--bom); }
.selo.desvantagem, .selo.perigo { background: var(--ruim-fundo); color: var(--ruim); }

table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid var(--fundo-3); vertical-align: top; }
th { color: var(--texto-2); font-weight: 700; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; }
td.num, th.num { text-align: right; white-space: nowrap; }
.linha-atual td { background: var(--fundo-2); }
.linha-atual td:first-child { box-shadow: inset 3px 0 0 var(--info); }
.muted { color: var(--texto-2); }
.secao { font-size: 11px; font-weight: 800; margin: 14px 0 5px; color: var(--texto-2); text-transform: uppercase; letter-spacing: .5px; }
.controles { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.seg { display: inline-flex; gap: 2px; }
label { display: inline-flex; gap: 4px; align-items: center; }
select, .campo-nivel { background: var(--fundo-2); color: var(--texto); border: 1px solid var(--linha); border-radius: 6px; padding: 4px 6px; }
.campo-nivel { width: 90px; }
.mostrar-mais { width: 100%; margin-top: 8px; }
.perigo-btn { border-color: var(--ruim); color: var(--ruim); }
dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 8px 0 0; }
dt { color: var(--texto-2); }
dd { margin: 0; }
`;
