$ErrorActionPreference = "Stop"

Write-Host "AI FARM - development database reset" -ForegroundColor Cyan
Write-Host "WARNING: this deletes the local FarmManagementDB and its test data." -ForegroundColor Yellow
$answer = Read-Host "Type RESET to continue"
if ($answer -ne "RESET") { Write-Host "Cancelled."; exit 1 }

Set-Location $PSScriptRoot

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "The .NET SDK is not installed or is not on PATH. Install the .NET 9 SDK first."
}

Write-Host "Dropping old database..." -ForegroundColor Cyan
dotnet ef database drop --force

Write-Host "Removing old generated migrations (README is kept)..." -ForegroundColor Cyan
Get-ChildItem -Path .\Migrations -File | Where-Object { $_.Name -ne "README.txt" } | Remove-Item -Force

Write-Host "Generating a fresh migration..." -ForegroundColor Cyan
dotnet ef migrations add InitialCreate

Write-Host "Applying the migration..." -ForegroundColor Cyan
dotnet ef database update

Write-Host "Starting the API on HTTPS..." -ForegroundColor Green
dotnet run --launch-profile https
