@echo off
setlocal enabledelayedexpansion
REM Last-resort chain reset: stop the node, drop its database, start it again.
REM The console tries popOff and fullReset first; this is what it names when
REM neither worked. Windows counterpart of reset.sh - keep them in sync.
REM
REM Finding "the java process running signum-node.jar" has no wmic-free,
REM one-line answer on Windows (wmic is deprecated/being removed), so this
REM asks PowerShell's CIM cmdlets - the supported replacement - for java.exe
REM processes whose command line mentions signum-node.jar, kills exactly
REM those by PID, and re-checks. If that doesn't leave things stopped within
REM ~20 seconds, this refuses to touch db\ rather than delete it out from
REM under a node that turned out to still be running.

set "ROOT=%~dp0.."
pushd "%ROOT%" >nul || exit /b 1

set "PS_FIND=Get-CimInstance Win32_Process -Filter \"Name='java.exe'\" | Where-Object { $_.CommandLine -like '*signum-node.jar*' } | Select-Object -ExpandProperty ProcessId"

set "NODE_PIDS="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "%PS_FIND%"`) do (
  set "NODE_PIDS=!NODE_PIDS! %%P"
)

if defined NODE_PIDS (
  echo reset: stopping the node
  for %%P in (!NODE_PIDS!) do (
    powershell -NoProfile -Command "Stop-Process -Id %%P -Force" >nul 2>&1
  )

  set "STOPPED="
  for /l %%I in (1,1,20) do (
    if not defined STOPPED (
      set "RUNNING="
      for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "%PS_FIND%"`) do set "RUNNING=1"
      if not defined RUNNING (
        set "STOPPED=1"
      ) else (
        timeout /t 1 /nobreak >nul
      )
    )
  )

  if not defined STOPPED (
    echo reset: the node would not stop - close it yourself ^(Ctrl+C in its window, or Task Manager^), then run this script again 1>&2
    popd >nul
    exit /b 1
  )
)

echo reset: removing db\
if exist db rmdir /s /q db

echo reset: starting the node
"%~dp0start.cmd"
