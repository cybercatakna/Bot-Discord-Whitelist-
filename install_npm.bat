@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
where npm >nul 2>nul
if not errorlevel 1 goto install_deps

echo [INFO] ไม่พบ node/npm กำลังติดตั้งอัตโนมัติ...
where winget >nul 2>nul
if not errorlevel 1 (
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
) else (
  where choco >nul 2>nul
  if not errorlevel 1 (
    choco install nodejs-lts -y
  ) else (
    echo [ERROR] ไม่พบ winget/choco สำหรับติดตั้งอัตโนมัติ
    echo [ERROR] กรุณาติดตั้ง Node.js ก่อน: https://nodejs.org/
    echo.
    pause
    exit /b 1
  )
)

set "PATH=%ProgramFiles%\nodejs;%PATH%"
set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] ติดตั้ง node ไม่สำเร็จ
  echo.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] ติดตั้ง npm ไม่สำเร็จ
  echo.
  pause
  exit /b 1
)

:install_deps
echo [INFO] กำลังติดตั้ง dependencies (npm install)...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install ไม่สำเร็จ
  echo.
  pause
  exit /b 1
)

echo [INFO] ติดตั้งเสร็จแล้ว
echo.
echo กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง...
pause >nul
exit /b
