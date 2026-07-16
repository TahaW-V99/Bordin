@echo off
setlocal
cd /d "%~dp0.."
for /f "delims=" %%i in ('powershell -NoProfile -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('prisma/dead-letter-audit-liara.mjs'))"') do set B64=%%i
liara shell --app bordin --command "echo %B64% | base64 -d > /tmp/dl-audit.mjs; cd /app; node /tmp/dl-audit.mjs"
