# Protocolo do jogo (levantado na v1.488.1, conferido na v1.492.0, 26/11/2026)

## Versão do jogo

A página carrega `app.js?v=<versão>`. O helper lê esse parâmetro ao montar o painel e compara com `VERSAO_JOGO_VALIDADA` (`src/shared/protocolo.ts`). Se forem diferentes, registra um `WARN` e mostra um aviso no painel. A versão aparece em **Opções → Versão do jogo**.

Para validar uma versão nova:

1. Baixar `app.js`, `sessao-hunt.mjs`, `hunt-analyser.mjs` e `shared/estado-delta.mjs` da versão nova.
2. Confirmar que `contarNaSessao` e `custosDaSessao` continuam iguais à contagem do helper (`src/domain/sessao.ts`), que `criarMescladorDeEstado` continua igual a `src/domain/mescladorEstado.ts`, que os multiplicadores de `hunt-analyser.mjs` batem com `src/analysis/multiplicadores.ts` e que os campos das tabelas abaixo ainda existem.
3. Atualizar `VERSAO_JOGO_VALIDADA`, o título deste documento e o CHANGELOG.

Na v1.492.0 a contagem é idêntica à do jogo, incluindo o `bossEntrou` (tokens gastos para entrar num boss, com preço 0, como no jogo).

## Mensagens

O jogo usa um único WebSocket em `wss://pokeidle.io` com mensagens JSON identificadas pelo campo `t`. Ao abrir, o cliente envia `{ t: 'hello', nick, token, delta: 1, dispositivo }`. O helper nunca lê nem reproduz essa mensagem.

## Mensagens recebidas usadas pelo helper

| `t`       | Campos lidos                                                                           | Observação                                                                                             |
| --------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `welcome` | `estado`, `hunts[]`, `tabelaTipos`, `catalogoBolas[]`, `itensNossos[]`, `tiposBoost[]` | Uma por conexão. `hunts[]`: `slug`, `nome`, `nivel`, `area`, `regiao`, `especies[{ pokeId, pontos }]`. |
| `estado`  | `estado` (parcial)                                                                     | Ver "Estado do jogador" abaixo.                                                                        |
| `batalha` | `ev[]`                                                                                 | Eventos abaixo.                                                                                        |

## Estado do jogador

`estado` **é o próprio jogador** (o cliente faz `estado.eu = mesclarEstado(m.estado)`). Não existe um envelope `eu`. Campos lidos: `nick`, `level`, `xp`, `xpNivel`, `xpProximo`, `gold`, `activeId`, `huntSlug`, `noCentro`, `pokemons[]` (`id`, `speciesId`, `level`, `xp`, `xpNivel`, `xpProximo`, `nome`, `tipos`), `items` (itemId → quantidade), `balls` (ballId → quantidade), `loja` (`vipAte`, `boosts`), `guildBonusPct`, `guild.boostAte` e `evento` (`farmPct`, `terminaEm`).

Os parciais seguem `shared/estado-delta.mjs`, replicado em `src/domain/mescladorEstado.ts`:

| Campo do parcial   | Efeito                                                         |
| ------------------ | -------------------------------------------------------------- |
| `cheio: true`      | Descarta o estado anterior e usa o parcial como estado inteiro |
| demais campos      | `Object.assign` raso: objetos aninhados são substituídos       |
| `pokemons`         | Substitui a lista inteira (indexada por `id`)                  |
| `pkMud[]`          | Insere ou troca pokémons pelo `id`                             |
| `pkFora[]`         | Remove pokémons pelo `id`                                      |
| `dexMud`/`dexFora` | Acrescenta ou remove chaves da `pokedex`                       |

## Eventos de batalha (`ev[].k`)

| `k`                         | Campos                                                                          | Efeito na sessão                                                                               |
| --------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `hunt`                      | `slug`, `nome`                                                                  | Abre a sessão da hunt (fecha a anterior).                                                      |
| `spawn`                     | `speciesId`, `level`, `tipos`                                                   | Conta a espécie.                                                                               |
| `morte`                     | `quem`, `xp`, `xpTreinador`, `xpPokemon`, `ouro` (inclui `ouroLoot`), `drops[]` | Só `quem: 'selvagem'` conta abate, XP e gold.                                                  |
| `bossMorto`                 | `xp*`, `valor`, `drops[]`                                                       | XP e gold.                                                                                     |
| `bossEntrou`                | `entrada { itemId, qtd }` (padrão: 1 × Bronze Boss Token, 70000)                | Gasto de token.                                                                                |
| `bola`                      | `ballId`, `shiny`                                                               | Gasto de bola; `shiny` conta shiny visto.                                                      |
| `capturado`                 | `pokemon.shiny`                                                                 | Captura.                                                                                       |
| `cura`                      | `itemId`                                                                        | Gasto de poção.                                                                                |
| `revive`                    | `itemId`                                                                        | Gasto de revive.                                                                               |
| `ataque`                    | `golpe`, `tipo`, `dano`, `ef`, `stab`, `por`, `slot`                            | Se `por !== 'jogador'`, golpe recebido; `ef >= 2` é super efetivo. Não conta como tempo ativo. |
| `morte` (`quem: 'jogador'`) | —                                                                               | Desmaio do seu pokémon.                                                                        |
| `xpPerdido`                 | `qtd`                                                                           | XP perdido (soma só valores positivos).                                                        |
| `fugiu`                     | `nome`, `level`                                                                 | Pokémon escapou da bola (fuga).                                                                |

`drops[]` só traz itens especiais (tokens, fragmentos, tickets); o loot comum já vem em gold no `ouroLoot`.

## Assets estáticos

| Caminho                                                 | Uso                                                   |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `/assets/creatures.json` (+ `-novos`, `-outland-novos`) | Tipos, `huntLevel` e tipos dos golpes de cada espécie |
| `/assets/items.json`                                    | Nome e `npcPrice` dos itens (valor dos drops)         |

## Fórmulas (de `shared/sell-value.mjs`, `shared/recompensa-hunt.mjs` e `hunt-analyser.mjs`)

- XP por abate: `floor(0,6 · n²) + 8` até o nível 150 (n = `hunt.nivel`).
- Gold por abate: `36 · n^k` (k calibrado para 6000 no nível 5000), mais o loot que leva a renda a +15%; o bônus de loot multiplica só a parte do loot.
- Abates/h teórico: ondas de até 16 mobs, 3,5 s por abate e 2,6 s entre ondas.
- Multiplicadores de XP: boost da loja (`tiposBoost[chave].mult` enquanto `loja.boosts[chave] > agora`) × VIP 1,5 (`loja.vipAte > agora`) × (1 + `guildBonusPct`/100) × boost da guild 1,1 (`guild.boostAte > agora`). Chaves: `xp` (treinador) e `pokexp` (pokémon).
- Bônus de loot (%): (boost `loot` − 1) × 100 + `guildBonusPct` + `evento.farmPct`.

Verificação no nível 1: 8 XP e 41 de gold (36 + 5 de loot), iguais ao observado no jogo.

Eventos só de raid (`queda`, `onda`, `gmax`, `marco`, `fora`) não são usados.

## Combate (de `shared/ginasios.mjs`, `shared/cooldown-golpes.mjs`, `shared/nota-pokemon.mjs` e da wiki `pokepedia.mjs`)

- **Stats:** `round((base + refino + 2·IV) · nível/100 · q^expo · mult)`, com expo 0,95 para HP/Speed e 0,8 nos demais. `mult` = potência (P1..P5: +0/5/10/25/100%) × shiny 3. Speed não tem refino. O servidor também manda `stats` e `maxHp` prontos em cada pokémon.
- **HP de combate:** `max(24, round(hp·12))`; o selvagem ainda é multiplicado por `welcome.multHpSelvagem` (5).
- **Dano:** `((2L/5+2)·poder·Atk/Def/50 + 2) × STAB 1,5 × efetividade × U(0,85..1)`. Físico usa Atk/Def; especial, SpAtk/SpDef.
- **Efetividade na hunt:** produto dos dois tipos, ampliado por `welcome.ampliacaoHunt` (1,5): v>1 → 1+(v−1)·1,5; v<1 → v/1,5 (2 → 2,5; 4 → 5,5; 0,5 → 1/3).
- **Golpes:** os do `creatures*.json` são substituídos por `creatures-audit-overrides.json` e depois pelas tabelas de `shared/golpes-planilhas.mjs` (na ordem de `TABELAS`); formas finais fora de `TABELAS_FECHADAS` ganham dois golpes de poder 600 (recarga 60 s, categoria do maior entre Atk e SpAtk).
- **Recarga:** poder ≤ 100 → 10 s + (p−15)·20/85; acima → 30 s + (p−100)·30/500 (600 → 60 s); Mega fixo em 30 s. Desconto por speed: `min(7, S≤120 ? S/20 : 6+(S−120)/40)% × IV_speed/32`.
- **Cadência:** intervalo global `max(400, 900 − 10·IV_speed)` ms; Investida (poder 30, física, STAB sempre, tipo 1) a cada `max(400, 2000 − 10·IV_speed)` ms. O golpe pronto de maior dano é usado primeiro. Z-Move do TM elemental: poder 2800, recarga 60 s. TM de área: golpes em 11×11.
- **Selvagem:** nível da hunt; IV e qualidade são do servidor (o helper usa a média); dano ×`multDanoSelvagem` (1,8); intervalo mínimo de 1,4 s.

## Captura e economia

- **Chance por arremesso** (`app.js chanceDeCaptura`): `catchRate ≥ 255 → 1`; senão `clamp(piso, teto, base · catchRate/fator · 1,4)` com `welcome.captura = {base 0,0075, piso 0,003, teto 0,1, raridadeDiv 17}` e corpo caído (×1,4).
- **Fator** (`shared/captura-degrau.mjs`): espécie que aparece em hunt usa o degrau do teto de captura (20 → 2,8669; 40 → 3,5745; 100 → 4,4681); as outras, `1 + (log10(max(100, priceNpc)) − 1)³ / raridadeDiv`. O teto vem da posição na cadeia evolutiva (`shared/teto-captura.mjs`: 1 elo [100], 2 [40,100], 3 [20,40,100], 4 [20,40,70,100]).
- **Shiny:** `welcome.chanceShiny` por arremesso (Shiny Lure dobra).
- **Venda automática:** o evento `capturado` traz `vendidoAuto` (gold) quando o pokémon é vendido no depot.
- **Loot:** desde 15/10/2026 os selvagens só largam pedras de evolução (`shared/loot-pedras.mjs`): uma por tipo distinto (Ghost e Dark dão a mesma), com 0,2/0,35/0,5% conforme o estágio. Os drops especiais não são vendidos ao NPC.
- **Fragmento de ovo shiny** (`shared/ovo-shiny.mjs`): fora do Outland, a partir do nível 5000, `1/150000 · (1 + 0,04·(degrau−1))`, 32 degraus até 160 300; 10 fragmentos fazem um ovo.
- **Curva de XP** (`shared/boost-atrasados.mjs`): `xpTotal(L) = round(50/3 · (L³ − 6L² + 17L − 12))`. Pokémon só luta com nível ≤ treinador + 5 (`shared/pokemon-nivel-treinador.mjs`). Refino: próximo passo `500·(3n²+3n+1)`, total `500·n³`.
