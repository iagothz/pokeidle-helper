# Mensagens enviadas pelo cliente (app.js v1.495.6, levantado em 27/11/2026)

Levantamento estático do `app.js` do jogo: todas as chamadas a `enviar(obj)`, a única função que escreve no WebSocket (`estado.ws.send(JSON.stringify(obj))`), mais o `ping` enviado direto pelo `setInterval` de 25 s. Nenhum outro módulo do cliente (`campo.mjs`, `popup.mjs` etc.) escreve no socket; `shared/auto-set.mjs` só monta o pacote `auto.set`.

São **240 tipos** (campo `t`). Os campos listados são as chaves do objeto literal; `?` marca campo opcional e `a|b` campos alternativos. Tipos montados fora da chamada (`regra.mensagem`, `HIST_MODOS[...].msg`, `pacoteAutoSet`, `enviarFormacao`, `pedirAoServidorGinasio`, `enviarAcao`, `confirmarTroca`, `vendaDepotDaTela`) foram resolvidos à mão e aparecem com a origem _(indireto)_.

Com as automações desligadas (padrão), o helper não envia nenhuma destas mensagens. Ligadas, envia apenas `hunt.select`, `auto.set`, `shop.buy` e `team.active` (lista branca em `src/shared/comandos.ts`; ver [plano-automacoes.md](plano-automacoes.md)).

## Observações

- O combate da hunt roda no servidor. O cliente só escolhe a hunt (`hunt.select`), o pokémon ativo (`team.active`), arremessa bolas em caídos (`ball.throw`), usa itens (`item.use`) e configura as automações nativas (`auto.set`).
- `auto.set` é a automação do próprio jogo: `autoBall`, `autoBallSemParar`, `autoBallAteCapturar`, `ballIds`, `autoPotion`, `potionIds`, `autoRevive`, `reviveIds`, `hpLimiar`, `autoVoltarHunt` e `pvpAutoFila` (lista em `shared/auto-set.mjs`, `CAMPOS_AUTO_SET`). O pacote sempre reenvia todos os campos atuais mesclados com o patch.
- `aplicarAtalhosUrl` aceita `?hunt=<slug>` (envia `hunt.select`) e `?auto=...` (envia `auto.set`) na URL do `/app`.
- `cliente.economia { ativo }` avisa o servidor quando a cena está oculta (modo economia).
- `hello { nick, token, delta: 1, dispositivo }` abre a sessão; leva o token e nunca deve ser lido nem registrado.

## Conexão (2)

| Tipo    | Campos                                  | Origem no app.js               |
| ------- | --------------------------------------- | ------------------------------ |
| `hello` | `delta`, `dispositivo`, `nick`, `token` | `conectar`                     |
| `ping`  | —                                       | `conectar`, `verificarConexao` |

## Cliente (1)

| Tipo               | Campos  | Origem no app.js           |
| ------------------ | ------- | -------------------------- |
| `cliente.economia` | `ativo` | `avisarEconomiaAoServidor` |

## Hunt (1)

| Tipo          | Campos | Origem no app.js          |
| ------------- | ------ | ------------------------- |
| `hunt.select` | `slug` | `aplicarAtalhosUrl`, `ir` |

## Equipe (2)

| Tipo          | Campos              | Origem no app.js                                      |
| ------------- | ------------------- | ----------------------------------------------------- |
| `team.active` | `pokemonId`         | `linhaPokemon`, `pintarEstado`                        |
| `team.move`   | `pokemonId`, `slot` | `aoResponderColecao`, `linhaPokemon`, `tirarDaEquipe` |

## Automações nativas do jogo (1)

| Tipo       | Campos                                                                                                                                                              | Origem no app.js    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `auto.set` | `autoBall`, `autoBallAteCapturar`, `autoBallSemParar`, `autoPotion`, `autoRevive`, `autoVoltarHunt`, `ballIds`, `hpLimiar`, `potionIds`, `pvpAutoFila`, `reviveIds` | `aplicarAtalhosUrl` |

## Captura (1)

| Tipo         | Campos           | Origem no app.js |
| ------------ | ---------------- | ---------------- |
| `ball.throw` | `ballId`, `slot` | `pintarCaidos`   |

## Itens (1)

| Tipo       | Campos   | Origem no app.js |
| ---------- | -------- | ---------------- |
| `item.use` | `itemId` | `usar`           |

## Centro pokémon (6)

| Tipo              | Campos | Origem no app.js                                    |
| ----------------- | ------ | --------------------------------------------------- |
| `centro.andar`    | `dir`  | `areaAndavelCentro`, `sincronizarDirecao`, `soltar` |
| `centro.curar`    | —      | `ir`, `tiqueCentro`                                 |
| `centro.desistir` | —      | `confirmarDesistenciaCombate`                       |
| `centro.ir`       | —      | `ir`                                                |
| `centro.sala`     | `sala` | `pintarSalasDaPraca`                                |
| `centro.salas`    | —      | `pedirSalasDaPraca`                                 |

## Bosses (3)

| Tipo          | Campos         | Origem no app.js     |
| ------------- | -------------- | -------------------- |
| `boss.auto`   | `ativo`, `key` | `linhaAutoBoss`      |
| `boss.entrar` | `key`          | `pintarFichaDoBoss`  |
| `boss.sair`   | —              | `confirmarSairArena` |

## Arena mística (3)

| Tipo             | Campos   | Origem no app.js        |
| ---------------- | -------- | ----------------------- |
| `mistico.bola`   | `ballId` | `jogar`                 |
| `mistico.entrar` | —        | `abrirUsoTicketMistico` |
| `mistico.sair`   | —        | `confirmarSairArena`    |

## Safari (1)

| Tipo            | Campos    | Origem no app.js |
| --------------- | --------- | ---------------- |
| `safari.entrar` | `tickets` | `dur`            |

## Raid (4)

| Tipo             | Campos       | Origem no app.js         |
| ---------------- | ------------ | ------------------------ |
| `raid.equipe`    | `pokemonIds` | `abrirEquipeDoRaid`      |
| `raid.fichas`    | —            | `pedirFichasGigantamax`  |
| `raid.info`      | —            | `pedirRaid`              |
| `raid.inscrever` | —            | `confirmarInscricaoRaid` |

## Outland (1)

| Tipo           | Campos | Origem no app.js |
| -------------- | ------ | ---------------- |
| `outland.tier` | `tier` | `abrirModal`     |

## `guild.*` (35)

| Tipo                         | Campos                                       | Origem no app.js                       |
| ---------------------------- | -------------------------------------------- | -------------------------------------- |
| `guild.aceitar`              | `inviteId`                                   | `pintarGuildConvites`                  |
| `guild.apagar`               | —                                            | `confirmarApagarGuild`                 |
| `guild.banco`                | —                                            | `pedirBancoDaGuild`                    |
| `guild.bancoLog`             | —                                            | `abrirDoacoesDaGuild`                  |
| `guild.bossRaid`             | `pagina`                                     | `pedirBossRaid`                        |
| `guild.caixa`                | —                                            | `pintarGuildCaixa`                     |
| `guild.candidatar`           | `guildId`                                    | `pintarListaQuadro`                    |
| `guild.candidatura.cancelar` | `guildId`                                    | `pintarListaQuadro`                    |
| `guild.convidar`             | `nick`                                       | `pintarGuildMembros`                   |
| `guild.convite.cancelar`     | `inviteId`                                   | `pintarGuildCaixa`                     |
| `guild.criar`                | `brasao`, `nome`, `tag`, `tagCor`            | `previaTagNova`                        |
| `guild.detalhe`              | `guildId`                                    | `pedirDetalheGuild`                    |
| `guild.doar`                 | `guildId`, `qtd`                             | `confirmarDoacaoBanco`                 |
| `guild.editarBrasao`         | `brasao`                                     | `montarGuildEditarBrasao`              |
| `guild.entrar`               | `guildId`                                    | `pintarListaQuadro`                    |
| `guild.escalacao`            | —                                            | `abrirEscalacaoGuild`                  |
| `guild.escalacao.salvar`     | `playerIds`                                  | `salvarEscalacao`                      |
| `guild.expulsar`             | `alvoId`                                     | `pintarMembrosGuildPainel`             |
| `guild.info`                 | —                                            | `abrirGuild`                           |
| `guild.membroEquipe`         | `guildId`, `membroId`                        | `pedirEquipeMembroGuild`               |
| `guild.nome`                 | `nome`                                       | `abrirTrocaDeNomeGuild`                |
| `guild.pedido.aceitar`       | `pedidoId`                                   | `pintarGuildCaixa`                     |
| `guild.pedido.recusar`       | `pedidoId`                                   | `pintarGuildCaixa`                     |
| `guild.pvp.analise`          | —                                            | `pedirAnaliseGuerra`                   |
| `guild.pvp.equipe.salvar`    | `pokemonIds`                                 | `abrirEditorEquipeGuerra`              |
| `guild.pvp.info`             | —                                            | `aoEvento`, `montarPvp`, `tiqueGuerra` |
| `guild.pvp.registrar`        | —                                            | `montarGuildPvp`                       |
| `guild.pvp.replay`           | —                                            | `pedirReplayGuerra`                    |
| `guild.quadro`               | `busca`, `ordem`, `pagina`, `so`             | `pedirQuadroGuild`                     |
| `guild.recrutamento`         | `descricao`, `politica`, `reqLevel`, `reqPr` | `lido`                                 |
| `guild.recusar`              | `inviteId`                                   | `pintarGuildConvites`                  |
| `guild.sair`                 | —                                            | `confirmarSairGuild`                   |
| `guild.subdono`              | `alvoId`, `ligado`                           | `pintarMembrosGuildPainel`             |
| `guild.tag`                  | `tag`, `tagCor`                              | `previaTag`                            |
| `guild.transferirLider`      | `alvoId`                                     | `pintarMembrosGuildPainel`             |

## `market.*` (23)

| Tipo                      | Campos                                                                                  | Origem no app.js                 |
| ------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| `market.anunciarChat`     | `id`                                                                                    | `pedirAltoFalante`               |
| `market.anuncio`          | `id`                                                                                    | `abrirAnuncioNoMercado`          |
| `market.atualizar`        | `pedidos`                                                                               | `pedirMercado`                   |
| `market.cancelar`         | `id`                                                                                    | `confirmarRemoverAnuncio`        |
| `market.comprar`          | `id`, `moeda`, `preco`, `qtd`, `sorteioUi`                                              | `pedirCompraAnuncio`             |
| `market.comprarLote`      | `precoMax`, `qtd`, `totalMax`                                                           | `pedir`                          |
| `market.cotarLote`        | `qtd`, `seq`                                                                            | `pedir`                          |
| `market.criar`            | `bicicletaId`, `casaId`, `dias`, `itemId`, `moeda`, `pokemonId`, `preco`, `qtd`, `tipo` | `publicar`                       |
| `market.editar`           | `id`, `moeda`, `preco`                                                                  | `enviarTudo`                     |
| `market.especies`         | `favoritos\|filtros`                                                                    | _(indireto)_                     |
| `market.estender`         | `dias`, `id`                                                                            | `enviarTudo`                     |
| `market.favoritar`        | `ativo`, `id`                                                                           | `alternarFavoritoMercado`        |
| `market.favoritarEspecie` | `ativo`, `speciesId`                                                                    | `alternarFavoritoEspecieMercado` |
| `market.favoritarItem`    | `ativo`, `itemId`                                                                       | `alternarFavoritoItemMercado`    |
| `market.favoritos`        | —                                                                                       | _(indireto)_                     |
| `market.historico`        | `filtros`, `pagina`, `seq`                                                              | _(indireto)_                     |
| `market.historicoCompras` | `filtros`, `pagina`, `seq`                                                              | _(indireto)_                     |
| `market.historicoGlobal`  | `filtros`, `pagina`, `seq`                                                              | _(indireto)_                     |
| `market.item`             | `itemId`, `moeda`                                                                       | _(indireto)_                     |
| `market.itens`            | —                                                                                       | `atualizar`                      |
| `market.listar`           | `filtros`                                                                               | _(indireto)_                     |
| `market.medias`           | —                                                                                       | `pedirMediasRmtSePreciso`        |
| `market.meus`             | —                                                                                       | _(indireto)_                     |

## `amigo.*` (15)

| Tipo                   | Campos                          | Origem no app.js                        |
| ---------------------- | ------------------------------- | --------------------------------------- |
| `amigo.aceitar`        | `pedidoId`                      | `ligarAmigos`                           |
| `amigo.busca`          | `termo`                         | `buscarTreinadores`                     |
| `amigo.cancelarPedido` | `nick`                          | `ligarAmigos`                           |
| `amigo.coins`          | `amigoId`, `valor`              | `atualizar`                             |
| `amigo.dm.abrir`       | `amigoId`                       | `abrirConversaAmigo`                    |
| `amigo.dm.enviar`      | `amigoId`, `pokemonId`, `texto` | `enviarDMAmigo`, `enviarPokemonDMAmigo` |
| `amigo.dm.ler`         | `amigoId`                       | `aoReceberAmigos`, `lerConversaAVista`  |
| `amigo.pedir`          | `mensagem`, `nick`              | `abrirPedidoAmizade`                    |
| `amigo.pvp.cancelar`   | `conviteId`                     | `acaoDoConviteAmistoso`                 |
| `amigo.pvp.convidar`   | `amigoId`                       | `confirmarDesafioAmigo`                 |
| `amigo.pvp.fita`       | `conviteId`                     | `acaoDoConviteAmistoso`                 |
| `amigo.pvp.responder`  | `aceitar`, `conviteId`          | `acaoDoConviteAmistoso`                 |
| `amigo.recusar`        | `pedidoId`                      | `ligarAmigos`                           |
| `amigo.remover`        | `amigoId`                       | `confirmarExcluirAmigo`                 |
| `amigo.removerVarios`  | `amigoIds`                      | `pintar`                                |

## `pvp.*` (12)

| Tipo                  | Campos                                | Origem no app.js                                  |
| --------------------- | ------------------------------------- | ------------------------------------------------- |
| `pvp.fila.entrar`     | —                                     | `abrir`                                           |
| `pvp.fila.sair`       | —                                     | `abrir`, `pintarPillDeFila`                       |
| `pvp.formacao.apagar` | `slot`                                | _(indireto)_                                      |
| `pvp.formacao.salvar` | `casas`, `nome`, `pokemonIds`, `slot` | _(indireto)_                                      |
| `pvp.formacao.usar`   | `slot`                                | _(indireto)_                                      |
| `pvp.formacoes`       | —                                     | `abrirPartidaPvp`, `irmaoNoTabuleiro`             |
| `pvp.info`            | `semLadder`, `soCaixa`                | `abrirPartidaPvp`, `aoReceberPvp`, `pedirPvpInfo` |
| `pvp.mensal`          | `pagina`                              | `pedirTopMensal`                                  |
| `pvp.partida.ficha`   | `id`                                  | `alternarPartidaDoHistorico`                      |
| `pvp.partida.vista`   | `id`                                  | `abrirPartidaPvp`                                 |
| `pvp.tabela`          | `pagina`                              | `pedirTabelaPvp`                                  |
| `pvp.time.salvar`     | `casas`, `pokemonIds`                 | `abrirSeletorDeTimePvp`                           |

## `chat.*` (11)

| Tipo                   | Campos                             | Origem no app.js                                                                                                             |
| ---------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `chat.comando`         | `cmd`, `minutos`, `motivo`, `nick` | `interpretarComandoChat`                                                                                                     |
| `chat.compartilhar`    | `canal`, `idioma`, `pokemonId?`    | _(indireto)_                                                                                                                 |
| `chat.compartilharDex` | `canal`, `idioma`, `speciesId`     | `compartilharDexNoChat`                                                                                                      |
| `chat.delete`          | `id`                               | `pintarChat`                                                                                                                 |
| `chat.desafixar`       | `canal`, `idioma`                  | `pintarChat`, `pintarChatFixada`                                                                                             |
| `chat.fixar`           | `id`                               | `pintarChat`                                                                                                                 |
| `chat.historico`       | `canal`                            | `pedirHistoricoChat`                                                                                                         |
| `chat.interromper`     | `ligado`                           | `aoClicarInterromperChat`                                                                                                    |
| `chat.mute`            | `minutos`, `motivo`, `nick`        | `pintarChat`                                                                                                                 |
| `chat.send`            | `canal`, `idioma`, `texto`         | `enviarChat`, `enviarChatGuildPainel`                                                                                        |
| `chat.verPokemon`      | `dica`, `nick`, `pokemonId`        | `abrirFichaPokemonGuerra`, `ligarAmigos`, `ligarFichaNoAnuncio`, `pedirDicaPokemonGuerra`, `pedirFichaPublica`, `pintarChat` |

## `comunidade.*` (7)

| Tipo                   | Campos                       | Origem no app.js  |
| ---------------------- | ---------------------------- | ----------------- |
| `comunidade.criar`     | `form`                       | `conferir`        |
| `comunidade.equipe`    | `casas?`, `id`, `pokemonIds` | _(indireto)_      |
| `comunidade.excluir`   | `id`                         | _(indireto)_      |
| `comunidade.fita`      | `id`, `partida`              | _(indireto)_      |
| `comunidade.info`      | —                            | `pedirComunidade` |
| `comunidade.inscrever` | `id`, `senha`                | _(indireto)_      |
| `comunidade.sair`      | `id`                         | _(indireto)_      |

## `perfil.*` (7)

| Tipo                     | Campos             | Origem no app.js           |
| ------------------------ | ------------------ | -------------------------- |
| `perfil.estatisticas`    | —                  | `pedirEstatisticasDaConta` |
| `perfil.sobre.denunciar` | `nick`             | `denunciarSobre`           |
| `perfil.sobre.ler`       | —                  | `pedirSobreMeu`            |
| `perfil.sobre.limpar`    | `nick`, `texto`    | `apagarSobreDaEquipe`      |
| `perfil.sobre.salvar`    | `publico`, `texto` | `ficha`                    |
| `perfil.statsPublico`    | `publico`          | `atualizarFiltroNivel`     |
| `perfil.vitrine`         | `ids`              | `salvarVitrine`            |

## `casa.*` (6)

| Tipo               | Campos           | Origem no app.js        |
| ------------------ | ---------------- | ----------------------- |
| `casa.craftar`     | `casaIds`        | `montarCraftCasa`       |
| `casa.entrar`      | `casaId`         | `pedir`                 |
| `casa.fabricar`    | —                | `montarFabricarCasa`    |
| `casa.sair`        | —                | `tiqueCentro`           |
| `casa.sincronizar` | —                | `aoAbrirCasa`           |
| `casa.usar`        | `casaId`, `usar` | `cliqueNaCasa`, `pedir` |

## `comercio.*` (6)

| Tipo                | Campos                           | Origem no app.js                    |
| ------------------- | -------------------------------- | ----------------------------------- |
| `comercio.abrir`    | `anuncioId`                      | `abrirDmDoAnuncio`                  |
| `comercio.conversa` | `conversaId`                     | `abrirConversaComercio`             |
| `comercio.enviar`   | `conversaId\|anuncioId`, `texto` | _(indireto)_                        |
| `comercio.excluir`  | `conversaId`                     | `excluirConversaComercio`           |
| `comercio.info`     | —                                | `ligarAmigos`, `pedirListaComercio` |
| `comercio.ler`      | `conversaId`                     | `receberMsgComercio`                |

## `campeonato.*` (5)

| Tipo                   | Campos                       | Origem no app.js                                                                                  |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `campeonato.cancelar`  | `id`                         | `ligarAcaoCampeonato`                                                                             |
| `campeonato.equipe`    | `casas?`, `id`, `pokemonIds` | _(indireto)_                                                                                      |
| `campeonato.fita`      | `id`, `partida`              | _(indireto)_                                                                                      |
| `campeonato.info`      | `id`                         | `abrirCampeonato`, `aoReceberCampeonato`, `irParaModo`, `montarCampeonato`, `pedirPacoteDaEdicao` |
| `campeonato.inscrever` | `id`                         | `ligarAcaoCampeonato`                                                                             |

## `colecao.*` (5)

| Tipo                   | Campos                   | Origem no app.js   |
| ---------------------- | ------------------------ | ------------------ |
| `colecao.mover`        | `para`, `pokemonId`      | `moverColecao`     |
| `colecao.pasta.apagar` | `pasta`                  | `pedirApagarPasta` |
| `colecao.pasta.criar`  | `icone`, `nome`          | `conferir`         |
| `colecao.pasta.editar` | `icone`, `nome`, `pasta` | `conferir`         |
| `colecao.pasta.mover`  | `pasta`, `pokemonId`     | `moverParaPasta`   |

## `pokemon.*` (5)

| Tipo                     | Campos                     | Origem no app.js          |
| ------------------------ | -------------------------- | ------------------------- |
| `pokemon.evoluir`        | `alvoId`, `pokemonId`      | `pedirEvolucao`           |
| `pokemon.mega`           | `pokemonId`                | `pedirMega`               |
| `pokemon.megaRetroceder` | `pokemonId`                | `confirmarRetrocederMega` |
| `pokemon.reduzirNivel`   | `nivelAlvo`, `pokemonId`   | `pedirReducaoNivel`       |
| `pokemon.refinar`        | `pokemonId`, `stat`, `uso` | `linhaTotal`              |

## `shop.*` (5)

| Tipo                   | Campos              | Origem no app.js                |
| ---------------------- | ------------------- | ------------------------------- |
| `shop.autoColecao`     | `regra`             | `aplicar`                       |
| `shop.autoVendaDepot`  | `ativo`             | `alternarAutoVenda`             |
| `shop.buy`             | `id`, `kind`, `qty` | `pintarMarket`, `pintarOvosNpc` |
| `shop.sellAllPokemons` | `ateId`, `filtro?`  | _(indireto)_                    |
| `shop.sellPokemon`     | `pokemonId`         | `pintarVendaPokemons`           |

## `showdown.*` (5)

| Tipo                 | Campos                       | Origem no app.js    |
| -------------------- | ---------------------------- | ------------------- |
| `showdown.cancelar`  | `id`                         | `ligarAcaoShowdown` |
| `showdown.equipe`    | `casas?`, `id`, `pokemonIds` | _(indireto)_        |
| `showdown.fita`      | `id`, `partida`              | _(indireto)_        |
| `showdown.info`      | —                            | `pedirShowdownInfo` |
| `showdown.inscrever` | `id`                         | `ligarAcaoShowdown` |

## `ginasio.*` (4)

| Tipo               | Campos                        | Origem no app.js                            |
| ------------------ | ----------------------------- | ------------------------------------------- |
| `ginasio.desafiar` | `tipo`                        | `desafiarGinasio`                           |
| `ginasio.info`     | —                             | `aoReceberGinasio`, `trazerParaEsteGinasio` |
| `ginasio.painel`   | `tipo`                        | `aoReceberGinasio`                          |
| `ginasio.salvar`   | `casas`, `pokemonIds`, `tipo` | _(indireto)_                                |

## `prey.*` (4)

| Tipo               | Campos                             | Origem no app.js           |
| ------------------ | ---------------------------------- | -------------------------- |
| `prey.desbloquear` | —                                  | `confirmarDesbloqueioPrey` |
| `prey.escolher`    | `cartela`, `dia`, `pk`             | `acao`                     |
| `prey.regioes`     | `cartela`, `regioes`               | `pintar`                   |
| `prey.roletar`     | `cartela`, `categoria`, `dia`, `n` | `enviarRoletadaPrey`       |

## `bicicleta.*` (3)

| Tipo                 | Campos         | Origem no app.js          |
| -------------------- | -------------- | ------------------------- |
| `bicicleta.craftar`  | `bicicletaIds` | `montarCraftBicicleta`    |
| `bicicleta.equipar`  | `bicicletaId`  | `arteBici`                |
| `bicicleta.fabricar` | —              | `montarFabricarBicicleta` |

## `oferenda.*` (3)

| Tipo                  | Campos       | Origem no app.js                                                   |
| --------------------- | ------------ | ------------------------------------------------------------------ |
| `oferenda.girar`      | `pokemonIds` | `confirmarOferenda`                                                |
| `oferenda.protegidos` | —            | `ofrAutoSelecionar`, `ofrLotePedir`, `pedirProtegidosDoSacrificio` |
| `oferenda.tudo`       | —            | `confirmarLoteDaOferenda`                                          |

## `orbs.*` (3)

| Tipo                 | Campos                     | Origem no app.js                |
| -------------------- | -------------------------- | ------------------------------- |
| `orbs.declararConta` | `aceito`, `nick`, `versao` | `confirmarDeclaracaoDeRede`     |
| `orbs.painel`        | —                          | `aplicarFiltroNum`              |
| `orbs.sacar`         | `endereco`, `orbs`, `rede` | `conferir`, `tratarRedeDoSaque` |

## `ranking.*` (3)

| Tipo              | Campos                                             | Origem no app.js                                                                                            |
| ----------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ranking.pedir`   | `aba`, `bossKey`                                   | `abrirAbaRanking`, `aplicarFiltroNum`, `pedirRankingBoss`, `pedirRankingCapturas`, `repedirRankingDaVirada` |
| `ranking.perfil`  | `nick`                                             | `pedirPerfil`                                                                                               |
| `ranking.pokemon` | `level`, `nick`, `pokemonId`, `power`, `speciesId` | `aoClicarLinhaRanking`, `pedirFichaRanking`                                                                 |

## `sacrificio.*` (3)

| Tipo                    | Campos       | Origem no app.js             |
| ----------------------- | ------------ | ---------------------------- |
| `sacrificio.osso`       | `qtd`        | `confirmarOssoSacrificio`    |
| `sacrificio.resgatar`   | —            | `confirmarResgateSacrificio` |
| `sacrificio.sacrificar` | `pokemonIds` | `enviarSacrificio`           |

## `tm.*` (3)

| Tipo           | Campos                | Origem no app.js |
| -------------- | --------------------- | ---------------- |
| `tm.aplicar`   | `itemId`, `pokemonId` | `bloqueadoPara`  |
| `tm.categoria` | `fisico`, `pokemonId` | `rotuloDoBotao`  |
| `tm.trocar`    | `modo`, `tipo?`       | _(indireto)_     |

## `banco.*` (2)

| Tipo              | Campos          | Origem no app.js          |
| ----------------- | --------------- | ------------------------- |
| `banco.coins`     | `nick`, `valor` | `confirmarEnvioDoBanco`   |
| `banco.consultar` | `nick`          | `consultarDestinoDoBanco` |

## `bloqueio.*` (2)

| Tipo                | Campos             | Origem no app.js  |
| ------------------- | ------------------ | ----------------- |
| `bloqueio.alternar` | `bloquear`, `nick` | `definirBloqueio` |
| `bloqueio.lista`    | `importar?`        | _(indireto)_      |

## `loja.*` (2)

| Tipo           | Campos                     | Origem no app.js                                                                         |
| -------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `loja.comprar` | `id`, `precoVisto`, `slot` | `abrirDialogoCaixa`, `comprarChocadeira`, `confirmarAtrasados`, `confirmarCompra`, `ovo` |
| `loja.equipar` | `looktype`                 | `cartao`, `montarLoja`                                                                   |

## `passe.*` (2)

| Tipo               | Campos | Origem no app.js    |
| ------------------ | ------ | ------------------- |
| `passe.comprarVip` | —      | `confirmarPasseVip` |
| `passe.resgatar`   | —      | `resgatarPasse`     |

## `skin.*` (2)

| Tipo          | Campos                        | Origem no app.js    |
| ------------- | ----------------------------- | ------------------- |
| `skin.tirar`  | `pokemonId`                   | `cardPokemonDaSkin` |
| `skin.vestir` | `deId`, `pokemonId`, `skinId` | `cardPokemonDaSkin` |

## `ticket.*` (2)

| Tipo            | Campos                         | Origem no app.js    |
| --------------- | ------------------------------ | ------------------- |
| `ticket.abrir`  | `idioma`, `mensagem`, `topico` | `enviarTicket`      |
| `ticket.estado` | —                              | `pedirEstadoTicket` |

## `visual.*` (2)

| Tipo            | Campos             | Origem no app.js                   |
| --------------- | ------------------ | ---------------------------------- |
| `visual.set`    | `genero`, `visual` | `abrirOnboarding`, `marcarSelecao` |
| `visual.trocar` | `genero`, `visual` | `marcarSelecao`                    |

## `xpshareheld.*` (2)

| Tipo                  | Campos      | Origem no app.js  |
| --------------------- | ----------- | ----------------- |
| `xpshareheld.equipar` | `pokemonId` | `cardXpShareHeld` |
| `xpshareheld.remover` | `pokemonId` | `cardXpShareHeld` |

## `afiliado.*` (1)

| Tipo                | Campos | Origem no app.js |
| ------------------- | ------ | ---------------- |
| `afiliado.recolher` | —      | `pctTexto`       |

## `amigos.*` (1)

| Tipo          | Campos | Origem no app.js |
| ------------- | ------ | ---------------- |
| `amigos.info` | —      | `ligarAmigos`    |

## `aviso.*` (1)

| Tipo              | Campos   | Origem no app.js |
| ----------------- | -------- | ---------------- |
| `aviso.dispensar` | `versao` | `fecharAviso`    |

## `bicicletas.*` (1)

| Tipo                | Campos               | Origem no app.js     |
| ------------------- | -------------------- | -------------------- |
| `bicicletas.listar` | `pagina`, `raridade` | `pedirRegistroBikes` |

## `bolsa.*` (1)

| Tipo              | Campos              | Origem no app.js |
| ----------------- | ------------------- | ---------------- |
| `bolsa.descartar` | `id`, `qtd`, `tipo` | `repintar`       |

## `caixa.*` (1)

| Tipo          | Campos | Origem no app.js    |
| ------------- | ------ | ------------------- |
| `caixa.abrir` | `id`   | `abrirDialogoCaixa` |

## `casas.*` (1)

| Tipo           | Campos               | Origem no app.js     |
| -------------- | -------------------- | -------------------- |
| `casas.listar` | `pagina`, `raridade` | `pedirRegistroCasas` |

## `chocadeira.*` (1)

| Tipo                 | Campos        | Origem no app.js |
| -------------------- | ------------- | ---------------- |
| `chocadeira.colocar` | `ovo`, `slot` | `colocarOvo`     |

## `convite.*` (1)

| Tipo               | Campos   | Origem no app.js         |
| ------------------ | -------- | ------------------------ |
| `convite.resgatar` | `codigo` | `interpretarComandoChat` |

## `csv.*` (1)

| Tipo        | Campos | Origem no app.js |
| ----------- | ------ | ---------------- |
| `csv.pedir` | `tipo` | `pedirCsv`       |

## `discordPop.*` (1)

| Tipo                   | Campos     | Origem no app.js        |
| ---------------------- | ---------- | ----------------------- |
| `discordPop.dispensar` | `campanha` | `dispensarPopupDiscord` |

## `mega.*` (1)

| Tipo            | Campos         | Origem no app.js     |
| --------------- | -------------- | -------------------- |
| `mega.fabricar` | `dex`, `shiny` | `montarFabricarMega` |

## `nametag.*` (1)

| Tipo           | Campos                 | Origem no app.js |
| -------------- | ---------------------- | ---------------- |
| `nametag.usar` | `apelido`, `pokemonId` | `conferir`       |

## `online.*` (1)

| Tipo            | Campos | Origem no app.js    |
| --------------- | ------ | ------------------- |
| `online.unicos` | —      | `pedirOnlineUnicos` |

## `ovoShiny.*` (1)

| Tipo                | Campos | Origem no app.js            |
| ------------------- | ------ | --------------------------- |
| `ovoShiny.fabricar` | —      | `confirmarFabricarOvoShiny` |

## `p5.*` (1)

| Tipo        | Campos                                                       | Origem no app.js |
| ----------- | ------------------------------------------------------------ | ---------------- |
| `p5.listar` | `busca`, `criterios`, `ordem`, `pagina`, `soAVenda`, `tipos` | `pedirP5s`       |

## `shiny.*` (1)

| Tipo           | Campos                                                       | Origem no app.js |
| -------------- | ------------------------------------------------------------ | ---------------- |
| `shiny.listar` | `busca`, `criterios`, `ordem`, `pagina`, `soAVenda`, `tipos` | `pedirShinys`    |

## `shinyStone.*` (1)

| Tipo                  | Campos | Origem no app.js      |
| --------------------- | ------ | --------------------- |
| `shinyStone.fabricar` | `tipo` | `montarFabricarPedra` |

## `starter.*` (1)

| Tipo           | Campos      | Origem no app.js         |
| -------------- | ----------- | ------------------------ |
| `starter.pick` | `speciesId` | `montarCartoesDeStarter` |

## `topcatch.*` (1)

| Tipo             | Campos | Origem no app.js |
| ---------------- | ------ | ---------------- |
| `topcatch.pedir` | —      | `pedirTopCatch`  |

## `treino.*` (1)

| Tipo           | Campos   | Origem no app.js |
| -------------- | -------- | ---------------- |
| `treino.lutar` | `a`, `b` | `lutarTreino`    |

## `tutorial.*` (1)

| Tipo                | Campos | Origem no app.js    |
| ------------------- | ------ | ------------------- |
| `tutorial.concluir` | —      | `finalizarTutorial` |

## `wiki.*` (1)

| Tipo            | Campos | Origem no app.js       |
| --------------- | ------ | ---------------------- |
| `wiki.economia` | —      | `montarEconomiaDoJogo` |

## `xpshare.*` (1)

| Tipo               | Campos                        | Origem no app.js                                 |
| ------------------ | ----------------------------- | ------------------------------------------------ |
| `xpshare.escolher` | `casaId`, `pokemonId`, `slot` | `cardDoPokemon`, `pedir`, `syncCasaBonecoBotoes` |
