$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host "AI FARM - development startup" -ForegroundColor Green
Write-Host "HTTPS login:   https://localhost:5226/auth.html" -ForegroundColor Green
Write-Host "HTTPS Swagger: https://localhost:5226/swagger" -ForegroundColor Green
Write-Host "HTTP fallback: http://localhost:5227/auth.html" -ForegroundColor Yellow
Write-Host "HTTP Swagger:  http://localhost:5227/swagger" -ForegroundColor Yellow
Write-Host ""
Write-Host "Trusting HTTPS certificate..." -ForegroundColor Cyan
dotnet dev-certs https --trust | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warning "HTTPS certificate could not be trusted. The HTTP fallback remains available on port 5227."
}
Write-Host "Starting ASP.NET Core backend with HTTPS..." -ForegroundColor Cyan
dotnet run --launch-profile https
