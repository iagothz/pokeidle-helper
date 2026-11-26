# Fixtures

| Arquivo                   | Origem                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `batalha-bellsprout.json` | Eventos reais observados em 26/11/2026 (v1.488.1) na hunt Bellsprout, acrescidos de eventos de consumo (`cura`, `revive`, `bola`, `capturado`) no formato do `sessao-hunt.mjs` do jogo.      |
| `welcome.json`            | Sintético, no formato lido por `aoEntrar()` do `app.js` v1.488.1. Contém campos sensíveis de propósito para testar o filtro. Substituir por uma captura real anonimizada assim que possível. |
| `creatures.json`          | Recorte de `/assets/creatures.json` com as espécies usadas nos testes.                                                                                                                       |
| `items.json`              | Recorte no formato de `/assets/items.json`.                                                                                                                                                  |
