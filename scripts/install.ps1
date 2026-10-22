# The Signum Sandbox installer, for Windows.
#
#   irm https://github.com/signum-network/signum-sandbox/releases/latest/download/install.ps1 | iex
#
# The twin of install.sh, and as deliberately dumb: it finds out what the
# newest release is, downloads it, and hands over to the launcher inside it.
#
# Run through iex, this runs inside the reader's own PowerShell session. So
# everything happens inside one script block, whose variables and preferences
# stay in there rather than being left behind in a window somebody goes on
# using - and nothing here calls exit, which would close that window. A
# failure throws instead.
#
# ASCII only, for the reason given at the top of signum-sandbox.ps1.
$SignumSandboxInstaller = {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  $Repo = 'signum-network/signum-sandbox'

  function say([string]$message) { [Console]::Out.WriteLine($message) }

  # install_sha256 <file> -> the hex sum, in lower case.
  function install_sha256([string]$file) {
    (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  }

  # sum_verdict <file> <published sum> -> ok | mismatch | absent
  #
  # Absent is its own answer rather than a pass - see install.sh.
  function sum_verdict([string]$file, [string]$published) {
    if (-not $published) { return 'absent' }
    if ((install_sha256 $file) -eq $published.ToLowerInvariant()) { 'ok' } else { 'mismatch' }
  }

  # Dot-sourced by scripts/launcher.test.ps1 with INSTALL_LIB_ONLY=1 to reach
  # the functions above. Nothing below this line may run then.
  if ($env:INSTALL_LIB_ONLY -eq '1') { return }

  if ($PSVersionTable.PSEdition -eq 'Core' -and -not $IsWindows) {
    throw 'install: this is the Windows installer - on macOS and Linux, use install.sh'
  }
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  say 'install: asking which release is newest'
  $version = ''
  try {
    $release = Invoke-RestMethod -UseBasicParsing -TimeoutSec 20 -Uri "https://api.github.com/repos/$Repo/releases/latest"
    $version = "$($release.tag_name)" -replace '^v', ''
  } catch { }
  if (-not $version) { throw "install: could not find a release of $Repo" }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) "signum-sandbox-$([Guid]::NewGuid())"
  New-Item -ItemType Directory -Path $tmp | Out-Null
  # Removed even when something fails, as in install.sh.
  try {
    $zipUrl = "https://github.com/$Repo/releases/download/v$version/signum-sandbox-$version.zip"
    $zip = Join-Path $tmp 'release.zip'
    say "install: downloading $version"
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zip
    } catch {
      throw "install: could not download $zipUrl"
    }

    # Through a file: Windows PowerShell hands back bytes rather than text for
    # a body served as octet-stream, which is how GitHub serves a .sha256.
    $published = ''
    try {
      Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri "$zipUrl.sha256" -OutFile "$zip.sha256"
      $published = ([IO.File]::ReadAllText("$zip.sha256") -split '\s+')[0]
    } catch { }
    switch (sum_verdict $zip $published) {
      'ok'       { say 'install: checksum verified' }
      'mismatch' { throw "install: $zipUrl does not match its published checksum - not installing it" }
      'absent'   { [Console]::Error.WriteLine("install: $version publishes no .sha256 beside it - installing unverified") }
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, (Join-Path $tmp 'x'))
    $launcher = Join-Path $tmp "x\signum-sandbox-$version\scripts\signum-sandbox.ps1"
    if (-not (Test-Path -LiteralPath $launcher)) {
      throw "install: $version contains no Windows launcher - it predates Windows support"
    }

    # In a PowerShell of its own, not with &: the launcher ends with exit,
    # which here would close the reader's window, and running a .ps1 file -
    # unlike piping text into iex - is subject to the execution policy.
    $powershell = (Get-Process -Id $PID).Path
    & $powershell -NoProfile -ExecutionPolicy Bypass -File $launcher __bootstrap $version $zip
    if ($LASTEXITCODE -ne 0) { throw 'install: the launcher could not finish the installation' }

    # The launcher put its directory on the user's PATH for every terminal
    # opened from now on. This one was opened before, so it is told here -
    # which is what lets the next line the reader types be signum-sandbox.
    $bin = if ($env:SIGNUM_SANDBOX_BIN) { $env:SIGNUM_SANDBOX_BIN } else {
      Join-Path ([Environment]::GetFolderPath('UserProfile')) '.signum-sandbox\bin'
    }
    if (($env:Path -split ';') -notcontains $bin) { $env:Path = "$env:Path;$bin" }
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

try {
  if ($env:INSTALL_LIB_ONLY -eq '1') { . $SignumSandboxInstaller } else { & $SignumSandboxInstaller }
} finally {
  Remove-Variable -Name SignumSandboxInstaller -ErrorAction SilentlyContinue
}
