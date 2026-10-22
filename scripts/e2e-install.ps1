# Proves that a release can be installed on Windows, not merely built - the
# twin of e2e-install.sh.
#
#   powershell -File scripts\e2e-install.ps1 build\signum-sandbox-0.0.1.zip
#
# Run by .github/workflows on a windows-latest runner, under Windows
# PowerShell 5.1 - the one every user has. There is no container to make the
# machine bare, and the runner has a Java of its own on PATH, so the assertion
# that matters most is the one e2e-install.sh can only make by being empty:
# that the JVM running is the private one.
#
# This installs into the real home directory of whoever runs it, and puts a
# directory on their PATH. On a runner that is the point; on your own machine,
# it is an installation.
param([Parameter(Mandatory = $true)][string]$Archive)
$ErrorActionPreference = 'Stop'

$script:fails = 0
function say([string]$message) { [Console]::Out.WriteLine($message) }
function check([string]$label, [string]$expected, [string]$actual) {
  if ($expected -eq $actual) {
    say "ok   $label"
  } else {
    say "FAIL $label`n       expected: $expected`n       actual:   $actual"
    $script:fails++
  }
}
function yesno([bool]$value) { if ($value) { 'yes' } else { 'no' } }

function http_status([string]$url) {
  try { "$((Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10).StatusCode)" } catch { 'nothing' }
}

function wait_for_node([string]$port) {
  for ($waited = 0; $waited -lt 90; $waited++) {
    if ((http_status "http://localhost:$port/api?requestType=getBlockchainStatus") -eq '200') { return 'yes' }
    Start-Sleep -Seconds 1
  }
  "nothing after ${waited}s"
}

# --- install it -------------------------------------------------------------
$Archive = (Resolve-Path -LiteralPath $Archive).Path
$version = [IO.Path]::GetFileNameWithoutExtension($Archive) -replace '^signum-sandbox-', ''
if (-not $version) { throw 'e2e: cannot read a version out of that filename' }
say "e2e: installing $version"

# Exactly the two steps install.ps1 takes once it has downloaded: unpack, then
# hand the archive to the launcher inside it, in a PowerShell of its own.
$unpacked = Join-Path ([IO.Path]::GetTempPath()) "e2e-release-$([Guid]::NewGuid())"
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($Archive, $unpacked)
$launcher = Join-Path $unpacked "signum-sandbox-$version\scripts\signum-sandbox.ps1"
if (-not (Test-Path -LiteralPath $launcher)) { throw 'e2e: this archive contains no Windows launcher' }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher __bootstrap $version $Archive
check 'the installer finishes' '0' "$LASTEXITCODE"

$HomeDir = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.signum-sandbox'
$Bin = Join-Path $HomeDir 'bin\signum-sandbox.cmd'
$installed = ''
if (Test-Path -LiteralPath (Join-Path $HomeDir 'installed')) {
  $installed = ([IO.File]::ReadAllText((Join-Path $HomeDir 'installed'))).Trim()
}

say ''
check 'the installation records the version' $version $installed
check 'the command was placed' 'yes' (yesno (Test-Path -LiteralPath $Bin))
check 'the launcher was placed beside it' 'yes' (yesno (Test-Path -LiteralPath (Join-Path $HomeDir 'launcher\signum-sandbox.ps1')))
$userPath = [string](Get-Item 'HKCU:\Environment').GetValue('Path', '', 'DoNotExpandEnvironmentNames')
check 'its directory is on the user PATH' 'yes' (yesno (($userPath -split ';') -contains (Join-Path $HomeDir 'bin')))
if (-not $installed) { throw 'e2e: nothing more can be asserted without an installed version' }

# Read out of the release rather than repeated here, as e2e-install.sh does.
$jreDir = ''
foreach ($line in [IO.File]::ReadAllLines((Join-Path $HomeDir "app\$version\scripts\jre.pinned"))) {
  if ($line -match "^JRE_DIR='([^']*)'") { $jreDir = $Matches[1] }
}
$Java = Join-Path $HomeDir "jre\$jreDir\bin\java.exe"
check 'the private jre is unpacked' 'yes' (yesno (Test-Path -LiteralPath $Java))

# --- use it -----------------------------------------------------------------
# From here on the launcher's refusals are expected, and Windows PowerShell
# turns a native command's redirected stderr into errors - which 'Stop' would
# make fatal at the first refusal this test sets out to provoke.
$ErrorActionPreference = 'Continue'
try {
  & $Bin --help | Out-Null
  check 'help answers' '0' "$LASTEXITCODE"

  & $Bin start --daemon
  check 'starting in the background succeeds' '0' "$LASTEXITCODE"
  $PidFile = Join-Path $HomeDir 'run\node.pid'
  check 'and leaves a pidfile' 'yes' (yesno (Test-Path -LiteralPath $PidFile))

  $port = '6876'
  check 'the node answers' 'yes' (wait_for_node $port)
  check 'the sandbox ui answers' '200' (http_status "http://localhost:$port/")
  check 'the api documentation answers' '200' (http_status "http://localhost:$port/api-doc/")

  # The process in the pidfile is cmd, holding the node's console; the JVM is
  # its child. The runner has a Java of its own, so this can actually fail.
  $shellPid = [int]([IO.File]::ReadAllLines($PidFile)[0])
  $jvm = Get-CimInstance Win32_Process -Filter "ParentProcessId = $shellPid" | Where-Object { $_.Name -eq 'java.exe' }
  $jvmPath = if ($jvm) { $jvm.ExecutablePath } else { 'no java under the pidfile process' }
  check 'the running jvm is the private one' $Java $jvmPath

  $status = (& $Bin status) -join "`n"
  check 'status names the installed version' 'yes' (yesno ($status -match "version: $([regex]::Escape($version))"))
  check 'status sees the background process' 'yes' (yesno ($status -match 'process: running'))
  check 'status asks the node rather than the pidfile' 'yes' (yesno ($status -match 'answering on port'))

  check 'the chain exists before we try to delete it' 'yes' (yesno (Test-Path -LiteralPath (Join-Path $HomeDir 'db')))
  & $Bin reset 2>$null | Out-Null
  check 'reset refuses while the node holds the chain' 'yes' (yesno ($LASTEXITCODE -ne 0))
  check 'and the chain is still there' 'yes' (yesno (Test-Path -LiteralPath (Join-Path $HomeDir 'db')))

  & $Bin stop
  check 'stopping succeeds' '0' "$LASTEXITCODE"
  check 'stopping removes the pidfile' 'gone' $(if (Test-Path -LiteralPath $PidFile) { 'still there' } else { 'gone' })
  check 'and the node is gone' 'gone' $(if ($jvm -and (Get-Process -Id $jvm.ProcessId -ErrorAction SilentlyContinue)) { 'alive' } else { 'gone' })
  # stop never forces, so a node that is gone was stopped by its Ctrl-C - the
  # way that lets it close its database. Its log says whether it got to.
  check 'the port is free again' 'nothing' (http_status "http://localhost:$port/api?requestType=getBlockchainStatus")

  'y' | & $Bin reset | Out-Null
  check 'reset deletes the chain once nothing holds it' 'gone' `
    $(if (Test-Path -LiteralPath (Join-Path $HomeDir 'db')) { 'still there' } else { 'gone' })
} finally {
  & $Bin stop 2>$null | Out-Null
  Remove-Item -LiteralPath $unpacked -Recurse -Force -ErrorAction SilentlyContinue
}

say ''
if ($script:fails -eq 0) {
  say "e2e: signum-sandbox $version installs, starts, answers, stops and resets on Windows"
} else {
  say "e2e: $($script:fails) check(s) failed"
  if (Test-Path -LiteralPath (Join-Path $HomeDir 'logs\stdout.log')) {
    say '--- logs\stdout.log'
    Get-Content -LiteralPath (Join-Path $HomeDir 'logs\stdout.log') -Tail 40
  }
  exit 1
}
