param(
    [int]$Porta = 0,
    [string]$Definicao = (Join-Path $PSScriptRoot 'medidas.json'),
    [string]$ExportarModelo = ''
)
$ErrorActionPreference = 'Stop'

function Get-PastaPowerBi {
    $pacote = Get-AppxPackage -Name 'Microsoft.MicrosoftPowerBIDesktop' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pacote) { return (Join-Path $pacote.InstallLocation 'bin') }
    $local = Join-Path $env:ProgramFiles 'Microsoft Power BI Desktop\bin'
    if (Test-Path $local) { return $local }
    throw 'Power BI Desktop não encontrado.'
}

function Import-Tom([string]$pasta) {
    foreach ($dll in 'Microsoft.PowerBI.Amo.Core.dll', 'Microsoft.PowerBI.Amo.dll', 'Microsoft.PowerBI.Tabular.Json.dll', 'Microsoft.PowerBI.Tabular.dll') {
        try { Add-Type -Path (Join-Path $pasta $dll) } catch [System.Reflection.ReflectionTypeLoadException] { Write-Verbose "Tipos parciais em $dll" }
    }
}

function Find-PortaModelo {
    $ids = @(Get-Process msmdsrv -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
    if ($ids.Count -eq 0) { throw 'Nenhum relatório aberto no Power BI Desktop.' }
    if ($ids.Count -gt 1) { throw 'Há mais de um relatório aberto; informe -Porta.' }
    $conexao = Get-NetTCPConnection -OwningProcess $ids[0] -State Listen | Where-Object { $_.LocalAddress -eq '127.0.0.1' } | Select-Object -First 1
    return $conexao.LocalPort
}

function Repair-DimHunt($model) {
    $tabela = $model.Tables['dim_hunt']
    if (-not $tabela -or -not $tabela.Columns['Column1']) { return }
    $fonte = $tabela.Partitions[0].Source
    $fonte.Expression = $fonte.Expression -replace '(?s)#"Tipo Alterado" = .*', 'Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    Tipos = Table.TransformColumnTypes(Cabecalhos,{{"hunt_id", type text}, {"hunt_nome", type text}})
in
    Tipos'
    foreach ($par in @(@('Column1', 'hunt_id'), @('Column2', 'hunt_nome'))) {
        $coluna = $tabela.Columns[$par[0]]
        $coluna.Name = $par[1]
        $coluna.SourceColumn = $par[1]
    }
    $tabela.RequestRefresh([Microsoft.AnalysisServices.Tabular.RefreshType]::Full)
    Write-Output 'dim_hunt: cabeçalho promovido'
}

function Set-TabelaCalculada($model, [string]$nome, [string]$expressao) {
    $tabela = $model.Tables[$nome]
    if (-not $tabela) {
        $tabela = New-Object Microsoft.AnalysisServices.Tabular.Table
        $tabela.Name = $nome
        $particao = New-Object Microsoft.AnalysisServices.Tabular.Partition
        $particao.Name = $nome
        $particao.Source = New-Object Microsoft.AnalysisServices.Tabular.CalculatedPartitionSource
        $tabela.Partitions.Add($particao)
        $model.Tables.Add($tabela)
    }
    $tabela.Partitions[0].Source.Expression = $expressao
    $tabela.RequestRefresh([Microsoft.AnalysisServices.Tabular.RefreshType]::Full)
}

function Repair-Relacionamentos($model) {
    foreach ($r in $model.Relationships) {
        if ($r.ToTable.Name -like 'LocalDateTable*') { continue }
        if ($r.CrossFilteringBehavior -ne 'OneDirection' -or $r.FromCardinality -eq 'One') {
            $r.FromCardinality = 'Many'
            $r.ToCardinality = 'One'
            $r.CrossFilteringBehavior = 'OneDirection'
            Write-Output ("relacionamento ajustado: {0}.{1} -> {2}" -f $r.FromTable.Name, $r.FromColumn.Name, $r.ToTable.Name)
        }
    }
}

function Add-Relacionamento($model, [string]$dimensao, [string]$coluna, [string]$fato) {
    $existe = $model.Relationships | Where-Object { $_.FromTable.Name -eq $fato -and $_.FromColumn.Name -eq $coluna -and $_.ToTable.Name -eq $dimensao }
    if ($existe) { return }
    $r = New-Object Microsoft.AnalysisServices.Tabular.SingleColumnRelationship
    $r.Name = [guid]::NewGuid().ToString()
    $r.FromColumn = $model.Tables[$fato].Columns[$coluna]
    $r.ToColumn = $model.Tables[$dimensao].Columns[$coluna]
    $r.FromCardinality = 'Many'
    $r.ToCardinality = 'One'
    $r.CrossFilteringBehavior = 'OneDirection'
    $model.Relationships.Add($r)
}

function Set-Medidas($model, $medidas) {
    $tabela = $model.Tables['Medidas']
    $tabela.Columns | ForEach-Object { $_.IsHidden = $true }
    foreach ($m in @($tabela.Measures)) { [void]$tabela.Measures.Remove($m) }
    foreach ($m in $medidas) {
        $x = New-Object Microsoft.AnalysisServices.Tabular.Measure
        $x.Name = $m.nome
        $x.DisplayFolder = $m.pasta
        $x.Expression = $m.expressao
        $x.FormatString = $m.formato
        $tabela.Measures.Add($x)
    }
}

function Export-Modelo($db, [string]$destino) {
    $opcoes = New-Object Microsoft.AnalysisServices.Tabular.SerializeOptions
    $opcoes.IgnoreInferredObjects = $true
    $opcoes.IgnoreInferredProperties = $true
    $opcoes.IgnoreTimestamps = $true
    $json = [Microsoft.AnalysisServices.Tabular.JsonSerializer]::SerializeDatabase($db, $opcoes)
    New-Item -ItemType Directory -Force -Path (Split-Path $destino) | Out-Null
    [IO.File]::WriteAllText($destino, $json, (New-Object Text.UTF8Encoding($false)))
    Write-Output "modelo exportado: $destino"
}

$definicao = Get-Content $Definicao -Raw -Encoding UTF8 | ConvertFrom-Json
Import-Tom (Get-PastaPowerBi)
if ($Porta -eq 0) { $Porta = Find-PortaModelo }
$servidor = New-Object Microsoft.AnalysisServices.Tabular.Server
$servidor.Connect("Data Source=localhost:$Porta")
try {
    $db = $servidor.Databases[0]
    $model = $db.Model
    Repair-DimHunt $model
    foreach ($p in $definicao.tabelas.PSObject.Properties) { Set-TabelaCalculada $model $p.Name $p.Value }
    $model.SaveChanges() | Out-Null
    Repair-Relacionamentos $model
    foreach ($r in $definicao.relacionamentos) {
        foreach ($f in $r.fatos) { Add-Relacionamento $model $r.de $r.coluna $f }
    }
    Set-Medidas $model $definicao.medidas
    $componentes = $model.Tables['Componentes Lucro']
    $componentes.Columns['Componente'].SortByColumn = $componentes.Columns['Ordem']
    $model.RequestRefresh([Microsoft.AnalysisServices.Tabular.RefreshType]::Calculate)
    $model.SaveChanges() | Out-Null
    $erros = @($model.Tables['Medidas'].Measures | Where-Object { $_.State -ne 'Ready' })
    foreach ($e in $erros) { Write-Warning ("medida com erro: {0}: {1}" -f $e.Name, $e.ErrorMessage) }
    Write-Output ("medidas: {0}, com erro: {1}, relacionamentos: {2}" -f $model.Tables['Medidas'].Measures.Count, $erros.Count, $model.Relationships.Count)
    if ($ExportarModelo) { Export-Modelo $db $ExportarModelo }
    if ($erros.Count -gt 0) { exit 1 }
}
catch {
    Write-Error ("Falha ao aplicar o modelo: {0}`n{1}" -f $_.Exception.Message, $_.ScriptStackTrace)
    exit 1
}
finally {
    $servidor.Disconnect()
}
