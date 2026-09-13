@echo off
setlocal enabledelayedexpansion
REM Starts the sandbox node. Headless by default; pass --gui for the node's
REM own Swing window, or --reset to begin from an empty chain.
REM Windows counterpart of start.sh - keep them in sync.
REM
REM --reset lives here rather than in the console because the node holds its
REM database open while it runs: emptying the chain means stopping it first,
REM and no web page can do that.

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
set "RESET="
:parse
if "%~1"=="" goto parsed
if "%~1"=="--gui" set "MODE="
if "%~1"=="--reset" set "RESET=yes"
shift
goto parse
:parsed

REM Asked for, never volunteered: a prompt on every start would be answered
REM "keep it" almost every time, and a question you always answer the same way
REM stops being read.
if defined RESET (
  set /p "ANSWER=start: delete the chain in db\ and begin from empty? [y/N] "
  if /i "!ANSWER!"=="y" (
    rmdir /s /q db 2>nul
    echo start: chain deleted
  ) else (
    echo start: kept the existing chain
  )
)

echo start: http://localhost:6876/
java -jar signum-node.jar %MODE% -c ./conf/
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul
exit /b %EXIT_CODE%
