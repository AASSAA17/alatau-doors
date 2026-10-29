$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $localRuntime = Join-Path $env:USERPROFILE '.local/node/node-v24.22.1-win-x64'
  if (Test-Path (Join-Path $localRuntime 'node.exe')) {
    $env:Path = $localRuntime + ';' + $env:Path
  } else {
    throw 'Install Node.js 24 LTS, then run npm install and npm run dev.'
  }
}
& npm.cmd run dev
exit $LASTEXITCODE
