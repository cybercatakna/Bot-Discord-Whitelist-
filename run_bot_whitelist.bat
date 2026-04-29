@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] ไม่พบ node กรุณารัน install_npm.bat ก่อน
  echo.
  pause
  exit /b 1
)

echo [INFO] กำลังรัน index.js...
node bot_whitelist.js
if errorlevel 1 (
  echo [ERROR] index.js หยุดทำงาน
) else (
  echo [INFO] index.js ปิดการทำงานแล้ว
)

echo.
echo กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง...
pause >nul
exit /b
