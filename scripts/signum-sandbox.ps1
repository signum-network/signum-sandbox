# The Signum Sandbox launcher, for Windows.
#
# The twin of scripts/signum-sandbox: the same commands, the same layout under
# ~\.signum-sandbox, the same jre.pinned, and the same function names, so the
# two can be read side by side. Where they differ it is because Windows does,
# and the comment says so. Change one, change the other.
#
# Windows PowerShell 5.1, strictly: it is the one PowerShell every Windows 10
# and 11 has, and so the only one that can be assumed. No ??, no ternary, no
# Join-Path with more than one child, -UseBasicParsing on every request.
#
# ASCII, strictly, comments included. 5.1 reads a script without a byte order
# mark as Windows-1252, so a single em dash would arrive as three characters of
# noise in whatever message it was part of. launcher.test.ps1 checks this.
#
# Not run directly but through signum-sandbox.cmd, because Windows refuses to
# run .ps1 files until somebody changes the execution policy, and asking for
# that first is how an installation stops being one line.
#
# As in the sh launcher, every decision takes its inputs as arguments and
# returns a string, which is what lets scripts/launcher.test.ps1 call them
# without mocking anything.
$ErrorActionPreference = 'Stop'
# Windows PowerShell draws a progress bar for every download, and drawing it
# makes a 50 MB download take minutes rather than seconds.
$ProgressPreference = 'SilentlyContinue'

# --- where everything lives -------------------------------------------------

# Join-Path in 5.1 takes one child; this takes any number.
function join_parts {
  $path = $args[0]
  for ($i = 1; $i -lt $args.Count; $i++) { $path = Join-Path $path $args[$i] }
  $path
}

$UserHome = [Environment]::GetFolderPath('UserProfile')
$HomeDir = if ($env:SIGNUM_SANDBOX_HOME) { $env:SIGNUM_SANDBOX_HOME } else { Join-Path $UserHome '.signum-sandbox' }
$AppDir = Join-Path $HomeDir 'app'
$JreDirBase = Join-Path $HomeDir 'jre'
$ConfDir = Join-Path $HomeDir 'conf'
$HtmlDir = Join-Path $HomeDir 'html'
# Ours, as opposed to the node's own node.log - see LOG_FILE in the sh launcher.
$LogFile = join_parts $HomeDir 'logs' 'stdout.log'
$NodeLog = Join-Path $HomeDir 'node.log'
$PidFile = join_parts $HomeDir 'run' 'node.pid'
$InstalledFile = Join-Path $HomeDir 'installed'
$PreviousFile = Join-Path $HomeDir 'previous'
# The directory that goes on PATH. It holds signum-sandbox.cmd and nothing
# else: PowerShell prefers a .ps1 to a .cmd of the same name in the same
# directory, and would then refuse to run it.
$BinDir = if ($env:SIGNUM_SANDBOX_BIN) { $env:SIGNUM_SANDBOX_BIN } else { Join-Path $HomeDir 'bin' }
# Where the .cmd finds this script: beside the bin directory, always, because
# the .cmd is a fixed file and can only say "..\launcher".
$LauncherDir = Join-Path (Split-Path -Parent $BinDir) 'launcher'

$Repo = 'signum-network/signum-sandbox'
$DefaultPort = 6876

function say([string]$message)  { [Console]::Out.WriteLine($message) }
function warn([string]$message) { [Console]::Error.WriteLine($message) }
function die([string]$message)  { warn $message; exit 1 }

# --- the pinned JRE ---------------------------------------------------------

# read_pinned <file> -> its NAME='value' lines as a table.
#
# jre.pinned is written for sh to source. Rather than keeping a second copy for
# Windows, it is read here as what it is: assignments of single-quoted strings,
# and comments.
function read_pinned([string]$file) {
  $pinned = @{}
  foreach ($line in [IO.File]::ReadAllLines($file)) {
    if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)='([^']*)'\s*$") {
      $pinned[$Matches[1]] = $Matches[2]
    }
  }
  $pinned
}

# Beside this script when it runs from a checkout or from a release being
# installed, and in the active release once installed. Unlike sh, PowerShell
# knows where its script is, so SIGNUM_SANDBOX_PINNED is only needed by a test
# that wants to point somewhere else.
function load_pinned {
  $installed = installed_version $InstalledFile
  $candidates = @($env:SIGNUM_SANDBOX_PINNED, (Join-Path $PSScriptRoot 'jre.pinned'))
  if ($installed) { $candidates += join_parts $AppDir $installed 'scripts' 'jre.pinned' }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return read_pinned $candidate
    }
  }

  # The cause, not the symptom - see load_pinned in the sh launcher.
  if (-not $installed) {
    warn "launcher: nothing is installed in $HomeDir"
    die  'launcher: run the installer, or set SIGNUM_SANDBOX_HOME to an installation that exists.'
  }
  warn 'launcher: cannot find jre.pinned, so it does not know which Java to use.'
  warn "launcher: $HomeDir says it has $installed installed, but looked in vain:"
  foreach ($candidate in $candidates) { if ($candidate) { warn "  $candidate" } }
  die  'launcher: that installation is incomplete - reinstall it.'
}

# --- decisions --------------------------------------------------------------

# processor_architecture -> what Windows calls this machine.
#
# A 32-bit PowerShell on 64-bit Windows is told x86, and finds the truth in
# PROCESSOR_ARCHITEW6432.
function processor_architecture {
  if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
}

# platform_id <processor architecture> -> windows_x64 | windows_aarch64
#
# Nothing for anything else, so the caller can say what it found.
function platform_id([string]$arch) {
  switch ($arch) {
    'AMD64' { return 'windows_x64' }
    'ARM64' { return 'windows_aarch64' }
    default { return '' }
  }
}

# jre_url <platform_id> -> the Adoptium download for the pinned version.
#
# For Windows the API serves a .zip where it serves a .tar.gz elsewhere; the
# address has the same shape.
function jre_url([string]$platform) {
  $encoded = $Pinned.JRE_VERSION -replace '\+', '%2B'
  switch ($platform) {
    'windows_x64'     { return "https://api.adoptium.net/v3/binary/version/jdk-$encoded/windows/x64/jre/hotspot/normal/eclipse" }
    'windows_aarch64' { return "https://api.adoptium.net/v3/binary/version/jdk-$encoded/windows/aarch64/jre/hotspot/normal/eclipse" }
    default           { return '' }
  }
}

# jre_sha <platform_id> -> the pinned checksum.
function jre_sha([string]$platform) {
  switch ($platform) {
    'windows_x64'     { return $Pinned.JRE_SHA_windows_x64 }
    'windows_aarch64' { return $Pinned.JRE_SHA_windows_aarch64 }
    default           { return '' }
  }
}

# java_binary <platform_id> <jre base dir> -> the java to run.
function java_binary([string]$platform, [string]$base) {
  if ($platform -like 'windows_*') { return join_parts $base $Pinned.JRE_DIR 'bin' 'java.exe' }
  return ''
}

# installed_version <path to the installed file> -> the active version, or ''.
function installed_version([string]$file) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return '' }
  [IO.File]::ReadAllText($file) -replace "[`r`n]", ''
}

# html_needs_copy <wanted version> <path to html\.version> -> yes | no
function html_needs_copy([string]$version, [string]$file) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return 'yes' }
  if ((installed_version $file) -eq $version) { 'no' } else { 'yes' }
}

# prune_list <app dir> <versions to keep> -> the releases to delete.
#
# Named, never derived from timestamps - see prune_list in the sh launcher for
# the release that taught us. Names beginning with a dot are skipped, as ls
# skips them: those are staging directories, not releases.
function prune_list([string]$dir, [string[]]$keep) {
  if (-not (Test-Path -LiteralPath $dir -PathType Container)) { return @() }
  @(Get-ChildItem -LiteralPath $dir -Name | Where-Object { -not $_.StartsWith('.') -and $keep -notcontains $_ })
}

# sha256_of <file> -> the hex sum, in lower case, as sha256sum writes it.
function sha256_of([string]$file) {
  (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
}

# reset_verdict <running: yes|no> <confirmed: yes|no> -> delete | refuse | cancelled
function reset_verdict([string]$running, [string]$confirmed) {
  if ($running -eq 'yes') { return 'refuse' }
  if ($confirmed -eq 'yes') { 'delete' } else { 'cancelled' }
}

# latest_tag <the releases/latest JSON> -> the version, or ''.
#
# PowerShell has a JSON parser, so unlike sh it uses one.
function latest_tag([string]$answer) {
  if (-not $answer) { return '' }
  try { $release = $answer | ConvertFrom-Json } catch { return '' }
  if (-not $release.tag_name) { return '' }
  "$($release.tag_name)" -replace '^v', ''
}

# release_url <version> -> where that release's zip lives.
function release_url([string]$version) {
  "https://github.com/$Repo/releases/download/v$version/signum-sandbox-$version.zip"
}

# port_in <node.properties> -> the port to talk to.
#
# The node_port of the sh launcher, with the file as an argument so the test
# can hand it one.
function port_in([string]$file) {
  if (Test-Path -LiteralPath $file -PathType Leaf) {
    foreach ($line in [IO.File]::ReadAllLines($file)) {
      if ($line -match '^\s*API\.Port\s*=\s*([0-9]+)') { return $Matches[1] }
    }
  }
  "$DefaultPort"
}

function node_port { port_in (Join-Path $ConfDir 'node.properties') }

# path_has <PATH value> <directory> -> yes | no
#
# Compared the way Windows compares paths: without regard to case, and with or
# without a trailing backslash.
function path_has([string]$pathValue, [string]$dir) {
  $wanted = $dir.TrimEnd('\')
  foreach ($entry in ($pathValue -split ';')) {
    if ($entry.TrimEnd('\') -eq $wanted) { return 'yes' }
  }
  'no'
}

# same_process <recorded start> <actual start> -> yes | no
#
# The pidfile carries the process's start time beside its id, because Windows
# hands process ids out again within minutes. A pidfile left by a reboot would
# otherwise make some unrelated program "the node" - and stop would send that
# program a Ctrl-C.
function same_process([string]$recorded, [string]$actual) {
  if ($recorded -and $recorded -eq $actual) { 'yes' } else { 'no' }
}

# --- effects ----------------------------------------------------------------

function ensure_dir([string]$dir) {
  if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
}

function remove_tree([string]$path) {
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Recurse -Force }
}

# Plain text and a plain newline, no byte order mark - what the sh launcher
# writes, and what Set-Content in 5.1 does not.
function write_line([string]$file, [string]$text) {
  [IO.File]::WriteAllText($file, "$text`n")
}

# expand_zip <zip> <destination>
#
# ZipFile rather than Expand-Archive, which in 5.1 takes minutes over the 60 MB
# a release weighs.
function expand_zip([string]$zip, [string]$destination) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $destination)
}

# fetch <url> <destination>
#
# Three tries, as curl --retry 2 gives the sh launcher. TLS 1.2 is asked for
# explicitly because Windows PowerShell does not offer it by default, and
# GitHub accepts nothing less.
function fetch([string]$url, [string]$destination) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $destination
      return
    } catch {
      if ($attempt -eq 3) { die "launcher: could not download $url" }
    }
  }
}

# fetch_text <url> -> the body, or '' when there is none.
#
# Through a file, because 5.1 hands back bytes rather than text for anything
# not served as text - and GitHub serves a .sha256 as octet-stream.
function fetch_text([string]$url, [int]$timeout) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $file = [IO.Path]::GetTempFileName()
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $file -TimeoutSec $timeout
    [IO.File]::ReadAllText($file)
  } catch {
    ''
  } finally {
    Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
  }
}

# verify <file> <expected sum> <what it is, for the message>
function verify([string]$file, [string]$expected, [string]$what) {
  $actual = sha256_of $file
  if ($actual -eq $expected) { return }
  warn "launcher: $what does not match its checksum."
  warn "  expected $expected"
  warn "  got      $actual"
  die  'launcher: refusing to install it'
}

# ensure_jre <platform_id> - see ensure_jre in the sh launcher.
function ensure_jre([string]$platform) {
  if ($env:SIGNUM_SANDBOX_JAVA) {
    if (-not (Test-Path -LiteralPath $env:SIGNUM_SANDBOX_JAVA -PathType Leaf)) {
      die "launcher: SIGNUM_SANDBOX_JAVA is not a file: $env:SIGNUM_SANDBOX_JAVA"
    }
    say "launcher: using the Java you pointed at: $env:SIGNUM_SANDBOX_JAVA"
    return
  }

  $java = java_binary $platform $JreDirBase
  if (Test-Path -LiteralPath $java -PathType Leaf) { return }

  say "launcher: fetching Java $($Pinned.JRE_VERSION) (about 45 MB, once)"
  ensure_dir $JreDirBase
  $archive = Join-Path $JreDirBase '.download.zip'
  fetch (jre_url $platform) $archive
  verify $archive (jre_sha $platform) 'the Java download'
  # A half-unpacked JRE from an earlier attempt would make the unpacking fail:
  # ZipFile refuses to overwrite.
  remove_tree (Join-Path $JreDirBase $Pinned.JRE_DIR)
  expand_zip $archive $JreDirBase
  Remove-Item -LiteralPath $archive -Force
  if (-not (Test-Path -LiteralPath $java -PathType Leaf)) { die "launcher: the Java archive did not contain $java" }
}

# --- running the node -------------------------------------------------------

function active_app {
  $version = installed_version $InstalledFile
  if (-not $version) { die 'launcher: nothing is installed yet - run the installer' }
  $dir = Join-Path $AppDir $version
  if (-not (Test-Path -LiteralPath $dir -PathType Container)) { die "launcher: $InstalledFile names $version but $dir is missing" }
  $dir
}

# start_time <process> -> when it started, as a string that survives a file.
function start_time($process) {
  try { "$($process.StartTime.ToFileTimeUtc())" } catch { '' }
}

# running_pid -> the id of the background node, or ''.
#
# The is_running of the sh launcher, answering with the id because on Windows
# reading it back means checking it too. A pidfile that names no live process,
# or a different one, is removed rather than reported.
function running_pid {
  if (-not (Test-Path -LiteralPath $PidFile -PathType Leaf)) { return '' }
  $lines = @([IO.File]::ReadAllLines($PidFile))
  $id = if ($lines.Count -gt 0) { $lines[0] } else { '' }
  $recorded = if ($lines.Count -gt 1) { $lines[1] } else { '' }
  if ($id -match '^[0-9]+$') {
    $process = Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue
    if ($process -and (same_process $recorded (start_time $process)) -eq 'yes') { return $id }
  }
  Remove-Item -LiteralPath $PidFile -Force
  ''
}

function is_running { [bool](running_pid) }

# prepare_layout <app dir> <version> - see prepare_layout in the sh launcher.
function prepare_layout([string]$app, [string]$version) {
  ensure_dir $ConfDir
  ensure_dir (Join-Path $HomeDir 'db')
  ensure_dir (Join-Path $HomeDir 'logs')
  ensure_dir (Join-Path $HomeDir 'run')

  Copy-Item -LiteralPath (join_parts $app 'conf' 'node-default.properties') -Destination $ConfDir -Force
  Copy-Item -LiteralPath (join_parts $app 'conf' 'logging-default.properties') -Destination $ConfDir -Force
  $ours = Join-Path $ConfDir 'node.properties'
  if (-not (Test-Path -LiteralPath $ours)) {
    Copy-Item -LiteralPath (join_parts $app 'conf' 'node.properties') -Destination $ours
  }

  if ((html_needs_copy $version (Join-Path $HtmlDir '.version')) -eq 'yes') {
    remove_tree $HtmlDir
    Copy-Item -LiteralPath (Join-Path $app 'html') -Destination $HtmlDir -Recurse
    write_line (Join-Path $HtmlDir '.version') $version
  }
}

# start_verdict <alive: yes|no> <answering: yes|no> <seconds waited> <limit>
#   -> ready | died | timeout | waiting - see start_verdict in the sh launcher.
function start_verdict([string]$alive, [string]$answering, [int]$waited, [int]$limit) {
  if ($answering -eq 'yes') { return 'ready' }
  if ($alive -eq 'no') { return 'died' }
  if ($waited -ge $limit) { 'timeout' } else { 'waiting' }
}

# answering <port> -> true when a node answers its API there.
function answering([string]$port) {
  [bool](fetch_text "http://localhost:$port/api?requestType=getBlockchainStatus" 2)
}

$StartTimeout = 90

# count_lines <file> -> how many lines it has, 0 when there is none.
function count_lines([string]$file) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return 0 }
  @([IO.File]::ReadAllLines($file)).Count
}

# wait_until_ready <process> <port> <lines the log had before> - see
# wait_until_ready in the sh launcher. The process is cmd, holding the node's
# console; it exits when the node does, and HasExited says so without the
# pid having to be looked up again.
function wait_until_ready($process, [string]$port, [int]$logLines) {
  [Console]::Out.Write('launcher: starting the sandbox ')
  $waited = 0
  while ($true) {
    $up = if (answering $port) { 'yes' } else { 'no' }
    $alive = if ($process.HasExited) { 'no' } else { 'yes' }
    switch (start_verdict $alive $up $waited $StartTimeout) {
      'ready' {
        say ' ok'
        say ''
        say "Sandbox started successfully - open http://localhost:$port/"
        say ''
        say '  signum-sandbox logs   to watch it'
        say '  signum-sandbox stop   to end it'
        return
      }
      'died' {
        say ''
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        warn 'launcher: the node stopped before it answered. It said:'
        # Only what this start wrote, as in the sh launcher.
        if (Test-Path -LiteralPath $LogFile -PathType Leaf) {
          $lines = @([IO.File]::ReadAllLines($LogFile) | Select-Object -Skip $logLines | Select-Object -Last 20)
          foreach ($line in $lines) { warn $line }
        }
        exit 1
      }
      'timeout' {
        say ''
        warn "launcher: the node is running but has not answered on port $port after ${StartTimeout}s."
        warn 'launcher: it may still be starting. "signum-sandbox status" asks again,'
        warn 'launcher: "signum-sandbox logs" shows what it is doing, "signum-sandbox stop" gives up.'
        exit 1
      }
    }
    [Console]::Out.Write('.')
    Start-Sleep -Seconds 1
    $waited++
  }
}

function cmd_start([string[]]$options) {
  $foreground = $false
  foreach ($option in $options) {
    if ($option -eq '--foreground') { $foreground = $true }
    # How the background was asked for while it was not the default. Still
    # accepted, so whatever was written against 0.2.0 keeps working.
    elseif ($option -eq '--daemon') { }
    else { die "start: unknown option $option" }
  }

  $platform = platform_id (processor_architecture)
  if (-not $platform) { die "launcher: unsupported platform: Windows $(processor_architecture)" }
  $app = active_app
  $version = installed_version $InstalledFile

  $id = running_pid
  if ($id) { die "launcher: already running (pid $id) - stop it first" }

  ensure_jre $platform
  prepare_layout $app $version

  $java = if ($env:SIGNUM_SANDBOX_JAVA) { $env:SIGNUM_SANDBOX_JAVA } else { java_binary $platform $JreDirBase }
  $jar = Join-Path $app 'signum-node.jar'
  $port = node_port

  # A node this launcher did not start - see cmd_start in the sh launcher.
  if (answering $port) {
    die "launcher: a node already answers on port $port - one in the foreground, in another terminal?"
  }

  Set-Location -LiteralPath $HomeDir
  if ($foreground) {
    say "launcher: http://localhost:$port/  (Ctrl-C to stop)"
    & $java -jar $jar --headless -c ./conf/
    exit $LASTEXITCODE
  }

  $logLines = count_lines $LogFile
  # Windows has no nohup. What it has is a console of the node's own, hidden,
  # with cmd in it to send the output where the sh launcher sends it. The
  # console is the point: it is what stop sends the Ctrl-C into.
  #
  # The quoting is cmd's: /c strips the outermost pair of quotes, so the whole
  # line is wrapped in one more pair than it needs.
  $line = '/d /c ""{0}" -jar "{1}" --headless -c ./conf/ >> "{2}" 2>&1"' -f $java, $jar, $LogFile
  $shell = if ($env:ComSpec) { $env:ComSpec } else { 'cmd.exe' }
  $process = Start-Process -FilePath $shell -ArgumentList $line -WorkingDirectory $HomeDir -WindowStyle Hidden -PassThru
  [IO.File]::WriteAllLines($PidFile, [string[]]@($process.Id, (start_time $process)))
  wait_until_ready $process $port $logLines
}

# What Windows has instead of SIGTERM. Stop-Process is TerminateProcess, which
# gives the node no chance to close its database. So the node gets the Ctrl-C a
# person would have typed into its console, which the JVM answers as it answers
# SIGTERM: by running its shutdown hooks.
#
# Sending one means attaching to that console, and a process belongs to one
# console at a time. So it is done by a short-lived PowerShell in a hidden
# console of its own, which leaves the one you are reading alone. It ignores
# the Ctrl-C itself, since it sends it to everyone on the console it joined.
$CtrlCScript = @'
Add-Type -Namespace SignumSandbox -Name Console -MemberDefinition '
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
  [DllImport("kernel32.dll")] public static extern bool AttachConsole(uint id);
  [DllImport("kernel32.dll")] public static extern bool SetConsoleCtrlHandler(System.IntPtr handler, bool add);
  [DllImport("kernel32.dll")] public static extern bool GenerateConsoleCtrlEvent(uint ctrlEvent, uint group);
'
[SignumSandbox.Console]::FreeConsole() | Out-Null
if (-not [SignumSandbox.Console]::AttachConsole(__TARGET__)) { exit 2 }
[SignumSandbox.Console]::SetConsoleCtrlHandler([IntPtr]::Zero, $true) | Out-Null
if (-not [SignumSandbox.Console]::GenerateConsoleCtrlEvent(0, 0)) { exit 3 }
exit 0
'@

# send_ctrl_c <pid> -> true when the Ctrl-C was delivered.
function send_ctrl_c([string]$id) {
  $script = $CtrlCScript -replace '__TARGET__', $id
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
  $powershell = (Get-Process -Id $PID).Path
  $helper = Start-Process -FilePath $powershell `
    -ArgumentList "-NoProfile -NonInteractive -EncodedCommand $encoded" `
    -WindowStyle Hidden -Wait -PassThru
  $helper.ExitCode -eq 0
}

function cmd_stop {
  $id = running_pid
  if (-not $id) {
    say 'launcher: not running'
    return
  }
  if (-not (send_ctrl_c $id)) {
    warn "launcher: could not reach the console of pid $id to stop it."
    warn 'launcher: leaving it alone rather than killing it - end it in the Task Manager if you must.'
    exit 1
  }
  # "stopped" must not be printed over a process that is still writing its
  # database. cmd exits when the node does, so waiting for cmd is enough.
  Wait-Process -Id ([int]$id) -Timeout 10 -ErrorAction SilentlyContinue
  if (Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue) {
    warn "launcher: pid $id has not stopped after ten seconds."
    warn 'launcher: leaving it alone rather than forcing it - an interrupted'
    warn 'launcher: database write is worse than a process that lingers.'
    exit 1
  }
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  say 'launcher: stopped'
}

function cmd_status {
  $version = installed_version $InstalledFile
  if (-not $version) { say 'launcher: nothing installed'; return }
  say "version: $version"

  $port = node_port
  $id = running_pid
  if ($id) {
    say "process: running in the background (pid $id)"
  } else {
    say 'process: no background node (one may be running in the foreground)'
  }

  $answer = fetch_text "http://localhost:$port/api?requestType=getBlockchainStatus" 3
  if ($answer) {
    $height = 'unknown'
    try { $height = ($answer | ConvertFrom-Json).numberOfBlocks } catch { }
    say "node:    answering on port $port, height $height"
  } else {
    say "node:    nothing answering on port $port"
  }
}

function cmd_logs {
  if (Test-Path -LiteralPath $NodeLog -PathType Leaf) {
    if (Test-Path -LiteralPath $LogFile -PathType Leaf) { say "launcher: startup output, if you need it: $LogFile" }
    Get-Content -LiteralPath $NodeLog -Tail 10 -Wait
  } elseif (Test-Path -LiteralPath $LogFile -PathType Leaf) {
    warn 'launcher: the node kept no log of its own - it may not have got that far.'
    Get-Content -LiteralPath $LogFile -Tail 10 -Wait
  } else {
    die 'launcher: no log yet - has it ever started?'
  }
}

function cmd_reset {
  $running = if (is_running) { 'yes' } else { 'no' }

  $confirmed = 'no'
  if ($running -eq 'no') {
    # The console's own stdin rather than Read-Host, so an answer piped in is
    # read the same way as one typed.
    [Console]::Out.Write("launcher: delete the chain in $HomeDir\db and start from empty? [y/N] ")
    $answer = [Console]::In.ReadLine()
    if ($answer -match '^(y|yes)$') { $confirmed = 'yes' }
  }

  switch (reset_verdict $running $confirmed) {
    'refuse'    { die 'launcher: the node is running and holds the chain open. Run "signum-sandbox stop" first.' }
    'delete'    { remove_tree (Join-Path $HomeDir 'db'); say 'launcher: chain deleted' }
    'cancelled' { say 'launcher: kept the existing chain' }
  }
}

# --- moving between releases ------------------------------------------------

# place_launcher <release dir>
#
# The launcher ships with the release, so an update updates it too. Through a
# temporary name, so an interrupted copy never leaves half a launcher behind.
# Replacing this script while it runs is harmless - PowerShell reads a script
# whole before running any of it.
#
# The .cmd is another matter: cmd reads a batch file as it goes, by offset, and
# the .cmd is what is running right now. So it is only replaced when it has
# actually changed, which it is written never to need.
function place_launcher([string]$release) {
  $script = join_parts $release 'scripts' 'signum-sandbox.ps1'
  $shim = join_parts $release 'scripts' 'signum-sandbox.cmd'
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { return }

  ensure_dir $LauncherDir
  $placed = Join-Path $LauncherDir 'signum-sandbox.ps1'
  Copy-Item -LiteralPath $script -Destination "$placed.new" -Force
  Move-Item -LiteralPath "$placed.new" -Destination $placed -Force

  ensure_dir $BinDir
  $placedShim = Join-Path $BinDir 'signum-sandbox.cmd'
  if (-not (Test-Path -LiteralPath $placedShim) -or (sha256_of $shim) -ne (sha256_of $placedShim)) {
    Copy-Item -LiteralPath $shim -Destination "$placedShim.new" -Force
    Move-Item -LiteralPath "$placedShim.new" -Destination $placedShim -Force
  }
}

# install_release <version> <zip> - see install_release in the sh launcher.
function install_release([string]$version, [string]$zip) {
  ensure_dir $AppDir
  $staging = Join-Path $AppDir ".staging-$version"
  $target = Join-Path $AppDir $version
  remove_tree $staging
  remove_tree $target
  expand_zip $zip $staging
  $unpacked = Join-Path $staging "signum-sandbox-$version"
  if (-not (Test-Path -LiteralPath $unpacked -PathType Container)) {
    die "launcher: the archive does not contain signum-sandbox-$version"
  }
  Move-Item -LiteralPath $unpacked -Destination $target
  remove_tree $staging

  place_launcher $target

  $previous = installed_version $InstalledFile
  if ($previous) { write_line $PreviousFile $previous }
  write_line $InstalledFile $version

  foreach ($stale in (prune_list $AppDir @($version, $previous))) {
    remove_tree (Join-Path $AppDir $stale)
    say "launcher: removed the old release $stale"
  }
}

function cmd_update {
  $wanted = latest_tag (fetch_text "https://api.github.com/repos/$Repo/releases/latest" 20)
  if (-not $wanted) {
    die "launcher: could not find out what the newest release is. Is $Repo public, and has it been released?"
  }

  $current = installed_version $InstalledFile
  if ($wanted -eq $current) {
    say "launcher: $current is already the newest release"
    return
  }

  if (is_running) { die 'launcher: stop the node before updating' }

  $from = if ($current) { $current } else { 'nothing' }
  say "launcher: updating $from to $wanted"
  $tmp = join_parts ([IO.Path]::GetTempPath()) "signum-sandbox-$([Guid]::NewGuid())"
  ensure_dir $tmp
  try {
    $zip = Join-Path $tmp 'release.zip'
    fetch (release_url $wanted) $zip
    $sum = ((fetch_text "$(release_url $wanted).sha256" 20) -split '\s+')[0]
    if ($sum) {
      verify $zip $sum "the $wanted release"
    } else {
      warn "launcher: $wanted publishes no .sha256 beside it - installing unverified"
    }
    install_release $wanted $zip
  } finally {
    remove_tree $tmp
  }
  say "launcher: now on $wanted"
}

# put_on_path
#
# What the sh launcher only says, this one does, because on Windows there is
# no startup file to point anyone at - only a dialog four clicks deep. It is
# still said, never done silently.
#
# Through the registry rather than [Environment]::SetEnvironmentVariable,
# which would expand every %VARIABLE% in the user's PATH and write it back
# expanded for good. Then the announcement Windows expects, so that terminals
# opened from now on see the change without a logout.
function put_on_path {
  $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
  try {
    $current = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    if ((path_has $current $BinDir) -eq 'yes') { return $false }
    $updated = if ($current) { "$($current.TrimEnd(';'));$BinDir" } else { $BinDir }
    $key.SetValue('Path', $updated, [Microsoft.Win32.RegistryValueKind]::ExpandString)
  } finally {
    $key.Close()
  }

  Add-Type -Namespace SignumSandbox -Name Broadcast -MemberDefinition '
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint msg, System.UIntPtr wParam,
      string lParam, uint flags, uint timeout, out System.UIntPtr result);
  '
  $result = [UIntPtr]::Zero
  # HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG
  [SignumSandbox.Broadcast]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result) | Out-Null
  $true
}

# cmd_bootstrap <version> <zip> - what install.ps1 calls once it has a release
# on disk. Installing is an update from nothing.
function cmd_bootstrap([string]$version, [string]$zip) {
  if (-not $version) { die 'bootstrap: no version given' }
  if (-not $zip -or -not (Test-Path -LiteralPath $zip -PathType Leaf)) { die 'bootstrap: no release archive given' }
  ensure_dir $HomeDir
  install_release $version $zip

  $platform = platform_id (processor_architecture)
  if (-not $platform) { die "launcher: unsupported platform: Windows $(processor_architecture)" }
  ensure_jre $platform
  prepare_layout (Join-Path $AppDir $version) $version

  say ''
  say "signum-sandbox $version is installed."
  if (put_on_path) { say "Added $BinDir to your PATH, for every terminal from now on." }
  say 'Start it with:  signum-sandbox'
}

function cmd_rollback {
  $previous = installed_version $PreviousFile
  if (-not $previous) { die 'launcher: no previous release recorded' }
  if (-not (Test-Path -LiteralPath (Join-Path $AppDir $previous) -PathType Container)) {
    die "launcher: $previous was recorded but $(Join-Path $AppDir $previous) is gone"
  }
  if (is_running) { die 'launcher: stop the node before rolling back' }

  $current = installed_version $InstalledFile
  if ($current) { write_line $PreviousFile $current }
  write_line $InstalledFile $previous

  # Going back to a release means going back to its launcher too.
  place_launcher (Join-Path $AppDir $previous)
  say "launcher: back on $previous"
}

function cmd_help {
  say @'
signum-sandbox - a throwaway Signum chain on your own machine

  signum-sandbox                      start it in the background, and say
                                      when it answers
  signum-sandbox start --foreground   start it here, until Ctrl-C
  signum-sandbox stop                 stop it
  signum-sandbox status               version, process, and what the node says
  signum-sandbox logs                 follow the node's log
  signum-sandbox update               move to the newest release
  signum-sandbox rollback             move back to the previous one
  signum-sandbox reset                delete the chain and start from empty

A background node does not survive a logout or a reboot, on purpose: a
sandbox should not keep running unnoticed.

  SIGNUM_SANDBOX_JAVA   use this java.exe instead of the private one
'@
}

# --- entry point ------------------------------------------------------------

$Pinned = load_pinned

function main([string[]]$arguments) {
  $command = if ($arguments.Count -gt 0) { $arguments[0] } else { 'start' }
  $rest = if ($arguments.Count -gt 1) { [string[]]$arguments[1..($arguments.Count - 1)] } else { [string[]]@() }
  switch ($command) {
    'start'       { cmd_start $rest }
    'stop'        { cmd_stop }
    'status'      { cmd_status }
    'logs'        { cmd_logs }
    'reset'       { cmd_reset }
    'update'      { cmd_update }
    'rollback'    { cmd_rollback }
    { $_ -in '-h', '--help', 'help' } { cmd_help }
    # Called by install.ps1, not by a person. Deliberately absent from --help.
    '__bootstrap' { cmd_bootstrap $rest[0] $rest[1] }
    default       { die "launcher: unknown command $command (try --help)" }
  }
}

# Dot-sourced by the test script, which wants the functions and not the program.
if ($env:LAUNCHER_LIB_ONLY -ne '1') {
  main ([string[]]$args)
}
