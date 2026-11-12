$projects = @(
    @{ path = "mathscore-backend"; cmd = "node server.js" },
    @{ path = "mathscore-admin"; cmd = "npm run dev" },
    @{ path = "mathscore-student"; cmd = "npm run dev" }
)

foreach ($p in $projects) {
    Write-Host "Starting $($p.path)..."
    Start-Process cmd -ArgumentList "/k", "cd /d `"$PSScriptRoot\$($p.path)`" && $($p.cmd)"
}
