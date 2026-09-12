@echo off
REM Starts the sandbox node. Headless by default; pass --gui for the node's
REM own Swing window. Windows counterpart of start.sh - keep them in sync.

set "ROOT=%~dp0.."
pushd "%ROOT%" >nul || exit /b 1

if not exist signum-node.jar (
  echo start: signum-node.jar missing - run .\scripts\bootstrap.sh 1>&2
  popd >nul
  exit /b 1
)

if not exist html\sandbox\index.html (
  echo start: warning - html\sandbox\index.html missing, / will 404 until you run "bun run build" 1>&2
)

set "MODE=--headless"
if "%~1"=="--gui" (
  set "MODE="
  shift
)

echo start: http://localhost:6876/
java -jar signum-node.jar %MODE% -c ./conf/
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul
exit /b %EXIT_CODE%
