@echo off
cd /d "%~dp0"
echo Trusting AI FARM HTTPS development certificate...
dotnet dev-certs https --clean
dotnet dev-certs https --trust
pause
