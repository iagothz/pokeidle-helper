# Changelog

Todas as mudanças relevantes deste projeto ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [0.9.0] - 2026-11-26

### Adicionado

- Coleta detalhada na sessão (formato v5): `trechos` por nível do pokémon (abates, golpes, dano, XP, gold, fases e tempo de cada nível), `abatesDetalhe` com golpes, dano, duração da luta, XP e ouro de cada abate, e `consumo` com horário de cada poção, revive, bola, captura e desmaio.
- Log "Nível do pokémon mudou" com o resumo do nível que terminou, e `porNivel` no "Resumo da sessão".
- Backup automático em arquivo a cada 5 min enquanto houver sessão aberta, para não perder uma madrugada se o navegador fechar.

### Alterado

- Quando o dia sazonal muda com a sessão aberta, a sessão é encerrada e outra começa na mesma hunt, para que nenhuma sessão misture dois dias na calibração.

## [0.8.3] - 2026-11-26

### Alterado

- Sessão ao vivo: o tempo desde o último evento de combate (até a pausa máxima) entra no tempo ativo e na fase em andamento a cada segundo, então XP/h, gold/h e "Onde vai o tempo" caem em tempo real enquanto o pokémon anda ou espera onda.

### Corrigido

- A sessão guardava só o nível do pokémon no início; agora guarda também o nível final (`levelFinal`), e a calibração e o "Resumo da sessão" simulam no nível médio.

## [0.8.2] - 2026-11-26

### Corrigido

- Calibração: cada sessão passa a ser simulada com o dia sazonal em que foi caçada (tipo do dia e Shield do Novato gravados na sessão). Antes, todas eram simuladas com o dia atual, e o fator de dano ficava ~2× errado quando o tipo do dia mudava.
- Sessões antigas sem esse registro só entram na calibração se forem do dia atual; ao saber o dia, o helper grava o tipo de hoje nas sessões salvas de hoje para não perdê-las quando o dia virar.

## [0.8.1] - 2026-11-26

### Corrigido

- Calibração: o deslocamento por abate era diluído pelos abates de sessões antigas, sem fases medidas (2,65 s viravam ~0,86 s). Agora só entram as sessões que mediram fases. Conferido com sessões reais: Sunkern 737/h calibrado contra 737–764/h real.

## [0.8.0] - 2026-11-26

### Adicionado

- Backup automático em arquivo: ao fechar cada sessão, todas as sessões são gravadas em `Downloadspokeidle-helperpokeidle-helper-backup.json` (sobrescreve; acima de ~1,4 MB divide em `-parte-N.json`). Interruptor e botão "Fazer backup agora" em Opções.
- Importar backup (um ou vários arquivos, inclusive a exportação manual): valida cada sessão, descarta as inválidas e mescla sem duplicar, mantendo a versão mais completa.
- Service worker (`background.js`) que grava os arquivos com `chrome.downloads`; aceita só mensagens da própria extensão e usa nomes de arquivo fixos.

### Alterado

- Histórico mostra todas as sessões em páginas de 50 ("Mostrar mais").
- Nova permissão: `downloads`.

## [0.7.0] - 2026-11-26

### Adicionado

- Medidor de fases pelos horários dos eventos de batalha: **lutando** (seu ataque até a morte do mob), **andando** (morte ou spawn até o próximo ataque seu) e **esperando onda** (campo vazio até o próximo spawn). Aparece na Sessão como "Onde vai o tempo".
- Golpes dados e dano causado pelo seu pokémon na sessão (golpes reais por abate).
- Calibração por componente: o dano do simulador é ajustado pela razão golpes simulados ÷ reais, e os 2,6 s fixos de deslocamento e de onda são trocados pelos medidos; o que sobra vira o ajuste final (agora entre ×0,05 e ×20).
- Dia sazonal no simulador (`diaSazonal.tipo`): pokémon do tipo do dia bate ×2 e apanha ÷4; selvagens do tipo idem, exceto com o Shield do Novato (`level < loja.alvoAtrasados`).
- Logs: "Dados de combate do ativo" uma vez por pokémon e "Resumo da sessão" ao fechar cada sessão, com taxas, fases, golpes, previsão do simulador, calibração, dia sazonal e bônus.

### Corrigido

- A fase em andamento (por exemplo a espera da última onda) passa a contar até o fim da sessão.

## [0.6.0] - 2026-11-26

### Alterado

- Visual novo com **escala contínua de cor**: cada número tem uma nota de 0 a 1 que vai do vermelho (0) ao branco (0,5) e ao verde (1). Os limites aprovados (ex.: autonomia de 15 min e 1 h, golpes por abate 3 e 15) são os pontos de 1/3 e 2/3 da rampa. Regras em `src/ui/tons.ts` (testadas).
- Cores dinâmicas na hunt atual: XP/h, lucro, gold e abates comparados com as outras hunts liberadas pelo nível do treinador (a nota é o percentil entre elas) e ajustados pela sua média histórica na mesma hunt (até ±1/3 da escala, proporcional à diferença; ±10% já dá o deslocamento cheio). O motivo aparece embaixo do número.
- Placar no topo da Sessão (Lucro/h, XP/h, Autonomia), barras proporcionais no ranking e no Time, bolinha de estado no botão PH.
- Números e tempos curtos ("11,5 mil", "21s", "16min", "6d 03h"); o valor exato fica no tooltip.

## [0.5.0] - 2026-11-26

### Adicionado

- Simulador de combate com as fórmulas do jogo: stats (IV, qualidade, potência, shiny, refino ou stats prontos do servidor), dano, efetividade ampliada na hunt, HP dos selvagens, recargas por poder e speed, intervalo global, Investida, Z-Move e TM de área. Estima golpes, segundos por abate, abates/h, XP/h e gold/h do seu pokémon em cada hunt.
- Calibração da simulação pelas sessões reais (cada sessão passa a registrar o pokémon ativo).
- Ranking: hunts não visitadas com selo `simulado`, segundos e golpes por abate.
- Aba **Time**: o time na hunt atual e as melhores hunts simuladas por pokémon. A sugestão do melhor pokémon vem da simulação.
- Aba **Progresso**: meta de nível com tempo estimado (curva de XP do jogo), evolução do ativo, pokémons travados pelo nível do treinador, custo de refino.
- Aba **Economia**: chance de captura por bola e espécie, bolas e gold por captura, melhor bola, shiny por arremessos, pedras/h e ovo shiny.
- Lucro real/h somando as capturas vendidas automaticamente (`vendidoAuto`), que o painel do jogo não soma.
- Golpes reais das espécies: `creatures-audit-overrides.json` e `golpes-planilhas.mjs` (lido como texto), mais os golpes 600 das formas finais.
- Diagnóstico em Opções dos dados de combate do ativo.

### Alterado

- Drops especiais mostram a frequência ("1 a cada N abates") em vez do valor NPC.
- Sessões em `schemaVersion` 3 com `vendasAuto` e `pokemon`.

### Corrigido

- O valor NPC dos drops era enganoso: desde 15/10/2026 o loot não vira gold e o NPC não compra tokens e fragmentos.
- Parser de golpes: uma tabela vazia engolia a seguinte (achado em teste).

## [0.4.0] - 2026-11-26

### Adicionado

- Aba **Histórico**: últimas 50 sessões salvas (hunt, data, duração, XP/h, lucro/h, desmaios), com filtro por hunt e resumo do filtro.
- Previsão do **próximo nível** do treinador e do pokémon ativo (progresso, XP restante e tempo no ritmo da sessão), com os campos `xp`, `xpNivel` e `xpProximo` do estado.
- Sessão conta desmaios do seu pokémon (`morte` com `quem: 'jogador'`), XP perdido (`xpPerdido`) e fugas (`fugiu`), com a taxa de captura.
- Painel arrastável pelo cabeçalho e minimizável; posição, estado minimizado e última aba ficam salvos em `chrome.storage.local` (`pokeidleHelper.ui`), validados ao carregar.

### Alterado

- Sessões salvas passam para `schemaVersion` 3; as anteriores são completadas ao carregar.

## [0.3.0] - 2026-11-26

### Adicionado

- Alerta com o dano real recebido: fração de golpes super efetivos (`ef >= 2`) e dano médio dos selvagens, a partir de 20 golpes; antes disso continua o alerta teórico por tipos.
- Valor NPC dos drops especiais por hora e lista de drops da sessão, fora do lucro líquido. Drops sem `itemId` são avaliados pelo nome no catálogo.
- Autonomia: tempo até acabar cada poção, revive e bola no ritmo da sessão, com o item que acaba primeiro.
- Estimativas do ranking com VIP, boosts da loja, bônus e boost da guild e evento de farm ativos, como no `hunt-analyser.mjs` do jogo, com a lista de bônus aplicados.
- Registro do `bossEntrou` (tokens gastos para entrar num boss), como o jogo.
- Inventário (`items`, `balls`) lido do estado do jogador.

### Alterado

- A sugestão do melhor pokémon do time agora pesa o dano recebido e o nível do pokémon em relação ao da hunt.
- Sessões salvas passam para `schemaVersion` 2; as da versão 1 são completadas ao carregar.

### Corrigido

- O estado do jogador era lido de um envelope `estado.eu` que o jogo não manda: o `estado` já é o jogador, com parciais `cheio`/`pkMud`/`pkFora`. Com isso o helper não achava o pokémon ativo, o filtro "até o nível do ativo" não filtrava nada e os tipos apareciam como `?`. O estado agora é reconstruído com a mesma lógica do `shared/estado-delta.mjs` do jogo.
- O filtro por nível avisa quando o nível do ativo ainda não é conhecido e mostra o nível usado.

## [0.2.0] - 2026-11-26

### Adicionado

- Aviso no painel e `WARN` no log quando a versão do jogo (lida de `app.js?v=`) difere da versão em que o protocolo foi validado.
- Linha **Versão do jogo** no diagnóstico da aba Opções.
- Roteiro para validar uma versão nova do jogo em `docs/protocolo.md`.

### Alterado

- Protocolo conferido na versão 1.492.0 do jogo: a contagem da sessão continua idêntica (`VERSAO_JOGO_VALIDADA = 1.492.0`).
- README: instalação com Corepack ou `npx pnpm`, aviso de que o Brave precisa da pasta compilada e uso da `dist/` no desenvolvimento.

## [0.1.0] - 2026-11-26

### Adicionado

- Captura passiva do WebSocket do jogo em `world: MAIN`, com fila assíncrona, limite de 2000 mensagens e remoção de dados sensíveis antes de publicar.
- Ponte `postMessage` com validação de origem, `source` e envelope versionado.
- Reconstrução do estado do jogo a partir do `welcome` e dos deltas de `estado`.
- Rastreador de sessões por hunt com a mesma contagem do painel SESSÃO do jogo, tempo ativo com pausa máxima, checkpoint a cada 30 s e no `pagehide`.
- Persistência em IndexedDB (sessões com upsert, logs com rotação por segmento, migrações versionadas).
- Análise: fórmulas de XP, gold e abates/h do jogo, tabela de tipos do servidor, taxas por hora, custo de consumíveis, lucro líquido e ranking de hunts real, com pouca amostra, estimado ou teto teórico.
- Dicas de tipo: classificação do pokémon ativo, alerta de dano super efetivo recebido e sugestão do melhor pokémon do time.
- Painel Preact em Shadow DOM com abas Sessão, Hunts e Opções; exportação de dados e logs em JSON.
- Logger estruturado com níveis DEBUG, INFO, WARN e ERROR, saída no console e no IndexedDB.
- Testes unitários, de integração por replay e ponta a ponta com a extensão carregada num Chromium real; CI no GitHub Actions.

### Alterado em relação ao plano

- Build com esbuild em vez de Vite + CRXJS, porque o CRXJS não lida bem com content scripts em `world: MAIN`.
- Estimativas de hunts não visitadas usam as fórmulas oficiais do jogo calibradas pelo seu ritmo, em vez de um modelo genérico.
- O lucro líquido usa só o gold do evento `morte`, que já inclui o `ouroLoot`. Drops especiais aparecem à parte.
- A tabela de tipos vem do próprio servidor (`welcome.tabelaTipos`), então não precisa de calibração pelo campo `ef`.
