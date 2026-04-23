@echo off
echo Stopping previous instance...
taskkill /F /IM AkordishKeit.exe >nul 2>&1
taskkill /F /PID 21820 >nul 2>&1
timeout /t 1 /nobreak >nul
echo Starting backend...
dotnet run --project AkordishKeit.csproj
