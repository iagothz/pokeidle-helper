export const ESTILOS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.botao-flutuante { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid #3b4252; background: #1f2430; color: #e5e9f0; font-weight: 700; font-size: 13px; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,.35); }
.botao-flutuante.alerta { border-color: #d08770; color: #ebcb8b; }
.painel { position: fixed; right: 16px; bottom: 70px; z-index: 2147483647; width: 380px; max-height: 70vh; display: flex; flex-direction: column;
  background: #1f2430; color: #e5e9f0; border: 1px solid #3b4252; border-radius: 10px; font-size: 12.5px; box-shadow: 0 6px 24px rgba(0,0,0,.45); }
.cabecalho { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #3b4252; }
.cabecalho h1 { font-size: 13px; margin: 0; font-weight: 700; }
.abas { display: flex; gap: 4px; padding: 8px 12px 0; }
.abas button, .acao, .seg button { background: #2e3440; color: #d8dee9; border: 1px solid #3b4252; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 12px; }
.abas button[aria-selected="true"], .seg button[aria-pressed="true"] { background: #4c566a; color: #fff; }
.conteudo { overflow: auto; padding: 10px 12px 12px; }
.grade { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.metrica { background: #2e3440; border-radius: 6px; padding: 6px 8px; }
.metrica span { display: block; color: #a3abba; font-size: 11px; }
.metrica strong { font-size: 14px; }
.positivo { color: #a3be8c; } .negativo { color: #bf616a; }
.aviso { background: #3b2f2f; border: 1px solid #d08770; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; }
.dica { background: #2b3540; border: 1px solid #5e81ac; border-radius: 6px; padding: 6px 8px; margin: 8px 0; }
.selo { display: inline-block; border-radius: 4px; padding: 1px 6px; font-size: 10.5px; font-weight: 600; }
.selo.real { background: #a3be8c33; color: #a3be8c; } .selo.real-pouca-amostra { background: #ebcb8b33; color: #ebcb8b; }
.selo.estimado { background: #81a1c133; color: #81a1c1; } .selo.teorico { background: #4c566a; color: #d8dee9; }
.selo.vantagem { background: #a3be8c33; color: #a3be8c; } .selo.desvantagem { background: #bf616a33; color: #e08a92; }
.selo.neutro, .selo.desconhecido { background: #4c566a; color: #d8dee9; } .selo.perigo { background: #d0877033; color: #d08770; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 5px 4px; border-bottom: 1px solid #2e3440; vertical-align: top; }
th { color: #a3abba; font-weight: 600; font-size: 11px; }
td.num, th.num { text-align: right; white-space: nowrap; }
.linha-atual td { background: #2b3540; }
.muted { color: #a3abba; }
.controles { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.seg { display: inline-flex; gap: 2px; }
label { display: inline-flex; gap: 4px; align-items: center; }
select { background: #2e3440; color: #e5e9f0; border: 1px solid #3b4252; border-radius: 6px; padding: 3px; }
.perigo-btn { border-color: #bf616a; color: #e08a92; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 8px 0 0; }
dt { color: #a3abba; }
dd { margin: 0; }
`;
