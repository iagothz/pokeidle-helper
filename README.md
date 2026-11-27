# PokeIdle Helper

Extensão para Brave (e outros navegadores Chromium) que acompanha suas hunts no [PokeIdle](https://pokeidle.io/app) e mostra, num painel sobre o jogo:

- **Sessão atual:** XP/h (pokémon e treinador), gold/h, abates/min, gasto com poções, revives e bolas, lucro líquido (como o jogo) e **lucro real** (somando as capturas vendidas automaticamente, que o jogo não soma), desmaios, XP perdido, taxa de captura e frequência dos drops especiais.
- **Autonomia:** quanto tempo dá para ficar na hunt com as poções e revives que você tem, no ritmo de consumo da sessão, e qual item acaba primeiro.
- **Simulador de combate:** reproduz as fórmulas do jogo (stats, dano, efetividade ampliada na hunt, HP dos selvagens, recargas por poder e speed, Investida, Z-Move, TM de área) para estimar quantos golpes e segundos o **seu** pokémon leva por abate em cada hunt. Pokémon fraco para a hunt mata devagar e o XP/h cai, como no jogo. A simulação é calibrada pelo seu ritmo real.
- **Time:** XP/h, abates/h, golpes por abate e quanto tempo cada pokémon do time aguenta na hunt atual, e as melhores hunts simuladas para qualquer pokémon seu.
- **Ranking de hunts:** por lucro líquido/h ou XP/h, com filtro pelo nível do pokémon ativo. Usa seus dados reais quando você já caçou na hunt e a simulação do seu ativo (com VIP, boosts e bônus de guild ativos) quando ainda não caçou.
- **Progresso:** tempo até qualquer nível-alvo (curva de XP do jogo), quanto falta para o ativo evoluir, pokémons travados pelo nível do treinador e quando liberam, custo do próximo refino.
- **Economia:** chance de captura por bola de cada espécie da hunt, bolas e gold por captura e a melhor bola, arremessos esperados por shiny, pedras de evolução por hora e tempo até o próximo ovo shiny.
- **Dicas de tipo:** vantagem ou desvantagem do pokémon ativo contra a hunt, alerta com a fração real de golpes super efetivos recebidos e qual pokémon do seu time rende mais ali.

A extensão é **somente leitura**: ela observa as mensagens que o jogo já recebe e não envia nada ao servidor.

## Conformidade com os Termos do PokeIdle

A seção 5 dos [Termos](https://pokeidle.io/terms) permite automações, desde que não explorem falhas, não burlem limites e não sobrecarreguem o servidor. O helper fica bem longe disso:

- não envia mensagens pelo WebSocket nem faz requisições aos endpoints do jogo (há teste automatizado para isso);
- só baixa os arquivos estáticos que o próprio jogo já carrega: `/assets/creatures*.json`, `/assets/creatures-audit-overrides.json`, `/assets/items.json` e `/shared/golpes-planilhas.mjs`. Este último é **lido como texto** para extrair a tabela de golpes; o helper nunca executa código do jogo;
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

Cores: uma escala contínua do **vermelho** (ruim) ao **branco** (intermediário) e ao **verde** (bom); quanto mais forte a cor, mais longe do meio. Na hunt atual, XP/h, lucro, gold e abates são coloridos pela posição entre as outras hunts liberadas pelo nível do seu treinador, ajustada pela sua média histórica na mesma hunt; o motivo aparece embaixo do número. A bolinha no botão **PH** resume a sessão (vermelha com lucro negativo, desmaios, muito dano super efetivo ou consumíveis acabando).

- **PH** abre e fecha o painel. O botão fica laranja quando há um aviso, desvantagem de tipo ou muitos golpes super efetivos recebidos.
- Arraste o painel pelo cabeçalho e use **–** / **+** para minimizar e restaurar. Posição, estado e última aba ficam salvos.
- **Sessão:** métricas da hunt atual, onde vai o tempo (lutando, andando, esperando onda) e golpes reais por abate, desmaios, XP perdido, taxa de captura, próximo nível do treinador e do ativo, autonomia de consumíveis e drops. Só o tempo ativo conta: pausas maiores que 60 s entre eventos de batalha são descontadas.
- **Hunts:** o selo de cada linha diz de onde vem o número:
  - `real`: média das suas sessões, com pelo menos 15 min acumulados;
  - `pouca amostra`: real, mas com menos de 15 min;
  - `simulado`: simulação de combate do seu pokémon ativo naquela hunt, calibrada pelo seu ritmo real; mostra segundos e golpes por abate;
  - `estimado`: fórmulas do jogo ajustadas pelo seu ritmo médio nas hunts reais;
  - `teto teórico`: fórmulas do jogo sem ajuste (antes de você ter qualquer hunt medida).
- **Time:** simulação do seu time na hunt atual (XP/h, abates/h, golpes e segundos por abate, quanto aguenta sem poção) e as melhores hunts para o pokémon que você escolher.
- **Progresso:** metas de nível com tempo estimado, evolução do ativo, pokémons travados pelo nível do treinador e custo de refino.
- **Economia:** captura por bola e espécie, melhor bola, shiny, pedras/h e ovo shiny da hunt atual.
- **Histórico:** todas as sessões salvas (de 50 em 50, com "Mostrar mais"), filtro por hunt e resumo do período filtrado.
- **Opções:** backup em arquivo (automático ao fechar cada sessão ou manual), importar backup, exportar seus dados e os logs em JSON, mudar o nível de log, limpar o histórico e conferir se o jogo manda os dados de combate do seu ativo.

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
| `pnpm prints <pasta>`              | Tira prints de cada aba do painel num Chromium real contra o jogo simulado (defina `CHROME_PATH`)             |
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

## Backup em arquivo

Com o backup automático ligado (padrão), cada sessão encerrada regrava `Downloadspokeidle-helperpokeidle-helper-backup.json` com **todas** as sessões. O navegador só permite gravar dentro da pasta Downloads. Para restaurar ou levar para outro PC, use **Opções → Importar backup** e escolha o arquivo (ou todas as partes, se o backup foi dividido). A importação mescla sem duplicar.

A permissão `downloads` existe só para isso; o service worker grava apenas esse nome de arquivo fixo e aceita mensagens só da própria extensão.

## Privacidade

Tudo fica no seu navegador: as sessões e os logs no IndexedDB de `pokeidle.io` e a configuração e as preferências do painel (posição, minimizado, aba) no `chrome.storage.local`. Antes de qualquer processamento, a captura remove campos como `token`, `email`, `cpf`, `carteira` e `ip`. Nada é enviado a lugar nenhum.

## Limitações conhecidas

- O formato das mensagens foi conferido na versão 1.492.0 do jogo. Quando o jogo é atualizado, o painel avisa que a versão mudou e mostra a nova em **Opções → Versão do jogo**. Mudanças no protocolo podem fazer o helper ignorar dados; isso aparece em **Opções → Eventos ignorados** e nos logs.
- O simulador usa as fórmulas do código compartilhado do jogo, mas os IVs e a qualidade dos selvagens são sorteados no servidor: o helper usa a média (IV 16,5 e qualidade ≈ 1,18) e corrige pela calibração com as suas sessões (mediana de real ÷ simulado). O dia sazonal entra no dano; Prey, bestiário e pódio de ginásio não. A calibração usa os golpes reais por abate e os tempos medidos de deslocamento e espera de onda. Com TM de área, supõe metade da onda atingida por golpe.
- As estimativas aplicam os bônus ativos **agora** (VIP, boosts, guild, evento de farm); as linhas `real` ficam com os bônus que você tinha quando caçou.
- Desde 15/10/2026 o loot de itens não vira gold e o NPC não compra os drops especiais (tokens, fragmentos): o helper mostra só a frequência deles.
- A chance de captura não inclui boosts aplicados pelo servidor (Capture Boost, Kick, Prey, Safari); compare com a sua taxa real mostrada na mesma aba.
- A autonomia supõe o ritmo de consumo atual e só aparece depois de 5 min ativos e 3 usos de cada item; bolas aparecem na tabela mas não limitam a permanência.
- A sugestão do melhor pokémon do time vem da simulação. Sem dados de espécie, cai para uma heurística por tipo (dano causado ÷ √dano recebido, com redutor de nível).
- Em **Opções → Dados de combate do ativo** dá para ver se o jogo está mandando IVs, qualidade e stats do seu ativo; sem eles o simulador usa médias.
