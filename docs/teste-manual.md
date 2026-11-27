# Roteiro de teste manual no Brave (por release)

Faça com o Brave Shields **ligado**.

- [ ] Carregar a pasta da versão em `brave://extensions` sem erros.
- [ ] Abrir `https://pokeidle.io/app`, fazer login e ver o botão **PH**.
- [ ] Em **Opções**, confirmar "Login capturado: sim" e "Espécies no catálogo" maior que 400.
- [ ] Em **Opções**, conferir que "Versão do jogo" é a mesma do `app.js?v=` da página. Se aparecer o aviso "O jogo foi atualizado", revisar o protocolo (`docs/protocolo.md`) antes de atualizar `VERSAO_JOGO_VALIDADA`.
- [ ] Entrar numa hunt e, depois de 2 min, comparar XP, gold e abates da aba **Sessão** com o painel SESSÃO do jogo (diferença de até 1%).
- [ ] Na aba Network do DevTools, filtrar por WS e confirmar que só o jogo envia mensagens (`hello`, comandos do próprio jogo).
- [ ] Trocar de hunt e ver a sessão anterior aparecer como `real` ou `pouca amostra` na aba **Hunts** (sessões com 3 min ou mais).
- [ ] Recarregar a página e confirmar que o histórico continua lá.
- [ ] Ir para uma hunt com tipos resistentes ao ativo e ver o alerta de desvantagem.
- [ ] Exportar dados e logs e conferir que não há `token`, `email`, `cpf` ou `carteira` nos arquivos.
- [ ] Desligar a extensão, recarregar a página e confirmar que o jogo funciona normalmente.
- [ ] Na aba **Hunts**, marcar "até o nível do ativo" e confirmar que o nível entre parênteses é o do seu pokémon ativo e que hunts acima dele somem.
- [ ] Com VIP ou boost ativo, ver a lista de bônus aplicados acima do ranking.
- [ ] Na aba **Sessão**, depois de 5 min usando poções, conferir a autonomia com o estoque mostrado na mochila do jogo.
- [ ] Conferir "Próximo nível" com a previsão do placar de economia do jogo.
- [ ] Apanhar até 20 golpes e ver o alerta com a fração real de super efetivos.
- [ ] Arrastar o painel, minimizar, recarregar a página e ver posição, estado e aba mantidos.
- [ ] Trocar de hunt depois de 3 min e ver a sessão na aba **Histórico**.
- [ ] Em **Opções**, ver "Dados de combate do ativo: IVs sim · qualidade sim · stats sim" e "Golpes da espécie do ativo" maior que 2. Se aparecer "não", o simulador usa médias: exportar os logs.
- [ ] Na aba **Time**, comparar os abates/h simulados do ativo com o painel SESSÃO depois de 5 min (a calibração aparece no topo da aba).
- [ ] Na aba **Economia**, comparar a chance da bola com a tabela de captura da ficha da espécie no jogo.
- [ ] Na aba **Progresso**, digitar um nível-alvo e conferir o XP que falta com a ficha do jogo.
- [ ] Capturar com venda automática ligada e ver "Vendas auto/h" subir na aba **Sessão**.
- [ ] Em **Opções**, clicar em "Fazer backup agora" e conferir `Downloadspokeidle-helperpokeidle-helper-backup.json` com todas as sessões.
- [ ] Fechar uma sessão (trocar de hunt) e ver o arquivo de backup atualizado.
- [ ] Limpar o histórico, importar o backup e ver as sessões de volta no **Histórico**.

## Automações

- [ ] Com a chave geral desligada, abrir a aba **Automação** e conferir o selo "somente leitura" no cabeçalho; clicar numa hunt da aba **Hunts** não faz nada.
- [ ] Ligar a chave geral: o cabeçalho mostra "automação ligada".
- [ ] **Viagem:** clicar numa hunt liberada logo depois de levar dano; a linha mostra "indo (n)" e a troca acontece uns 3 s depois. Conferir "Última viagem: … chegou".
- [ ] **Viagem:** clicar numa hunt e, antes de chegar, trocar de hunt pelo mapa do jogo: a viagem termina como "troca manual".
- [ ] **Captura (VIP):** numa hunt com espécie sem captura na pokédex, ligar "Capturar espécies que faltam" e ver o "lançar até capturar" acender no painel de automações do jogo; depois da captura, confirmar que o jogo desliga sozinho.
- [ ] **Captura (sem VIP):** escolher a bola no painel de caídos; quando cair uma espécie sem captura, ver a bola sendo arremessada (uma a cada ~1 s) e nenhuma nas espécies já capturadas.
- [ ] **Reposição:** marcar uma bola com estoque abaixo de 200, fora do Centro; conferir se a compra até 1000 acontece. Se o jogo recusar fora do Centro, anotar e exportar os logs.
- [ ] **Reposição:** com reserva de gold maior que o gold atual, nada é comprado e o log registra "Gold insuficiente para repor".
- [ ] **Time:** com "Trocar o ativo pelo melhor" ligado, viajar para uma hunt onde o "melhor" da aba Hunts é outro pokémon e ver a troca do ativo.
- [ ] **Rotação:** subir de nível até liberar uma hunt nova e ver a viagem automática para a melhor pelo critério escolhido.
- [ ] Conferir "Últimas ações" na aba **Automação** e as entradas "Comando enviado" nos logs exportados.
