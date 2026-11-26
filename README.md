# PokeIdle Helper

Extensão para Brave (e outros navegadores Chromium) que acompanha suas hunts no [PokeIdle](https://pokeidle.io/app) e mostra, num painel sobre o jogo:

- **Sessão atual:** XP/h (pokémon e treinador), gold/h, abates/min, gasto com poções, revives e bolas, e lucro líquido por hora.
- **Ranking de hunts:** por lucro líquido/h ou XP/h. Usa seus dados reais quando você já caçou na hunt e uma estimativa calibrada pelo seu ritmo quando ainda não caçou.
- **Dicas de tipo:** vantagem ou desvantagem do pokémon ativo contra a hunt, alerta quando os selvagens acertam super efetivo e qual pokémon do seu time rende mais ali.

A extensão é **somente leitura**: ela observa as mensagens que o jogo já recebe e não envia nada ao servidor.

## Conformidade com os Termos do PokeIdle

A seção 5 dos [Termos](https://pokeidle.io/terms) permite automações, desde que não explorem falhas, não burlem limites e não sobrecarreguem o servidor. O helper fica bem longe disso:

- não envia mensagens pelo WebSocket nem faz requisições aos endpoints do jogo (há teste automatizado para isso);
- só baixa os catálogos estáticos que o próprio jogo já usa (`/assets/creatures*.json` e `/assets/items.json`);
- não automatiza nenhuma ação.

Não use VPN, VPS nem proxy para jogar; os Termos proíbem.

## Instalação no Brave

Pré-requisitos: Node.js 22 e pnpm 10. Se o `pnpm` não estiver instalado, ative-o pelo Corepack, que já vem com o Node (pode exigir terminal como administrador no Windows):

```bash
corepack enable
```

Sem permissão para isso, use `npx pnpm@10.28.0` no lugar de `pnpm` nos comandos abaixo.

```bash
pnpm install
pnpm package
```

> O Brave precisa da pasta **compilada**. Carregar a raiz do projeto ou a pasta `src/` não funciona: o manifesto aponta para `capture.js` e `content.js`, que só existem depois do build.

1. Descompacte `release/pokeidle-helper-vX.Y.Z.zip` numa pasta versionada, por exemplo `C:\pokeidle-helper\v0.1.0`.
2. Abra `brave://extensions` e ligue o **Modo de desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta.
4. Abra (ou recarregue) `https://pokeidle.io/app` e faça login. O botão **PH** aparece no canto inferior direito.

O helper precisa estar ativo **antes** do login, porque os dados de hunts chegam uma única vez ao conectar. Se o jogo já estava aberto, recarregue a página.

**Durante o desenvolvimento**, carregue direto a pasta `dist/` (gerada por `pnpm build` ou `pnpm dev`). Depois de cada build, clique no botão de recarregar do card da extensão em `brave://extensions` e recarregue o jogo.

## Uso

- **PH** abre e fecha o painel. O botão fica laranja quando há um aviso ou desvantagem de tipo.
- **Sessão:** métricas da hunt atual. Só o tempo ativo conta: pausas maiores que 60 s entre eventos de batalha são descontadas.
- **Hunts:** o selo de cada linha diz de onde vem o número:
  - `real`: média das suas sessões, com pelo menos 15 min acumulados;
  - `pouca amostra`: real, mas com menos de 15 min;
  - `estimado`: fórmulas do jogo ajustadas pelo seu ritmo médio nas hunts reais;
  - `teto teórico`: fórmulas do jogo sem ajuste (antes de você ter qualquer hunt medida).
- **Opções:** exportar seus dados e os logs em JSON, mudar o nível de log e limpar o histórico.

Sessões com menos de 3 min ativos são descartadas. O custo dos consumíveis usa o preço de NPC (`npcPrice`) e o `priceGold` das bolas, o mesmo critério do painel SESSÃO do jogo.

## Configuração

Os valores padrão ficam em [`config.default.json`](config.default.json). Pelo painel, o nível de log pode ser trocado e fica salvo em `chrome.storage.local`. Os campos `logLevel`, `sessaoMinimaMs`, `pausaMaximaMs` e `amostraMinimaMs` aceitam override na chave `pokeidleHelper.config`. A origem do jogo e os caminhos dos assets não aceitam override, por segurança.

| Campo                                            | Padrão   | Significado                                       |
| ------------------------------------------------ | -------- | ------------------------------------------------- |
| `logLevel`                                       | `INFO`   | `DEBUG`, `INFO`, `WARN` ou `ERROR`                |
| `sessaoMinimaMs`                                 | 180000   | Tempo ativo mínimo para salvar uma sessão         |
| `pausaMaximaMs`                                  | 60000    | Intervalo máximo entre eventos contado como ativo |
| `amostraMinimaMs`                                | 900000   | Tempo acumulado para uma hunt valer como `real`   |
| `logs.maxBytesPorSegmento` / `logs.maxSegmentos` | 5 MB / 3 | Rotação dos logs no IndexedDB                     |

Nenhum segredo, token ou credencial é usado ou guardado.

## Desenvolvimento

| Comando                            | O que faz                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                         | Build em modo watch (recarregue a extensão em `brave://extensions`)                                           |
| `pnpm build`                       | Build de produção em `dist/`                                                                                  |
| `pnpm package`                     | Build + `.zip` em `release/`                                                                                  |
| `pnpm lint` / `pnpm format`        | ESLint e Prettier                                                                                             |
| `pnpm typecheck`                   | TypeScript em modo strict                                                                                     |
| `pnpm test` / `pnpm test:coverage` | Testes unitários e de integração (Vitest)                                                                     |
| `pnpm test:e2e`                    | Carrega a extensão num Chromium real contra um jogo simulado (defina `CHROME_PATH` para usar outro navegador) |
| `pnpm check`                       | Lint, formatação, tipos, testes com cobertura e build                                                         |

O CI (GitHub Actions) roda tudo isso a cada push e PR e anexa o `.zip` como artefato.

## Estrutura

```
src/
  capture/       hook do WebSocket (world MAIN), somente leitura
  bridge/        recebe as mensagens da captura e valida o envelope
  domain/        schemas, estado do jogo, sessões, catálogos
  persistence/   IndexedDB: sessões e logs com rotação
  analysis/      fórmulas do jogo, tipos, taxas, ranking
  content/       orquestração (Aplicacao) e ponto de entrada
  ui/            painel Preact em Shadow DOM
tests/           unit, integration (replay), e2e (Chromium), fixtures
docs/            arquitetura, protocolo e roteiro de teste manual
```

Mais detalhes em [`docs/arquitetura.md`](docs/arquitetura.md) e [`docs/protocolo.md`](docs/protocolo.md).

## Atualizar e voltar versão (rollback)

- **Atualizar:** gere o novo `.zip`, descompacte numa pasta nova (`v0.1.1`), remova a versão antiga em `brave://extensions` e carregue a nova. Os dados ficam no IndexedDB do site e são mantidos.
- **Rollback:** remova a versão atual e carregue a pasta da versão anterior, que você manteve guardada. As migrações do banco são aditivas e versões anteriores ignoram campos novos.
- **Emergência:** se algo atrapalhar o jogo, desligue a extensão no toggle de `brave://extensions` e recarregue a página.

## Privacidade

Tudo fica no seu navegador: as sessões e os logs no IndexedDB de `pokeidle.io` e a configuração no `chrome.storage.local`. Antes de qualquer processamento, a captura remove campos como `token`, `email`, `cpf`, `carteira` e `ip`. Nada é enviado a lugar nenhum.

## Limitações conhecidas

- O formato das mensagens foi conferido na versão 1.492.0 do jogo. Quando o jogo é atualizado, o painel avisa que a versão mudou e mostra a nova em **Opções → Versão do jogo**. Mudanças no protocolo podem fazer o helper ignorar dados; isso aparece em **Opções → Eventos ignorados** e nos logs.
- As estimativas para hunts não visitadas assumem que seu ritmo relativo se mantém entre hunts e não consideram boosts, VIP ou bônus de guild.
- Valores de drops especiais (tokens, fragmentos) não entram no lucro líquido.
