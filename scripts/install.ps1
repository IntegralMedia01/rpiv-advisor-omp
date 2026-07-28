$ErrorActionPreference = "Stop"

$Source = Join-Path $PSScriptRoot "..\.omp\agents\consultant.md"
$AgentRoot = if ($env:PI_CODING_AGENT_DIR) {
    $env:PI_CODING_AGENT_DIR
} else {
    Join-Path ([Environment]::GetFolderPath("UserProfile")) ".omp\agent"
}
$TargetDir = Join-Path $AgentRoot "agents"
$Target = Join-Path $TargetDir "consultant.md"

if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Cannot find consultant agent definition: $Source"
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
Copy-Item -LiteralPath $Source -Destination $Target -Force

Write-Host "Installed OMP consultant task agent:"
Write-Host "  $Target"
Write-Host ""
Write-Host "Open /agents and press Ctrl+R, or restart OMP, to reload agent definitions."
