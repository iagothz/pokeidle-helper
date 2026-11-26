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
