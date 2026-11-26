# Changelog

Todas as mudanças relevantes deste projeto ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

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
