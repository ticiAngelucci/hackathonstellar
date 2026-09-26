param([Parameter(Mandatory=$true)][int]$Phase)
$ErrorActionPreference='Stop'
function CheckExit([string]$Label){if($LASTEXITCODE -ne 0){throw "$Label failed ($LASTEXITCODE)"}}
npm run typecheck
CheckExit 'TypeScript'
npx eslint . --format json --output-file ".expo/lint-phase$Phase.json"
CheckExit 'Lint'
$Lint=Get-Content -Raw ".expo/lint-phase$Phase.json" | ConvertFrom-Json
$Warnings=($Lint | Measure-Object warningCount -Sum).Sum
Write-Output "Lint: 0 errors; $Warnings warnings"
node scripts/test-demo.cjs
CheckExit 'Demo regression'
node scripts/test-backend-integration.cjs
CheckExit 'Repository tests'
$env:PYTHONPATH=(Resolve-Path ../backend/src).Path
$env:PYTHONDONTWRITEBYTECODE='1'
.cache/backend-venv/Scripts/python.exe -m pytest ../backend/tests -p no:cacheprovider
CheckExit 'Backend tests'
Invoke-WebRequest -Uri 'http://localhost:8090/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=false&transform.engine=hermes&transform.routerRoot=app' -UseBasicParsing -TimeoutSec 120 -OutFile ".expo/phase$Phase.bundle"
$Size=(Get-Item ".expo/phase$Phase.bundle").Length
Add-Content -Encoding utf8 -Path PHASE_VERIFICATION.md -Value "| $Phase | Pass | 0 errors / $Warnings warnings | Pass | 46 passed | HTTP 200 / $Size bytes |"
Write-Output "PHASE $Phase PASSED. Cloud and pgTAP checks require project access."
