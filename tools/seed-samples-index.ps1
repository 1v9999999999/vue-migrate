# tools/seed-samples-index.ps1
# 把 examples/ 下所有目录灌进 samples/INDEX.json，作为 sample-collector 的初始 seed
$ErrorActionPreference = 'Stop'

$ROOT = (Resolve-Path "$PSScriptRoot\..").Path
$EXAMPLES = Join-Path $ROOT "examples"
$SAMPLES = Join-Path $ROOT "samples"
$INDEX = Join-Path $SAMPLES "INDEX.json"
$TSX = Join-Path $ROOT "tools\sample-collector\node_modules\.bin\tsx.cmd"

# 跳过 examples/222 (vue-migrate 转换产物) 和 examples/_old_* (历史 fixture)
$SKIP_PATTERNS = @('222', '_old_*', '_trash*')

function Should-Skip($name) {
    foreach ($p in $SKIP_PATTERNS) {
        if ($name -like $p) { return $true }
    }
    return $false
}

# 1) 创建 samples/ 目录
if (-not (Test-Path $SAMPLES)) {
    New-Item -ItemType Directory -Path $SAMPLES | Out-Null
    Write-Host "[seed] created $SAMPLES" -ForegroundColor Green
}

# 2) 遍历 examples/ 下每个目录
$entries = @()
foreach ($dir in (Get-ChildItem -Path $EXAMPLES -Directory | Sort-Object Name)) {
    if (Should-Skip $dir.Name) {
        Write-Host "[seed] skip: $($dir.Name)" -ForegroundColor DarkGray
        continue
    }

    # 至少要有 .vue 或 .js 文件
    $srcFiles = @(Get-ChildItem -Path $dir.FullName -Recurse -Include *.vue, *.js -ErrorAction SilentlyContinue)
    if ($srcFiles.Count -eq 0) {
        Write-Host "[seed] no source files in $($dir.Name), skip" -ForegroundColor DarkGray
        continue
    }

    Write-Host "[seed] classify: $($dir.Name)" -ForegroundColor Cyan
    $jsonOut = & $TSX "$ROOT\tools\sample-collector\src\index.ts" classify --sample $dir.FullName --json 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[seed] classify failed: $($dir.Name)" -ForegroundColor Yellow
        continue
    }
    $obj = $jsonOut | ConvertFrom-Json
    if ($null -ne $obj) {
        $entries = $entries + $obj
    }
}

# 3) 写 INDEX.json
@{ version = 1; createdAt = (Get-Date).ToString('o'); entries = $entries } | ConvertTo-Json -Depth 6 | Set-Content -Path $INDEX -Encoding UTF8
Write-Host "[seed] wrote $INDEX with $($entries.Count) entries" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Green
foreach ($e in $entries) {
    Write-Host ("  {0,-50} framework={1,-12} state={2,-6} router={3,-5} ts={4,-5} size={5,-6} vueFiles={6}" -f `
        $e.repo, $e.framework, $e.state, $e.router, $e.typescript, $e.size, $e.vueFileCount)
}
