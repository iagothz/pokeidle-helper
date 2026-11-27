# Análise das hunts no Power BI

O script `scripts/exportar-powerbi.mjs` lê o backup do PokeIdle Helper e gera CSVs num esquema estrela, prontos para o Power BI Desktop. Com eles dá para comparar hunts, ver a evolução por nível do pokémon ativo, onde o tempo vai (luta, deslocamento, espera) e se o autocatch se paga.

## Gerar os CSVs

Pré-requisito: Node 22 ou superior (o mesmo do projeto). O script não tem dependências.

1. Na extensão, exporte o backup (gera `pokeidle-helper-backup.json`; backups grandes saem em várias partes).
2. Rode, apontando uma pasta **fora do repositório** (o script recusa saída dentro dele):

```powershell
node scripts/exportar-powerbi.mjs "$env:USERPROFILE\Downloads\pokeidle-helper\pokeidle-helper-backup.json" --saida "$env:USERPROFILE\Downloads\pokeidle-helper\powerbi"
```

| Opção                    | Padrão                                  | Uso                                                                |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------ |
| `<backup.json> [...]`    | obrigatório                             | Um ou mais arquivos (as partes de um backup ou backups diferentes) |
| `--saida <pasta>`        | obrigatório                             | Onde gravar os CSVs e o `exportacao.log`                           |
| `--itens <arquivo\|url>` | `https://pokeidle.io/assets/items.json` | Catálogo de itens; use um arquivo salvo para rodar offline         |
| `--fuso <IANA>`          | fuso do sistema                         | Fuso das datas e horas (ex.: `America/Sao_Paulo`)                  |

Sessões repetidas entre partes ficam uma só (a de maior tempo ativo). Avisos (sessão inválida, drop fora do catálogo, bola sem preço) saem no terminal e no `exportacao.log` da pasta de saída, em JSON por linha, com rotação ao passar de 1 MB. Código de saída: `0` ok, `2` entrada inválida, `1` falha inesperada.

Para atualizar o relatório, exporte um backup novo, rode o script de novo na mesma pasta e clique em **Atualizar** no Power BI.

## Tabelas

Todos os CSVs são UTF-8 com BOM, separados por vírgula, com ponto decimal, datas `aaaa-mm-dd hh:mm:ss` no fuso escolhido e `true`/`false` nos lógicos. Tempos ficam em milissegundos (`*_ms`) e valores em gold.

### Dimensões

| Tabela       | Chave       | Colunas                                                                                                                                                                             |
| ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dim_hunt`   | `hunt_id`   | `hunt_nome`                                                                                                                                                                         |
| `dim_sessao` | `sessao_id` | `rotulo` (hunt + dia/hora), `inicio`, `fim`, `pokemon_id`, `especie_id`, `nivel_inicial`, `nivel_final`, `tipo_sazonal`, `escudo_sazonal`, `aberta`, `fases_medidas`, `tem_detalhe` |
| `dim_tempo`  | `data_id`   | `data`, `ano`, `mes`, `mes_nome`, `ano_mes`, `dia`, `dia_semana` (1 = segunda), `dia_semana_nome`; um dia por linha, sem buracos, do primeiro ao último dia com sessão              |
| `dim_bola`   | `bola_id`   | `nome`, `preco` (Poke 5, Great 20, Quick 50, Ultra 130)                                                                                                                             |
| `dim_item`   | `item_id`   | `nome`, `categoria`, `preco_npc` (venda ao NPC), `preco_compra` (`priceGold` da loja; só poções e revives têm), `raro`                                                              |

### Fatos

| Tabela         | Grão                                       | Origem no backup | Colunas principais                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fato_sessao`  | uma sessão                                 | totais da sessão | `ms_ativo`, `abates`, `capturas`, `xp_pokemon`, `xp_treinador`, `gold`, `vendas_auto`, `valor_drops`, golpes e dano dados/recebidos, `desmaios`, `fugas`, `luta_ms`, `deslocamento_ms`, `espera_ms`, `ondas`, `fases_medidas`, `bolas_usadas`/`custo_bolas`, `pocoes_usadas`/`custo_pocoes`, `revives_usados`/`custo_revives`, `tokens_usados`, `lucro_liquido` |
| `fato_trecho`  | um nível do pokémon ativo dentro da sessão | `trechos`        | `trecho_seq`, `pokemon_id`, `nivel`, `tipo_sazonal`, `inicio`, `fim`, `ms_ativo`, `abates`, `golpes_dados`, `dano_causado`, `xp_pokemon`, `gold`, `desmaios`, fases                                                                                                                                                                                             |
| `fato_abate`   | um abate                                   | `abatesDetalhe`  | `momento`, `hora`, `nivel`, `golpes`, `dano` (inclui overkill), `duracao_ms`, `xp`, `gold`                                                                                                                                                                                                                                                                      |
| `fato_consumo` | um evento de consumo                       | `consumo`        | `momento`, `hora`, `nivel` (do trecho em curso), `tipo` (`pocao`, `revive`, `bola`, `captura`, `desmaio`), `bola_id`, `item_id`, `quantidade`, `custo`, e nas capturas `especie_id`, `nivel_capturado`, `qualidade`, `shiny`, `valor_venda_auto`                                                                                                                |
| `fato_drop`    | um item dropado na sessão                  | `drops`          | `item_id` (resolvido pelo nome quando o backup só tem o nome), `item_nome`, `quantidade`, `valor_npc`                                                                                                                                                                                                                                                           |

Todos os fatos têm `sessao_id`, `hunt_id` e `data_id`.

Premissas de preço:

- **Bolas**: preço fixo da `dim_bola`. Bola com id desconhecido entra com custo 0 e gera aviso.
- **Poções e revives**: custo = `priceGold` do `items.json` (Ultra Potion 22, Revive 40). É o preço de compra na loja, na mesma escala das bolas. O `npcPrice` desses itens é o valor de venda e não entra no custo.
- **Drops**: valor = `npcPrice` do `items.json` (Leaf Stone 5 000).
- **Tokens de boss**: custo 0, como no jogo (`tokens_usados` fica disponível).
- `lucro_liquido = gold + vendas_auto + valor_drops − custo_bolas − custo_pocoes − custo_revives`. Se você guarda as pedras em vez de vender, use a medida sem drops (abaixo).

Cuidados com os dados:

- Sessões antigas (antes do formato v5 detalhado) não têm trechos, abates nem consumo (`dim_sessao[tem_detalhe] = false`); entram só em `fato_sessao`.
- Sessões sem fases medidas têm `luta_ms`, `deslocamento_ms` e `espera_ms` zerados (`fases_medidas = false`). As medidas de % de fases abaixo somam ms, então essas sessões não diluem o resultado. Para medidas por hora que dependem das fases, filtre `fases_medidas = true`.
- `fato_abate[golpes]` é aproximado quando há vários alvos ao mesmo tempo. Para golpes por abate prefira a razão das somas em `fato_trecho`.
- Uma sessão `aberta = true` ainda estava em andamento quando o backup foi gerado.

## Importar no Power BI Desktop

O jeito mais robusto, independente da localidade do Windows (pt-BR usa vírgula decimal), é uma função do Power Query que já aplica os tipos com cultura `en-US`.

1. **Página Inicial → Transformar dados → Nova fonte → Consulta nula**. Em **Editor Avançado**, cole e renomeie a consulta para `PastaPowerBI`, trocando pelo caminho da sua pasta (com a barra no final):

```powerquery
"C:\caminho\para\powerbi\" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]
```

2. Outra consulta nula, chamada `CarregarCsv`:

```powerquery
(nome as text) as table =>
let
    Fonte = Csv.Document(
        File.Contents(PastaPowerBI & nome & ".csv"),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Cabecalho = Table.PromoteHeaders(Fonte, [PromoteAllScalars = true]),
    Textos = {
        "sessao_id", "hunt_id", "hunt_nome", "rotulo", "pokemon_id", "tipo_sazonal", "tipo",
        "nome", "categoria", "item_nome", "mes_nome", "ano_mes", "dia_semana_nome"
    },
    Logicos = {"raro", "aberta", "fases_medidas", "tem_detalhe", "escudo_sazonal", "shiny"},
    DataHora = {"inicio", "fim", "momento"},
    Tipo = (c as text) as type =>
        if List.Contains(Textos, c) then type text
        else if List.Contains(Logicos, c) then type logical
        else if List.Contains(DataHora, c) then type datetime
        else if c = "data" then type date
        else if c = "qualidade" then type number
        else Int64.Type,
    Tipada = Table.TransformColumnTypes(
        Cabecalho,
        List.Transform(Table.ColumnNames(Cabecalho), each {_, Tipo(_)}),
        "en-US"
    )
in
    Tipada
```

3. Para cada tabela, uma consulta nula com o nome da tabela e o corpo `= CarregarCsv("fato_sessao")` (troque o nome). As dez: `dim_hunt`, `dim_sessao`, `dim_tempo`, `dim_bola`, `dim_item`, `fato_sessao`, `fato_trecho`, `fato_abate`, `fato_consumo`, `fato_drop`.
4. Clique com o botão direito em `PastaPowerBI` e `CarregarCsv` e desmarque **Habilitar carga**. **Fechar e aplicar**.
5. Selecione `dim_tempo` → **Ferramentas de tabela → Marcar como tabela de data** → coluna `data`.
6. Em `dim_sessao`, classifique `rotulo` pela coluna `inicio` (**Classificar por coluna**); em `dim_tempo`, `mes_nome` por `mes` e `dia_semana_nome` por `dia_semana`.
7. Oculte no modo de exibição de relatório as colunas de chave dos fatos (`sessao_id`, `hunt_id`, `data_id`, `bola_id`, `item_id`) para que os filtros venham sempre das dimensões.

## Relacionamentos

Todos um-para-muitos, filtro em direção única (dimensão → fato), ativos.

| De (1)                  | Para (\*)                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `dim_hunt[hunt_id]`     | `hunt_id` de `fato_sessao`, `fato_trecho`, `fato_abate`, `fato_consumo`, `fato_drop` |
| `dim_sessao[sessao_id]` | `sessao_id` dos cinco fatos                                                          |
| `dim_tempo[data_id]`    | `data_id` dos cinco fatos                                                            |
| `dim_bola[bola_id]`     | `fato_consumo[bola_id]`                                                              |
| `dim_item[item_id]`     | `fato_consumo[item_id]` e `fato_drop[item_id]`                                       |

Não ligue `dim_sessao` a `dim_hunt` nem os fatos entre si: as chaves já estão em cada fato, e assim não há caminhos ambíguos. `dim_bola` e `dim_item` são separadas porque os ids de bola (1–4) colidem com ids de itens.

Os níveis ficam como coluna nos fatos (`fato_trecho[nivel]`, `fato_abate[nivel]`, `fato_consumo[nivel]`). Para cruzar níveis entre fatos num mesmo visual, crie uma tabela calculada e relacione-a às três colunas:

```dax
dim_nivel =
DISTINCT (
    UNION (
        SELECTCOLUMNS ( fato_trecho, "nivel", fato_trecho[nivel] ),
        SELECTCOLUMNS ( fato_abate, "nivel", fato_abate[nivel] ),
        SELECTCOLUMNS ( fato_consumo, "nivel", fato_consumo[nivel] )
    )
)
```

## Medidas DAX

Crie uma tabela vazia `Medidas` (**Inserir dados** → OK) e coloque nela as medidas abaixo, com pastas de exibição por assunto. Formatos sugeridos: `#,0` para quantidades e gold, `0.0` para razões, `0.0%` para percentuais.

### Base

```dax
Horas Ativas = DIVIDE ( SUM ( fato_sessao[ms_ativo] ), 3600000 )
Sessões = DISTINCTCOUNT ( fato_sessao[sessao_id] )
XP Pokémon = SUM ( fato_sessao[xp_pokemon] )
Gold Abates = SUM ( fato_sessao[gold] )
Vendas Auto = SUM ( fato_sessao[vendas_auto] )
Valor Drops = SUM ( fato_sessao[valor_drops] )
Custo Bolas = SUM ( fato_sessao[custo_bolas] )
Custo Poções = SUM ( fato_sessao[custo_pocoes] ) + SUM ( fato_sessao[custo_revives] )
Lucro Líquido = SUM ( fato_sessao[lucro_liquido] )
Lucro Sem Drops = [Lucro Líquido] - [Valor Drops]
Abates = SUM ( fato_sessao[abates] )
Capturas = SUM ( fato_sessao[capturas] )
Bolas Usadas = SUM ( fato_sessao[bolas_usadas] )
```

### Por hora

```dax
XP/h = DIVIDE ( [XP Pokémon], [Horas Ativas] )
Gold/h = DIVIDE ( [Gold Abates], [Horas Ativas] )
Lucro Líquido/h = DIVIDE ( [Lucro Líquido], [Horas Ativas] )
Lucro Sem Drops/h = DIVIDE ( [Lucro Sem Drops], [Horas Ativas] )
Abates/h = DIVIDE ( [Abates], [Horas Ativas] )
Poções/h = DIVIDE ( SUM ( fato_sessao[pocoes_usadas] ), [Horas Ativas] )
Desmaios/h = DIVIDE ( SUM ( fato_sessao[desmaios] ), [Horas Ativas] )
Dano Recebido/h = DIVIDE ( SUM ( fato_sessao[dano_recebido] ), [Horas Ativas] )
```

### Combate e evolução por nível (a partir de `fato_trecho`)

```dax
Horas Trecho = DIVIDE ( SUM ( fato_trecho[ms_ativo] ), 3600000 )
Golpes/Abate = DIVIDE ( SUM ( fato_trecho[golpes_dados] ), SUM ( fato_trecho[abates] ) )
Dano/Abate = DIVIDE ( SUM ( fato_trecho[dano_causado] ), SUM ( fato_trecho[abates] ) )
XP/h Nível = DIVIDE ( SUM ( fato_trecho[xp_pokemon] ), [Horas Trecho] )
Gold/h Nível = DIVIDE ( SUM ( fato_trecho[gold] ), [Horas Trecho] )
Abates/h Nível = DIVIDE ( SUM ( fato_trecho[abates] ), [Horas Trecho] )
Minutos no Nível = DIVIDE ( SUM ( fato_trecho[ms_ativo] ), 60000 )
Duração Média do Abate (s) = DIVIDE ( AVERAGE ( fato_abate[duracao_ms] ), 1000 )
XP Média por Abate = AVERAGE ( fato_abate[xp] )
```

### Fases do tempo

As somas ignoram naturalmente as sessões sem fases medidas (valores zero).

```dax
Fases ms =
SUM ( fato_sessao[luta_ms] ) + SUM ( fato_sessao[deslocamento_ms] ) + SUM ( fato_sessao[espera_ms] )
% Luta = DIVIDE ( SUM ( fato_sessao[luta_ms] ), [Fases ms] )
% Deslocamento = DIVIDE ( SUM ( fato_sessao[deslocamento_ms] ), [Fases ms] )
% Espera = DIVIDE ( SUM ( fato_sessao[espera_ms] ), [Fases ms] )
Segundos de Deslocamento por Onda =
DIVIDE ( SUM ( fato_sessao[deslocamento_ms] ), SUM ( fato_sessao[ondas] ) ) / 1000
XP/h (só com fases) =
CALCULATE ( [XP/h], dim_sessao[fases_medidas] = TRUE () )
```

Para os mesmos percentuais por nível, troque `fato_sessao` por `fato_trecho`.

### Autocatch e captura

```dax
Taxa de Captura = DIVIDE ( [Capturas], [Bolas Usadas] )
Bolas por Captura = DIVIDE ( [Bolas Usadas], [Capturas] )
Custo por Captura = DIVIDE ( [Custo Bolas], [Capturas] )
Venda Média por Captura =
CALCULATE (
    AVERAGE ( fato_consumo[valor_venda_auto] ),
    fato_consumo[tipo] = "captura",
    fato_consumo[valor_venda_auto] > 0
)
Saldo Autocatch = [Vendas Auto] - [Custo Bolas]
Saldo Autocatch/h = DIVIDE ( [Saldo Autocatch], [Horas Ativas] )
Qualidade Média = CALCULATE ( AVERAGE ( fato_consumo[qualidade] ), fato_consumo[tipo] = "captura" )
Capturas (eventos) = CALCULATE ( COUNTROWS ( fato_consumo ), fato_consumo[tipo] = "captura" )
Bolas (eventos) = CALCULATE ( COUNTROWS ( fato_consumo ), fato_consumo[tipo] = "bola" )
Taxa de Captura (eventos) = DIVIDE ( [Capturas (eventos)], [Bolas (eventos)] )
Saldo Autocatch Acumulado =
VAR ate = MAX ( fato_consumo[momento] )
RETURN
    CALCULATE (
        SUM ( fato_consumo[valor_venda_auto] ) - SUM ( fato_consumo[custo] ),
        fato_consumo[tipo] IN { "captura", "bola" },
        fato_consumo[momento] <= ate,
        REMOVEFILTERS ( fato_consumo[momento] )
    )
```

`Taxa de Captura` usa os totais da sessão (inclui sessões antigas); a versão `(eventos)` usa só sessões com linha do tempo de consumo, que é a que combina com nível e hora.

## Páginas sugeridas

Use o tema da seção seguinte, segmentações de `dim_hunt[hunt_nome]`, `dim_tempo[data]` e `dim_sessao[tipo_sazonal]` sincronizadas em todas as páginas, e o painel de filtros com `dim_sessao[aberta]`.

1. **Visão geral**
   - Cartões: `XP/h`, `Gold/h`, `Lucro Líquido/h`, `Abates/h`, `Horas Ativas`, `Sessões`.
   - Barras clusterizadas: eixo `dim_hunt[hunt_nome]`, valores `XP/h` e `Lucro Líquido/h` (dois visuais lado a lado para não misturar escalas).
   - Tabela por `dim_sessao[rotulo]` com `Horas Ativas`, `XP/h`, `Lucro Líquido/h`, `Golpes/Abate`, `Poções/h`, com barras de dados na formatação condicional.
2. **Evolução por nível**
   - Linha e coluna: eixo `fato_trecho[nivel]` (contínuo), colunas `Minutos no Nível`, linha `XP/h Nível`, eixo secundário `Golpes/Abate`. Mostra quando o ativo passa a matar em menos golpes e quanto isso rende.
   - Dispersão: X `Golpes/Abate`, Y `Abates/h Nível`, detalhes `fato_trecho[nivel]`, legenda `dim_hunt[hunt_nome]`, tamanho `Horas Trecho`.
   - Linha `Dano/Abate` por nível para enxergar overkill crescendo.
3. **Comparação entre hunts**
   - Matriz com hunts nas linhas e `XP/h`, `Gold/h`, `Lucro Líquido/h`, `Lucro Sem Drops/h`, `Abates/h`, `Golpes/Abate`, `Poções/h`, `Desmaios/h`, `% Deslocamento`; escala de cores por coluna.
   - Cascata do lucro: crie a tabela calculada abaixo e use `Componente` como categoria e `Valor Componente` como valor.

     ```dax
     Componentes Lucro =
     DATATABLE ( "Componente", STRING, "Ordem", INTEGER,
         { { "Gold dos abates", 1 }, { "Vendas auto", 2 }, { "Drops", 3 },
           { "Bolas", 4 }, { "Poções e revives", 5 } } )

     Valor Componente =
     SWITCH (
         SELECTEDVALUE ( 'Componentes Lucro'[Componente] ),
         "Gold dos abates", [Gold Abates],
         "Vendas auto", [Vendas Auto],
         "Drops", [Valor Drops],
         "Bolas", - [Custo Bolas],
         "Poções e revives", - [Custo Poções]
     )
     ```

4. **Fases do tempo**
   - Barras 100% empilhadas: eixo `dim_hunt[hunt_nome]`, valores `% Luta`, `% Deslocamento`, `% Espera` (cores: luta em destaque, deslocamento e espera em tons neutros).
   - Mesmo visual por `fato_trecho[nivel]` (com as medidas por trecho) para ver a luta encolhendo e o deslocamento dominando quando o ativo fica forte.
   - Cartão `Segundos de Deslocamento por Onda` por hunt.
5. **Economia do autocatch**
   - Cartões: `Taxa de Captura`, `Bolas por Captura`, `Custo por Captura`, `Venda Média por Captura`, `Saldo Autocatch/h`.
   - Linha: eixo `fato_consumo[momento]`, valor `Saldo Autocatch Acumulado`, filtrado na hunt com autocatch.
   - Dispersão: X `fato_consumo[qualidade]`, Y `fato_consumo[valor_venda_auto]` (não resumir), filtro `tipo = captura`.
   - Colunas: `fato_consumo[qualidade]` em compartimentos de 0,1 (**Novo grupo → Compartimentos**) com a contagem de capturas.
6. **Ritmo e consumo**
   - Colunas: `fato_abate[golpes]` como eixo, contagem de abates (histograma de golpes por abate).
   - Linha: eixo `fato_consumo[nivel]`, valores `Poções/h` calculada por trecho (`DIVIDE ( CALCULATE ( COUNTROWS ( fato_consumo ), fato_consumo[tipo] = "pocao" ), [Horas Trecho] )`) com a `dim_nivel` ligando os dois fatos.
   - Mapa de calor (matriz): linhas `dim_tempo[data]`, colunas `fato_abate[hora]`, valor contagem de abates.

## Tema

Salve como `pokeidle.json` e aplique em **Exibir → Temas → Procurar temas**. Paleta com contraste suficiente nos dois fundos e distinguível para daltonismo.

```json
{
  "name": "PokeIdle Helper",
  "dataColors": [
    "#2F6FDE",
    "#E8743B",
    "#19A979",
    "#B55CC8",
    "#D64550",
    "#13A4B4",
    "#C9A227",
    "#6C8893"
  ],
  "background": "#FFFFFF",
  "foreground": "#1F2933",
  "tableAccent": "#2F6FDE",
  "good": "#19A979",
  "neutral": "#C9A227",
  "bad": "#D64550",
  "maximum": "#2F6FDE",
  "center": "#F2F4F7",
  "minimum": "#D64550",
  "textClasses": {
    "title": { "fontFace": "Segoe UI Semibold", "fontSize": 13, "color": "#1F2933" },
    "label": { "fontFace": "Segoe UI", "fontSize": 10, "color": "#52606D" },
    "callout": { "fontFace": "Segoe UI Light", "fontSize": 28, "color": "#1F2933" }
  },
  "visualStyles": {
    "*": {
      "*": {
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }],
        "background": [{ "show": true, "transparency": 0 }]
      }
    }
  }
}
```

Dicas de acabamento: um título por visual dizendo a pergunta que ele responde ("Quanto XP por hora em cada nível?"), rótulos de dados só onde há poucos pontos, eixos de gold em milhares (`#,0,"k"`) e XP em milhões (`#,0.0,,"M"`), e a mesma cor para a mesma hunt em todas as páginas (fixe as cores pela legenda de `hunt_nome`).

## Testes

```powershell
npx vitest run tests/unit/exportarPowerbi.test.ts
```

Os testes cobrem a leitura e validação do backup e do catálogo, deduplicação, custos e lucro, trechos, abates, consumo, drops resolvidos por nome, calendário, fuso, o CSV e a gravação dos arquivos com log.
