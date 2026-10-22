@echo off
rem The command on PATH. It hands everything to the PowerShell launcher, with
rem the execution policy set aside for this one run: Windows refuses to run
rem .ps1 files by default, and asking somebody to change that first is how an
rem installation stops being one line.
rem
rem cmd reads a batch file while it runs it, so this one is kept to the line
rem below, and the launcher replaces it only when its content changes.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\launcher\signum-sandbox.ps1" %*
