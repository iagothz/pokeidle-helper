# Automações (Não lançado)

Status: **implementado**, falta o teste manual no jogo. Referência das mensagens: [mensagens-cliente.md](mensagens-cliente.md).

## Escopo

| #   | Automação                                    | Como age                                                                           | Padrão    |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------- | --------- |
| 0   | Base: canal de comandos, chave geral, limite | —                                                                                  | desligada |
| 1   | Viagem com nova tentativa (clique na hunt)   | `hunt.select { slug }` a cada 1 s                                                  | ligada\*  |
| 2   | Captura de espécie fora da pokédex           | VIP: `auto.set { autoBallAteCapturar: true }`; sem VIP: clique no painel de caídos | desligada |
| 3   | Reposição de balls, poções e revives         | `shop.buy { kind, id, qty }`                                                       | desligada |
| 4   | Trocar o ativo pelo melhor da hunt           | `team.active { pokemonId }`                                                        | desligada |
| 5   | Rotação de hunts                             | viagem (1) quando o nível libera uma hunt nova                                     | desligada |

\* Só age quando você clica numa hunt; depende da chave geral.

Fora do escopo: tudo que gasta moeda premium ou envolve outros jogadores (`loja.*`, `market.*`, `passe.*`, `banco.*`, `orbs.*`, chat).

## Decisões do jogador

- Captura sem VIP: em vez do auto-ball nativo (que o jogo trava para VIP), o helper clica nas linhas do painel "Proximidade para capturar" (`#caidos-lista .caido`), o mesmo clique que o jogador faria, só nas espécies sem captura.
- Rotação: gatilho é o nível do treinador liberar uma hunt nova (`level >= hunt.nivel`, mesma regra do jogo); o jogador escolhe o critério (lucro/h, XP/h ou maior nível).
- Reposição: mínimo 200, alvo 1000, sem reserva de gold por padrão, desligada por padrão.
- Versão do jogo: as automações não são bloqueadas quando a versão difere da validada; o aviso de versão do painel continua.

## Premissas (conferidas no app.js v1.495.6)

- Toda escrita do jogo passa por `enviar(obj)` → `ws.send(JSON.stringify(obj))`.
- `auto.set` sempre leva todos os campos de `CAMPOS_AUTO_SET` (o helper replica `pacoteAutoSet`).
- O clique nos caídos chama `enviar({ t: 'ball.throw', ballId: bolaEscolhida(), slot })`; a bola é a selecionada no próprio painel.
- Pokédex: `estado.pokedex[<chave>].c` = capturas. Espécies de Outland usam outra chave (`chavePokedex`) e podem ser vistas como "não capturadas".
- Troca de ativo: o cliente espera 3 s entre trocas; o helper espera 3,5 s.
- **A confirmar no teste manual:** `autoBallAteCapturar` desliga sozinho depois da captura; o servidor aceita `shop.buy` fora do Centro.

## Arquitetura

```
UI (aba Automação, clique na aba Hunts)
   ▼
content/automacao/ServicoAutomacao   tique a cada 250 ms + eventos de batalha
   ├── viagem.ts        loop 1 s até huntSlug == alvo; para em 60 s, cancelamento ou troca manual
   ├── autoBallDex.ts   spawn de espécie sem captura → auto.set (só VIP)
   ├── capturaCaidos.ts sem VIP: clique em caído sem captura (1 a cada 1,1 s, até 15 por caído)
   ├── reposicao.ts     estoque < mínimo → shop.buy até o alvo (reserva de gold, 30 s por item)
   ├── melhorAtivo.ts   ao chegar na hunt → team.active do "melhor" do ranking (até 3 tentativas)
   └── rotacao.ts       nível liberou hunt nova → viagem para a melhor pelo critério
   ▼
content/automacao/emissor.ts         chave geral, valida, registra (log INFO + últimas 20 ações)
   ▼ window.postMessage (envelope 'pokeidle-helper.comando')
capture/comandos.ts (MAIN)           origem, lista branca, esquema Zod estrito, limite 1/s por tipo e 90/min
   ▼
ws.send no socket do jogo guardado pelo WebSocketObservado
```

| Decisão                                                  | Motivo                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Enviar pelo socket, não clicar no DOM                    | Mensagens mapeadas são mais estáveis que seletores; o clique é só fallback |
| Lista branca e esquema validados também no mundo MAIN    | Um bug no content script não consegue mandar outro tipo                    |
| Limite 1 msg/s por tipo (900 ms na captura) e 90/min     | Ritmo humano; a folga de 100 ms absorve o atraso do `postMessage`          |
| Orquestradores com relógio e jogador injetados           | Testáveis sem DOM nem timers reais                                         |
| Preferências em `chrome.storage.local` validadas por Zod | Regras inválidas são descartadas em vez de quebrar o painel                |

## Critérios de aceite

- [x] Com a chave geral desligada, nenhuma mensagem sai do helper (teste unitário; o e2e continua exigindo só o `hello`).
- [x] A captura recusa tipo fora da lista branca, campo fora do esquema, socket fechado e excesso de frequência, e o content script registra `WARN`.
- [x] Viagem: reenvia a cada 1 s; para ao chegar, em 60 s, ao cancelar ou na troca manual; iniciar outra cancela a anterior.
- [x] Captura: com VIP liga "até capturar" uma vez (espera 5 s e não reenvia enquanto ligado); com qualquer modo de bola já ligado não mexe; sem VIP só clica em caídos sem captura.
- [x] Reposição: compra só abaixo do mínimo, até o alvo, limitada pelo gold acima da reserva, no máximo uma vez a cada 30 s por item.
- [x] Melhor ativo: troca ao chegar numa hunt, respeita a espera e não troca no Centro nem quando o melhor já é o ativo.
- [x] Rotação: só age quando o nível libera uma hunt nova e o destino é diferente da atual.
- [x] `pnpm check` passa.
- [ ] Teste manual no jogo (roteiro em [teste-manual.md](teste-manual.md)).

## Riscos

| Risco                                                      | Mitigação                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Servidor tratar automação como abuso                       | Ritmo humano, só ações que os botões do jogo já fazem              |
| `autoBallAteCapturar` capturar outra espécie antes da nova | Religa quando a espécie sem captura aparece de novo                |
| Mudança de protocolo ou de layout numa versão nova         | Esquemas estritos; mensagens recusadas aparecem em "Últimas ações" |
| Compra repetida por estado atrasado                        | Espera de 30 s por item entre compras                              |
