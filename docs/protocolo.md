# Protocolo do jogo (levantado na v1.488.1, conferido na v1.492.0, 26/11/2026)

## Versão do jogo

A página carrega `app.js?v=<versão>`. O helper lê esse parâmetro ao montar o painel e compara com `VERSAO_JOGO_VALIDADA` (`src/shared/protocolo.ts`). Se forem diferentes, registra um `WARN` e mostra um aviso no painel. A versão aparece em **Opções → Versão do jogo**.

Para validar uma versão nova:

1. Baixar `app.js` e `sessao-hunt.mjs` da versão nova.
2. Confirmar que `contarNaSessao` e `custosDaSessao` continuam iguais à contagem do helper (`src/domain/sessao.ts`) e que os campos das tabelas abaixo ainda existem.
3. Atualizar `VERSAO_JOGO_VALIDADA`, o título deste documento e o CHANGELOG.

Na v1.492.0 a contagem é idêntica à do helper. A única diferença é o evento `bossEntrou` (tokens gastos para entrar num boss), que o jogo lista à parte com preço 0; o helper ainda não o registra.

## Mensagens

O jogo usa um único WebSocket em `wss://pokeidle.io` com mensagens JSON identificadas pelo campo `t`. Ao abrir, o cliente envia `{ t: 'hello', nick, token, delta: 1, dispositivo }`. O helper nunca lê nem reproduz essa mensagem.

## Mensagens recebidas usadas pelo helper

| `t`       | Campos lidos                                                              | Observação                                                                                             |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `welcome` | `estado.eu`, `hunts[]`, `tabelaTipos`, `catalogoBolas[]`, `itensNossos[]` | Uma por conexão. `hunts[]`: `slug`, `nome`, `nivel`, `area`, `regiao`, `especies[{ pokeId, pontos }]`. |
| `estado`  | `estado` (delta)                                                          | Só os campos alterados; merge profundo.                                                                |
| `batalha` | `ev[]`                                                                    | Eventos abaixo.                                                                                        |

`estado.eu` traz `nick`, `level`, `gold`, `activeId`, `huntSlug`, `noCentro` e `pokemons[]` (`id`, `speciesId`, `level`, `nome`, `tipos`).

## Eventos de batalha (`ev[].k`)

| `k`         | Campos                                                                          | Efeito na sessão                              |
| ----------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| `hunt`      | `slug`, `nome`                                                                  | Abre a sessão da hunt (fecha a anterior).     |
| `spawn`     | `speciesId`, `level`, `tipos`                                                   | Conta a espécie.                              |
| `morte`     | `quem`, `xp`, `xpTreinador`, `xpPokemon`, `ouro` (inclui `ouroLoot`), `drops[]` | Só `quem: 'selvagem'` conta abate, XP e gold. |
| `bossMorto` | `xp*`, `valor`, `drops[]`                                                       | XP e gold.                                    |
| `bola`      | `ballId`, `shiny`                                                               | Gasto de bola; `shiny` conta shiny visto.     |
| `capturado` | `pokemon.shiny`                                                                 | Captura.                                      |
| `cura`      | `itemId`                                                                        | Gasto de poção.                               |
| `revive`    | `itemId`                                                                        | Gasto de revive.                              |
| `ataque`    | `golpe`, `tipo`, `dano`, `ef`, `stab`, `por`                                    | Não usado no MVP.                             |

## Assets estáticos

| Caminho                                                 | Uso                                                   |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `/assets/creatures.json` (+ `-novos`, `-outland-novos`) | Tipos, `huntLevel` e tipos dos golpes de cada espécie |
| `/assets/items.json`                                    | Nome e `npcPrice` dos itens                           |

## Fórmulas (de `shared/sell-value.mjs` e `hunt-analyser.mjs`)

- XP por abate: `floor(0,6 · n²) + 8` até o nível 150 (n = `hunt.nivel`).
- Gold por abate: `36 · n^k` (k calibrado para 6000 no nível 5000), mais o loot que leva a renda a +15%.
- Abates/h teórico: ondas de até 16 mobs, 3,5 s por abate e 2,6 s entre ondas.

Verificação no nível 1: 8 XP e 41 de gold (36 + 5 de loot), iguais ao observado no jogo.
