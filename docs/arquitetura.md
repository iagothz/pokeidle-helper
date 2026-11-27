# Arquitetura

O helper tem cinco camadas com fluxo de mão única. Só a Captura roda no contexto da página. As outras rodam no content script isolado e recebem uma cópia já filtrada das mensagens.

```
Página do jogo (app.js) ── WebSocket wss://pokeidle.io
        │ cópia das mensagens (ouvinte passivo)
        ▼
capture/  (world MAIN)  ── fila assíncrona, filtra tipos, remove dados sensíveis
        │ window.postMessage (envelope versionado)
        ▼
bridge/   (isolado)     ── valida source, origin e envelope (Zod)
        ▼
content/Aplicacao       ── orquestra domínio, persistência e análise
   ├── domain/          estado do jogo (welcome + deltas), sessões, catálogos
   ├── persistence/     IndexedDB: sessões e logs
   └── analysis/        fórmulas, tipos, taxas, ranking
        ▼
ui/       (Shadow DOM)  ── painel Preact, atualizado no máximo a cada 250 ms
```

## Decisões

| Decisão                                                                                                                              | Motivo                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subclasse de `WebSocket` com `addEventListener('message')` no construtor                                                             | Não substitui `onmessage` nem `send`; o jogo recebe o evento original intacto.                                                                                                                                    |
| O ouvinte só enfileira a string e agenda o processamento com `setTimeout(0)`                                                         | O parse, o filtro e o `postMessage` acontecem depois do handler do jogo, fora do caminho crítico (p95 abaixo de 1 ms, testado).                                                                                   |
| `JSON.parse` capturado no momento da instalação                                                                                      | Imune a alterações posteriores feitas pela página.                                                                                                                                                                |
| Apenas `welcome`, `estado` e `batalha` cruzam a ponte                                                                                | `campo` (cerca de 100 por minuto) e `chat` não são usados no MVP.                                                                                                                                                 |
| Estado do jogador reconstruído com a mesma lógica de `shared/estado-delta.mjs` (`MescladorEstado`)                                   | O `estado` é o próprio jogador; os parciais usam `Object.assign` raso e `pkMud`/`pkFora` para os pokémons. Até a v0.2.0 o helper esperava um envelope `eu` que não existe, e por isso não achava o pokémon ativo. |
| Contagem da sessão igual à `contarNaSessao` do jogo                                                                                  | Os números batem com o painel SESSÃO, o que facilita a conferência.                                                                                                                                               |
| Preços pelo `npcPrice` e pelo `priceGold` das bolas                                                                                  | O mesmo critério do jogo (`custosDaSessao`).                                                                                                                                                                      |
| Fórmulas de XP, gold e abates/h replicadas de `shared/sell-value.mjs`, `shared/recompensa-hunt.mjs` e `hunt-analyser.mjs` (v1.488.1) | Estimativas coerentes com o jogo; versão registrada em `VERSAO_FORMULAS`.                                                                                                                                         |
| Zod importado como namespace (`import * as z`)                                                                                       | Permite tree-shaking: o `content.js` caiu de 497 KB para 150 KB.                                                                                                                                                  |
| Shadow DOM `open` anexado ao `documentElement`                                                                                       | Isola o CSS dos dois lados e não toca nos elementos do jogo.                                                                                                                                                      |

## Simulação de combate

`analysis/simulador.ts` reproduz as fórmulas do jogo (ver `docs/protocolo.md`) e calcula, por espécie da hunt, o dano por segundo do pokémon com a alocação gulosa dos golpes (maior dano primeiro, limitado pela recarga e pelo intervalo global), as ações por abate e o tempo por abate (luta + 2,6 s de deslocamento + onda). `content/servicoSimulacao.ts` monta o atacante a partir do estado, calibra pela mediana de real ÷ simulado nas sessões que registraram o pokémon e analisa o time. As regras puras do jogo ficam em `domain/` (`cadencia.ts`, `parametros.ts`, `golpesPlanilhas.ts`); `analysis/` só depende de `domain/`.

| Decisão                                                          | Motivo                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Ler `golpes-planilhas.mjs` como texto com regex                  | MV3 proíbe código remoto; as tabelas são literais `[nome, tipo, categoria, poder]` |
| Modelo de regime (DPS estável) em vez de simulação passo a passo | Barato para centenas de hunts e suficiente depois da calibração                    |
| IV e qualidade médios para os selvagens                          | São sorteados no servidor; a calibração absorve o erro                             |

## Dados persistidos

Banco IndexedDB `pokeidle-helper`, versão 1:

| Store     | Chave                    | Índices                | Conteúdo                                                       |
| --------- | ------------------------ | ---------------------- | -------------------------------------------------------------- |
| `sessoes` | `id` (`<slug>-<inicio>`) | `porHunt`, `porInicio` | Uma `Sessao` (ver `src/domain/sessao.ts`), com `schemaVersion` |
| `logs`    | autoincremento           | `porSegmento`          | Entradas de log com o número do segmento                       |
| `meta`    | texto                    | —                      | Segmento de log atual e bytes usados                           |

As migrações ficam em `MIGRACOES` (`src/persistence/banco.ts`), uma função por versão, sempre aditivas.

## Logs

Formato: `{ ts, nivel, modulo, msg, ctx? }`. Os destinos são o console (prefixo `[PokeIdle Helper]`) e o IndexedDB, gravado em lote a cada 2 s, em segmentos de até 5 MB, mantendo os 3 mais recentes. A exportação fica em **Opções → Exportar logs**.

## Tratamento de erros

- A captura nunca lança para o jogo: erros incrementam um contador que é publicado a cada 30 s como diagnóstico.
- Mensagens e eventos fora do formato são ignorados com `WARN` (eventos com log no 1º e a cada 100).
- Falhas de IndexedDB viram aviso no painel e o helper continua em memória.
- Ouvintes da interface e do estado são isolados: a falha de um não derruba os outros.
