# Protocolo do jogo (levantado na v1.488.1, conferido na v1.492.0, 26/11/2026)

## Versão do jogo

A página carrega `app.js?v=<versão>`. O helper lê esse parâmetro ao montar o painel e compara com `VERSAO_JOGO_VALIDADA` (`src/shared/protocolo.ts`). Se forem diferentes, registra um `WARN` e mostra um aviso no painel. A versão aparece em **Opções → Versão do jogo**.

Para validar uma versão nova:

1. Baixar `app.js`, `sessao-hunt.mjs`, `hunt-analyser.mjs` e `shared/estado-delta.mjs` da versão nova.
2. Confirmar que `contarNaSessao` e `custosDaSessao` continuam iguais à contagem do helper (`src/domain/sessao.ts`), que `criarMescladorDeEstado` continua igual a `src/domain/mescladorEstado.ts`, que os multiplicadores de `hunt-analyser.mjs` batem com `src/analysis/multiplicadores.ts` e que os campos das tabelas abaixo ainda existem.
3. Atualizar `VERSAO_JOGO_VALIDADA`, o título deste documento e o CHANGELOG.

Na v1.492.0 a contagem é idêntica à do jogo, incluindo o `bossEntrou` (tokens gastos para entrar num boss, com preço 0, como no jogo).

## Mensagens

O jogo usa um único WebSocket em `wss://pokeidle.io` com mensagens JSON identificadas pelo campo `t`. Ao abrir, o cliente envia `{ t: 'hello', nick, token, delta: 1, dispositivo }`. O helper nunca lê nem reproduz essa mensagem (o `hello` não está na lista branca de comandos). A lista completa do que o cliente envia está em [mensagens-cliente.md](mensagens-cliente.md).

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
- **Preço de venda** (`shared/sell-value.mjs`, `precoVendaPokemon`): `floor(base · (1 + min(nível, 100)/50) · qualidade · (shiny ? 10 : 1))`. A base é `PRECO_NPC_FIXO` quando existe; senão o valor econômico da espécie (sellValue/priceNpc até 500 000, ou `12000 · (huntLevel/150)^0,6`), limitado a `ouroDoNivel(2500)`. Conferido no Market: Scyther nv 100 Q 1,002 → 180 360; Sunkern nv 40 Q 1,077 → 27 646 (base 14 262 = `ouroDoNivel(200)`).
- **Loot:** desde 15/10/2026 os selvagens só largam pedras de evolução (`shared/loot-pedras.mjs`): uma por tipo distinto (Ghost e Dark dão a mesma), com 0,2/0,35/0,5% conforme o estágio. Os drops especiais não são vendidos ao NPC.
- **Fragmento de ovo shiny** (`shared/ovo-shiny.mjs`): fora do Outland, a partir do nível 5000, `1/150000 · (1 + 0,04·(degrau−1))`, 32 degraus até 160 300; 10 fragmentos fazem um ovo.
- **Curva de XP** (`shared/boost-atrasados.mjs`): `xpTotal(L) = round(50/3 · (L³ − 6L² + 17L − 12))`. Pokémon só luta com nível ≤ treinador + 5 (`shared/pokemon-nivel-treinador.mjs`). Refino: próximo passo `500·(3n²+3n+1)`, total `500·n³`.

## Fases da hunt (medidas pelo helper)

O helper não recebe posições (`campo` é descartado). As fases saem dos horários dos eventos de `batalha`:

| Fase           | Início                                  | Fim                                   |
| -------------- | --------------------------------------- | ------------------------------------- |
| Lutando        | seu `ataque` (`por: 'jogador'`)         | `morte` do selvagem                   |
| Andando        | `morte` com selvagens vivos, ou `spawn` | seu próximo `ataque`                  |
| Esperando onda | `morte` que zera os vivos               | próximo `spawn` (conta uma onda nova) |

Intervalos acima da pausa máxima (60 s) são descartados. O dano de cada golpe seu vem em `ataque.dano`.

## Dia sazonal (`shared/dia-sazonal.mjs`)

`estado.diaSazonal.tipo` traz o tipo do dia. Dano = base × (atacante do tipo ? 2 : 1) ÷ (defensor do tipo ? 4 : 1). Com o Shield do Novato (`level < loja.alvoAtrasados`), os selvagens do tipo não recebem o bônus contra você.

Cada sessão grava `sazonal: { tipo, escudo }` do momento em que começou, e a calibração simula cada sessão com o seu próprio dia. `diaSazonal.fim` marca o fim do dia corrente; sessões sem registro só são usadas se começaram nas 24 h anteriores a ele. Quando o dia muda com a sessão aberta, a sessão é encerrada e outra começa na mesma hunt, para que nenhuma sessão misture dois dias.

## Coleta detalhada (sessão v5)

Além dos totais, cada sessão guarda três listas (até 50 000 registros cada):

| Campo           | Um registro por                              | Campos                                                                                                                                                                                |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trechos`       | nível (ou pokémon) do ativo dentro da sessão | `inicio`, `fim`, `pokemonId`, `level`, `tipoSazonal`, `msAtivo`, `abates`, `golpesDados`, `danoCausado`, `xpPokemon`, `gold`, `desmaios`, `fases`                                     |
| `abatesDetalhe` | selvagem derrotado                           | `t` horário, `lv` nível do ativo, `g` golpes, `d` dano, `l` ms do 1º golpe à morte, `xp`, `o` ouro                                                                                    |
| `consumo`       | poção, revive, bola, captura ou desmaio      | `t` horário, `k` tipo (`pocao`, `revive`, `bola`, `captura`, `desmaio`), `id` do item, `shiny`; capturas também `sp` espécie, `lv` nível, `q` qualidade, `v` gold da venda automática |

Golpes e dano de um abate são os seus `ataque` desde o abate anterior; com vários selvagens vivos ao mesmo tempo, a divisão entre eles é aproximada. O trecho em andamento entra nos checkpoints (a cada 30 s no navegador) e, com o backup automático ligado, a sessão aberta vai para o arquivo a cada 5 min.

## Progressão por nível (ajuste dos trechos)

A aba Progresso junta os trechos do ativo na hunt atual (mesmo `pokemonId`, `huntSlug` e `tipoSazonal`), soma os trechos de cada nível e descarta níveis com menos de 20 abates. Com pelo menos 5 níveis, ajusta por mínimos quadrados ponderados pelos abates:

- `ln(golpes por abate − 1) = a + b · nível`: o excesso sobre um golpe cai de forma exponencial com o nível;
- `segundos por abate = a + b · golpes por abate`: o ciclo inclui luta, deslocamento e espera de onda.

O teto da hunt é o ciclo com 1 golpe por abate. XP e ouro por abate vêm do trecho mais recente, para refletir bônus ativos. O tempo até cada nível soma, nível a nível, o XP da curva do jogo dividido pelo XP/h projetado naquele nível. A projeção para no nível do treinador + 5.

Usamos médias por trecho, e não a distribuição de golpes de cada abate: com vários selvagens vivos, os golpes de um abate isolado podem pertencer a outro alvo.

## Autocatch: vale capturar e vender?

Para a hunt atual, o helper junta as sessões salvas e a ao vivo:

- **Bolas por captura:** total de bolas ÷ capturas, com pelo menos 3 capturas; antes disso, `1 / chance` da fórmula de captura para a bola mais usada, ponderada pelas espécies da hunt.
- **Bolas por abate:** bolas ÷ abates das sessões em que houve bola.
- **Venda por captura:** média de `v` (Auto Venda do Depot) nas capturas registradas. Sem Auto Venda não há valor medido, e o veredito não aparece.
- **Atraso por abate:** um trecho é "com bola" quando há arremesso entre o início e o fim dele. O ciclo dos trechos sem bola do ativo é ajustado como na progressão por nível (`segundos = a + b · golpes`); o atraso é a média, por abate, do tempo real dos trechos com bola menos o ciclo previsto para os golpes medidos neles.
- **Resultado por hora**, com `abates/h com = 3600 / (3600/abates/h sem + atraso)`: vendas = bolas/h ÷ bolas por captura × venda; gasto = bolas/h × custo médio da bola; perda = (abates/h sem − com) × ouro por abate; gold líquido = vendas − gasto − perda; variação de XP/h = (abates/h com − sem) × XP por abate.

## Calibração da captura

- **Amostras:** por hunt e bola, arremessos (`bolas`) e capturas. Numa sessão com uma bola só, todas as capturas são dela; com várias, cada captura vai para a última bola arremessada antes dela na linha do tempo `consumo`. Sessões antigas com várias bolas e sem linha do tempo ficam de fora.
- **Fórmula:** a chance do jogo para a bola, ponderada pelas espécies da hunt (igual à do cliente, `app.js chanceDeCaptura`, que não aplica bônus).
- **Fator global:** `(capturas + 3) / (esperadas + 3)`, com esperadas = Σ arremessos × fórmula em todas as hunts com amostra.
- **Chance usada:** média de uma Beta com prior de 3 capturas centrado na fórmula × fator: `(capturas + 3) / (arremessos + 3 / (fórmula · fator))`. Com pouca amostra fica perto da fórmula; com muita, vira a medida. A faixa de 95% da medida é a de Wilson.
- 27/11/2026: Sunflora com Ultra Ball mediu 10 capturas em 487 arremessos (2,05%; faixa 1,1–3,7%) contra 0,94% da fórmula.

## Metas de nível pela curva

Com a curva da hunt atual (ver "Progressão por nível"), o tempo até um nível-alvo do treinador ou do ativo é simulado por eventos: a cada passo o ativo ganha o XP/h da curva no nível dele, o treinador ganha esse XP × (XP/h do treinador ÷ XP/h do ativo na sessão), e o próximo evento é quem sobe de nível primeiro. O ativo não passa de treinador + 5; travado, só o treinador avança. Sem curva, vale o ritmo constante da sessão ou da simulação.
