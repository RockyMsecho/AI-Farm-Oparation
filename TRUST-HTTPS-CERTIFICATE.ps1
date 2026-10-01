$ErrorActionPreference = "Stop"
Write-Host "Trusting the local ASP.NET Core HTTPS development certificate..." -ForegroundColor Cyan
dotnet dev-certs https --clean
dotnet dev-certs https --trust
Write-Host "HTTPS certificate is trusted. You can now run the backend." -ForegroundColor Green
