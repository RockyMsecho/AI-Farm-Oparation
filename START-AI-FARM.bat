@echo off
setlocal
cd /d "%~dp0"
echo AI FARM - development startup
echo.
echo Default HTTPS:
echo   Login:   https://localhost:5226/auth.html
echo   Swagger: https://localhost:5226/swagger
echo.
echo If HTTPS times out on this PC, use the HTTP fallback profile:
echo   dotnet run --launch-profile http-fallback
echo   Login:   http://localhost:5227/auth.html
echo   Swagger: http://localhost:5227/swagger
echo.
echo Trusting HTTPS development certificate...
dotnet dev-certs https --trust
if errorlevel 1 (
  echo Warning: HTTPS certificate could not be trusted.
  echo The HTTP fallback is still available on port 5227.
)
echo Starting backend with HTTPS...
dotnet run --launch-profile https
pause
