# Tests for the Windows launcher's decisions - the twin of launcher.test.sh.
# The effects (downloading, unpacking, starting a JVM, stopping one) are
# covered by scripts/e2e-install.ps1 on a real Windows instead.
#
# Runs under Windows PowerShell 5.1, which is what the launcher has to work
# in, and under pwsh on Linux and macOS, which is what lets it run beside
# launcher.test.sh on any machine that has pwsh.
$ErrorActionPreference = 'Stop'

$Here = $PSScriptRoot
$env:SIGNUM_SANDBOX_PINNED = Join-Path $Here 'jre.pinned'
$env:LAUNCHER_LIB_ONLY = '1'
. (Join-Path $Here 'signum-sandbox.ps1')

$script:fails = 0
function check([string]$label, [string]$expected, [string]$actual) {
  if ($expected -ceq $actual) {
    [Console]::Out.WriteLine("ok   $label")
  } else {
    [Console]::Out.WriteLine("FAIL $label`n       expected: $expected`n       actual:   $actual")
    $script:fails++
  }
}

# --- both launchers read the same jre.pinned --------------------------------
check 'pinned version is read'  '21.0.12.1+1'          $Pinned.JRE_VERSION
check 'pinned directory is read' 'jdk-21.0.12.1+1-jre' $Pinned.JRE_DIR

# --- platform_id ------------------------------------------------------------
check 'intel and amd 64-bit' 'windows_x64'     (platform_id 'AMD64')
check 'arm 64-bit'           'windows_aarch64' (platform_id 'ARM64')
check 'case does not matter' 'windows_x64'     (platform_id 'amd64')
check '32-bit is not supported' ''             (platform_id 'x86')
check 'nothing is not supported' ''            (platform_id '')

# --- jre_url ----------------------------------------------------------------
check 'url for windows x64' `
  'https://api.adoptium.net/v3/binary/version/jdk-21.0.12.1%2B1/windows/x64/jre/hotspot/normal/eclipse' `
  (jre_url 'windows_x64')
check 'url for windows arm' `
  'https://api.adoptium.net/v3/binary/version/jdk-21.0.12.1%2B1/windows/aarch64/jre/hotspot/normal/eclipse' `
  (jre_url 'windows_aarch64')
check 'no url for another platform' '' (jre_url 'linux_x64')

# --- jre_sha: every platform this build claims must have one ----------------
foreach ($platform in 'windows_x64', 'windows_aarch64') {
  $sha = jre_sha $platform
  if ($sha -match '^[0-9a-f]{64}$') { check "sha present for $platform" 'ok' 'ok' }
  else { check "sha present for $platform" 'a 64-character sum' $sha }
}

# --- java_binary ------------------------------------------------------------
check 'java on windows' (join_parts 'jre' 'jdk-21.0.12.1+1-jre' 'bin' 'java.exe') (java_binary 'windows_x64' 'jre')
check 'no java for another platform' '' (java_binary 'mac_x64' 'jre')

# --- installed_version / html_needs_copy / prune_list -----------------------
$Tmp = Join-Path ([IO.Path]::GetTempPath()) "launcher-test-$([Guid]::NewGuid())"
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {
  check 'no installed file means nothing is installed' '' (installed_version (Join-Path $Tmp 'installed'))
  [IO.File]::WriteAllText((Join-Path $Tmp 'installed'), "0.1.0`n")
  check 'installed file is read, newline stripped' '0.1.0' (installed_version (Join-Path $Tmp 'installed'))
  [IO.File]::WriteAllText((Join-Path $Tmp 'installed'), "0.1.0`r`n")
  check 'a windows newline is stripped too' '0.1.0' (installed_version (Join-Path $Tmp 'installed'))

  check 'html must be copied when it is absent' 'yes' (html_needs_copy '0.1.0' (join_parts $Tmp 'absent' '.version'))
  New-Item -ItemType Directory -Path (Join-Path $Tmp 'html') | Out-Null
  [IO.File]::WriteAllText((join_parts $Tmp 'html' '.version'), "0.1.0`n")
  check 'html is current' 'no' (html_needs_copy '0.1.0' (join_parts $Tmp 'html' '.version'))
  check 'html is stale after an update' 'yes' (html_needs_copy '0.2.0' (join_parts $Tmp 'html' '.version'))

  $app = Join-Path $Tmp 'app'
  foreach ($dir in '0.1.0', '0.2.0', '0.3.0', '.staging-0.4.0') {
    New-Item -ItemType Directory -Path (Join-Path $app $dir) | Out-Null
  }
  check 'prune keeps what is live and the rollback target' '0.1.0' ((prune_list $app @('0.3.0', '0.2.0')) -join ',')
  check 'prune with no previous keeps only the live one' '0.1.0,0.2.0' ((prune_list $app @('0.3.0', '')) -join ',')
  check 'prune of a missing directory is nothing' '' ((prune_list (Join-Path $Tmp 'nope') @('0.1.0')) -join ',')

  # --- sha256_of: the same answer as sha256sum ------------------------------
  [IO.File]::WriteAllText((Join-Path $Tmp 'known.txt'), "signum`n")
  check 'sha256 of a known file' `
    '0a8abc637f4f2641c3dd39b93fa078ea42b6f988c57f621d93f20b1b594b1149' `
    (sha256_of (Join-Path $Tmp 'known.txt'))

  # --- port_in --------------------------------------------------------------
  check 'no properties means the default port' '6876' (port_in (Join-Path $Tmp 'none.properties'))
  [IO.File]::WriteAllText((Join-Path $Tmp 'node.properties'), "# API.Port = 1`nnode.network = x`nAPI.Port = 7000`n")
  check 'a port somebody set is used' '7000' (port_in (Join-Path $Tmp 'node.properties'))

  # --- install.ps1 checks the release it downloads --------------------------
  # Its own copy of the check, as install.sh has: it runs on its own.
  $env:INSTALL_LIB_ONLY = '1'
  . (Join-Path $Here 'install.ps1')
  $known = '0a8abc637f4f2641c3dd39b93fa078ea42b6f988c57f621d93f20b1b594b1149'
  check 'install: the sum of a known file' $known (install_sha256 (Join-Path $Tmp 'known.txt'))
  check 'install: a matching sum is ok' 'ok' (sum_verdict (Join-Path $Tmp 'known.txt') $known)
  check 'install: a sum in capitals is ok too' 'ok' (sum_verdict (Join-Path $Tmp 'known.txt') $known.ToUpperInvariant())
  check 'install: another sum is a mismatch' 'mismatch' `
    (sum_verdict (Join-Path $Tmp 'known.txt') ('f' * 64))
  check 'install: no published sum is absent' 'absent' (sum_verdict (Join-Path $Tmp 'known.txt') '')
} finally {
  Remove-Item -LiteralPath $Tmp -Recurse -Force
}

# --- reset must refuse while a node is running ------------------------------
check 'refuses while running'              'refuse'    (reset_verdict 'yes' 'yes')
check 'refuses even unconfirmed'           'refuse'    (reset_verdict 'yes' 'no')
check 'deletes when stopped and confirmed' 'delete'    (reset_verdict 'no' 'yes')
check 'cancels when not confirmed'         'cancelled' (reset_verdict 'no' 'no')

# --- start_verdict ----------------------------------------------------------
check 'answering is ready'                   'ready'   (start_verdict 'yes' 'yes' 3 90)
check 'answering wins even at the limit'     'ready'   (start_verdict 'yes' 'yes' 90 90)
check 'dead and silent has died'             'died'    (start_verdict 'no' 'no' 3 90)
check 'death is reported before the clock'   'died'    (start_verdict 'no' 'no' 90 90)
check 'alive and silent keeps waiting'       'waiting' (start_verdict 'yes' 'no' 89 90)
check 'alive and silent at the limit is out' 'timeout' (start_verdict 'yes' 'no' 90 90)

# --- latest_tag -------------------------------------------------------------
check 'tag without the v'          '0.2.0' (latest_tag '{"tag_name":"v0.2.0","name":"0.2.0","draft":false}')
check 'tag that has no v'          '0.2.0' (latest_tag '{"tag_name":"0.2.0"}')
check 'no answer means no version' ''      (latest_tag '')
check 'an error answer means none' ''      (latest_tag '{"message":"Not Found"}')
check 'not json at all means none' ''      (latest_tag '<html>rate limited</html>')

# --- release_url ------------------------------------------------------------
check 'release asset url' `
  'https://github.com/signum-network/signum-sandbox/releases/download/v0.2.0/signum-sandbox-0.2.0.zip' `
  (release_url '0.2.0')

# --- path_has ---------------------------------------------------------------
check 'a directory on PATH is found'        'yes' (path_has 'C:\Windows;C:\Users\a\.signum-sandbox\bin' 'C:\Users\a\.signum-sandbox\bin')
check 'case does not matter on PATH'        'yes' (path_has 'C:\USERS\A\.signum-sandbox\BIN' 'C:\Users\a\.signum-sandbox\bin')
check 'a trailing backslash does not matter' 'yes' (path_has 'C:\Users\a\.signum-sandbox\bin\;C:\x' 'C:\Users\a\.signum-sandbox\bin')
check 'a longer directory is not this one'  'no'  (path_has 'C:\Users\a\.signum-sandbox\bin2' 'C:\Users\a\.signum-sandbox\bin')
check 'an empty PATH has nothing'           'no'  (path_has '' 'C:\Users\a\.signum-sandbox\bin')

# --- same_process -----------------------------------------------------------
check 'the same start time is the same process' 'yes' (same_process '133700000000000000' '133700000000000000')
check 'another start time is another process'   'no'  (same_process '133700000000000000' '133700000000000001')
check 'no recorded start time proves nothing'   'no'  (same_process '' '')

# --- the scripts Windows PowerShell reads are ASCII -------------------------
# 5.1 reads a script without a byte order mark as Windows-1252.
foreach ($name in 'signum-sandbox.ps1', 'install.ps1', 'signum-sandbox.cmd') {
  $bytes = [IO.File]::ReadAllBytes((Join-Path $Here $name))
  $wide = @($bytes | Where-Object { $_ -gt 127 }).Count
  check "$name is plain ascii" '0' "$wide"
}

[Console]::Out.WriteLine('')
if ($script:fails -eq 0) {
  [Console]::Out.WriteLine('all checks passed')
} else {
  [Console]::Out.WriteLine("$($script:fails) check(s) failed")
  exit 1
}
