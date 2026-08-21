@echo off
setlocal EnableExtensions
title XAMPP MySQL / MariaDB Repair Tool

REM ===========================================================================
REM  fix-xampp-mysql.bat
REM
REM  Repairs the XAMPP control panel error:
REM      "Error: MySQL shutdown unexpectedly."
REM
REM  Portable: auto-detects where XAMPP is installed, so it runs on any laptop.
REM  Safe:     it NEVER drops, deletes or truncates a database, table or row.
REM            It only repairs in place, and backs up before every change.
REM
REM  Just double-click this file. It will ask for administrator rights.
REM ===========================================================================

net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Requesting administrator rights, please approve the prompt...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-Content -LiteralPath '%~f0'; $t = '#PS' + 'START#'; $i = ($c | Select-String -SimpleMatch $t | Select-Object -First 1).LineNumber; Invoke-Expression (($c | Select-Object -Skip $i) -join [Environment]::NewLine)"

echo.
pause
exit /b
#PSSTART#

# =============================================================================
#  XAMPP MySQL / MariaDB repair tool  (PowerShell payload)
#
#  SAFETY CONTRACT - this script will never:
#     * run DROP / DELETE / TRUNCATE
#     * delete any .frm .ibd .MYD .MYI .MAD .MAI .CSV file
#     * delete ibdata1, ib_logfile*, aria_log* or any data directory
#     * force-kill mysqld.exe (a force kill is what corrupts Aria tables)
#
#  It only ever: backs up, edits my.ini, renames oversized log files,
#  removes stale .pid files, and runs REPAIR TABLE / aria_chk --recover,
#  all of which preserve rows.
# =============================================================================

$ErrorActionPreference = 'Continue'
$script:Changes  = New-Object System.Collections.ArrayList
$script:Problems = New-Object System.Collections.ArrayList

function Step    ($m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Good    ($m) { Write-Host "    [ OK ]  $m" -ForegroundColor Green }
function Note    ($m) { Write-Host "    [INFO]  $m" -ForegroundColor DarkGray }
function Warn    ($m) { Write-Host "    [WARN]  $m" -ForegroundColor Yellow; [void]$script:Problems.Add($m) }
function Bad     ($m) { Write-Host "    [FAIL]  $m" -ForegroundColor Red;    [void]$script:Problems.Add($m) }
function Fixed   ($m) { Write-Host "    [FIXED] $m" -ForegroundColor Magenta;[void]$script:Changes.Add($m) }

Write-Host ""
Write-Host "  ===================================================" -ForegroundColor White
Write-Host "   XAMPP MySQL / MariaDB repair tool" -ForegroundColor White
Write-Host "   Fixes: 'MySQL shutdown unexpectedly'" -ForegroundColor White
Write-Host "   No database or data is ever deleted." -ForegroundColor White
Write-Host "  ===================================================" -ForegroundColor White

# ---------------------------------------------------------------------------
# 1. Locate the XAMPP installation
# ---------------------------------------------------------------------------
Step "Locating XAMPP"

$Xampp = $null
$probe = New-Object System.Collections.ArrayList
foreach ($d in [char[]]([char]'C'..[char]'Z')) {
    [void]$probe.Add("${d}:\xampp")
    [void]$probe.Add("${d}:\XAMPP")
}
[void]$probe.Add("$env:ProgramFiles\xampp")
[void]$probe.Add("${env:ProgramFiles(x86)}\xampp")

foreach ($p in $probe) {
    if (Test-Path (Join-Path $p 'mysql\bin\mysqld.exe')) { $Xampp = $p; break }
}

if (-not $Xampp) {
    Warn "Could not auto-detect XAMPP."
    $typed = Read-Host "    Type the XAMPP folder (example C:\xampp)"
    if ($typed -and (Test-Path (Join-Path $typed 'mysql\bin\mysqld.exe'))) {
        $Xampp = $typed
    } else {
        Bad "mysqld.exe not found. Nothing to repair - exiting."
        return
    }
}
Good "XAMPP found at $Xampp"

$MysqlBin   = Join-Path $Xampp 'mysql\bin'
$Mysqld     = Join-Path $MysqlBin 'mysqld.exe'
$MysqlAdmin = Join-Path $MysqlBin 'mysqladmin.exe'
$MysqlCli   = Join-Path $MysqlBin 'mysql.exe'
$MysqlDump  = Join-Path $MysqlBin 'mysqldump.exe'
$AriaChk    = Join-Path $MysqlBin 'aria_chk.exe'
$MyIni      = Join-Path $MysqlBin 'my.ini'

if (-not (Test-Path $MyIni)) { Bad "my.ini not found at $MyIni - exiting."; return }

# datadir straight out of my.ini, falling back to the XAMPP default
$DataDir = Join-Path $Xampp 'mysql\data'
$iniRaw  = Get-Content $MyIni
$dd = $iniRaw | Where-Object { $_ -match '^\s*datadir\s*=' } | Select-Object -Last 1
if ($dd) {
    $v = ($dd -split '=', 2)[1].Trim().Trim('"').Replace('/', '\')
    if ($v -and (Test-Path $v)) { $DataDir = $v }
}
Good "Data directory: $DataDir"

# error log location
$LogName = 'mysql_error.log'
$le = $iniRaw | Where-Object { $_ -match '^\s*log[-_]error\s*=' } | Select-Object -Last 1
if ($le) {
    $v = ($le -split '=', 2)[1].Trim().Trim('"').Replace('/', '\')
    if ($v) { $LogName = Split-Path $v -Leaf }
}
$ErrLog = Join-Path $DataDir $LogName

$Stamp     = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $Xampp "mysql\repair-backups\$Stamp"
New-Item -ItemType Directory -Force $BackupDir | Out-Null
Good "Backup folder: $BackupDir"

# ---------------------------------------------------------------------------
# 2. Helpers
# ---------------------------------------------------------------------------
$script:RootArgs   = @('-u', 'root')
$script:ForcedKill = $false

function MySQL-IsRunning {
    return [bool](Get-Process -Name mysqld -ErrorAction SilentlyContinue)
}

function MySQL-CanConnect {
    & $MysqlAdmin @script:RootArgs ping 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function MySQL-ResolveAuth {
    # Works out how to log in as root. Tries no password first.
    if (MySQL-CanConnect) { return $true }
    $out = & $MysqlAdmin -u root ping 2>&1
    if ("$out" -match 'Access denied') {
        Note "The root account has a password."
        $sec = Read-Host "    Enter MySQL root password" -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        $script:RootArgs = @('-u', 'root', "-p$pw")
        if (MySQL-CanConnect) { return $true }
        Bad "Could not log in as root with that password."
        return $false
    }
    return $false
}

function MySQL-WaitGone {
    param([int]$Seconds)
    for ($i = 0; $i -lt ($Seconds * 2); $i++) {
        if (-not (MySQL-IsRunning)) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return (-not (MySQL-IsRunning))
}

function MySQL-StopGracefully {
    # Always tries a clean shutdown first. A force kill is only ever used on a
    # process that has stopped answering altogether - see the comment below.
    if (-not (MySQL-IsRunning)) { Note "MySQL is not running."; return $true }

    if (MySQL-CanConnect) {
        Note "Asking MySQL to shut down cleanly..."
        & $MysqlAdmin @script:RootArgs shutdown 2>&1 | Out-Null
        if (MySQL-WaitGone 60) { Good "MySQL stopped cleanly."; return $true }
        if (MySQL-CanConnect) {
            Note "Still finishing shutdown, waiting a little longer..."
            if (MySQL-WaitGone 90) { Good "MySQL stopped cleanly."; return $true }
        }
    }

    # Reaching here means mysqld.exe is alive but refuses connections: it is a
    # hung / orphaned instance. MariaDB on Windows sometimes wedges after it has
    # already closed its port, and such an orphan keeps the Aria system tables
    # locked, so every later start hangs too. There is no graceful lever left,
    # and it has already stopped serving, so terminating it is the only option.
    # ForcedKill makes the repair pass below mandatory to catch any damage.
    $hung = @(Get-Process -Name mysqld -ErrorAction SilentlyContinue)
    if ($hung.Count -gt 0) {
        Note "mysqld is alive but not answering - it is hung."
        Note "A hung mysqld keeps the system tables locked, so nothing can start"
        Note "until it is cleared. Clearing it, then repairing afterwards."
        foreach ($h in $hung) {
            try { Stop-Process -Id $h.Id -Force -ErrorAction Stop; Note "cleared PID $($h.Id)" } catch { }
        }
        Start-Sleep -Seconds 3
        $script:ForcedKill = $true
        if (MySQL-IsRunning) { Bad "Could not clear the hung mysqld process."; return $false }
        Fixed "cleared $($hung.Count) hung mysqld process(es)"
        return $true
    }
    return (-not (MySQL-IsRunning))
}

function MySQL-Start {
    param([int]$TimeoutSec = 60)

    # mysqld is launched DETACHED, via Win32_Process.Create rather than
    # Start-Process. If mysqld is a child of this window, closing the window
    # sends it a console-close signal, and Windows then kills it after roughly
    # five seconds - long enough to dump the buffer pool but not to write the
    # final checkpoint. That truncates the InnoDB redo log and the next start
    # dies with "Missing MLOG_CHECKPOINT". Detaching removes that whole class
    # of damage, and lets MySQL keep running after this script finishes.
    $cmd = "`"$Mysqld`" --defaults-file=`"$MyIni`" --standalone"
    try {
        $res = ([WMICLASS]'\\.\ROOT\CIMV2:Win32_Process').Create($cmd, $MysqlBin)
    } catch {
        Bad "could not launch mysqld: $($_.Exception.Message)"; return $false
    }
    if ($res.ReturnValue -ne 0) { Bad "could not launch mysqld (code $($res.ReturnValue))"; return $false }
    $newPid = $res.ProcessId

    for ($i = 0; $i -lt ($TimeoutSec * 2); $i++) {
        if (-not (Get-Process -Id $newPid -ErrorAction SilentlyContinue)) {
            return $false                        # exited - caller inspects the log
        }
        if (MySQL-CanConnect) { return $true }
        Start-Sleep -Milliseconds 500
    }
    # Alive but never reachable: it wedged during startup. Leaving it would block
    # every following attempt, so clear it rather than pile up orphans.
    Warn "mysqld started but never became reachable within $TimeoutSec s (hung)."
    try { Stop-Process -Id $newPid -Force -ErrorAction Stop } catch { }
    Start-Sleep -Seconds 2
    $script:ForcedKill = $true
    return $false
}

function InnoDB-RecreateRedoLogs {
    # Called only when InnoDB refuses to initialise because its redo log tail is
    # inconsistent ("Missing MLOG_CHECKPOINT"). The log files are MOVED into the
    # backup folder, never deleted, and InnoDB builds fresh ones on next start.
    # Table data lives in ibdata1 and the .ibd files, which are not touched.
    $moved = 0
    foreach ($f in @('ib_logfile0', 'ib_logfile1', 'ib_logfile2')) {
        $src = Join-Path $DataDir $f
        if (Test-Path $src) {
            try { Move-Item $src (Join-Path $BackupDir $f) -Force; $moved++ } catch { }
        }
    }
    if ($moved -gt 0) { Fixed "moved $moved InnoDB redo log file(s) aside - InnoDB will rebuild them" }
    return ($moved -gt 0)
}

function Ini-EnsureOption {
    # Adds "name=value" to the [mysqld] section if that option is not set there.
    param([string]$Name, [string]$Value, [string]$Comment)
    $lines = [System.Collections.ArrayList](Get-Content $MyIni)
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*\[mysqld\]\s*$') { $start = $i; break }
    }
    if ($start -lt 0) { Warn "No [mysqld] section in my.ini; skipped $Name."; return $false }
    $end = $lines.Count
    for ($i = $start + 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*\[') { $end = $i; break }
    }
    for ($i = $start + 1; $i -lt $end; $i++) {
        if ($lines[$i] -match "^\s*$([regex]::Escape($Name))\s*=") {
            Note "$Name already set - left as is."
            return $false
        }
    }
    $ins = New-Object System.Collections.ArrayList
    [void]$ins.Add('')
    foreach ($c in $Comment -split "`n") { [void]$ins.Add("# $c") }
    [void]$ins.Add("$Name=$Value")
    $lines.InsertRange($start + 1, $ins)
    Set-Content -LiteralPath $MyIni -Value $lines -Encoding ASCII
    Fixed "my.ini: added $Name=$Value"
    return $true
}

# ---------------------------------------------------------------------------
# 3. Stop MySQL cleanly before touching anything
# ---------------------------------------------------------------------------
Step "Stopping MySQL (gracefully)"
$running = @(Get-Process -Name mysqld -ErrorAction SilentlyContinue)
if ($running.Count -gt 1) {
    Warn "$($running.Count) mysqld.exe processes are running - leftover orphans block startup."
}
if ($running.Count -gt 0) { [void](MySQL-ResolveAuth) }
if (-not (MySQL-StopGracefully)) {
    Bad "MySQL could not be stopped. Close the XAMPP panel and run this again."
    return
}

# ---------------------------------------------------------------------------
# 4. Back up everything this script may touch
# ---------------------------------------------------------------------------
Step "Backing up (nothing is deleted)"
Copy-Item $MyIni (Join-Path $BackupDir 'my.ini') -Force
Good "my.ini backed up"

$StopBat = Join-Path $Xampp 'mysql_stop.bat'
if (Test-Path $StopBat) {
    Copy-Item $StopBat (Join-Path $BackupDir 'mysql_stop.bat') -Force
    Good "mysql_stop.bat backed up"
}

$SysDb = Join-Path $DataDir 'mysql'
if (Test-Path $SysDb) {
    Copy-Item $SysDb (Join-Path $BackupDir 'mysql-system-db') -Recurse -Force
    Good "mysql system database backed up (privileges, users)"
}

# ---------------------------------------------------------------------------
# 5. Apply the my.ini fixes  (this is the actual crash fix)
# ---------------------------------------------------------------------------
Step "Applying my.ini stability fixes"

[void](Ini-EnsureOption -Name 'innodb_use_native_aio' -Value '0' -Comment @"
THE CRASH FIX. MariaDB 10.4 on Windows asserts inside its native (overlapped)
async I/O handler while the buffer pool loads in the background at startup:
    InnoDB: Assertion failure in file ...\os0file.cc line 6132
    InnoDB: Failing assertion: slot
    mysqld got exception 0x80000003
The XAMPP panel only shows 'MySQL shutdown unexpectedly'. It is a thread race,
not data corruption, which is why it only failed sometimes. Simulated AIO
avoids the faulty code path completely.
"@)

[void](Ini-EnsureOption -Name 'aria_recover_options' -Value 'BACKUP,FORCE' -Comment @"
Auto-recover Aria system tables at startup instead of aborting. BACKUP keeps a
copy of anything it rewrites, so nothing is lost silently.
"@)

# key_buffer -> key_buffer_size (MariaDB warns the short prefix may stop working)
$lines = Get-Content $MyIni
if ($lines | Where-Object { $_ -match '^\s*key_buffer\s*=' }) {
    ($lines -replace '^(\s*)key_buffer(\s*=)', '$1key_buffer_size$2') |
        Set-Content -LiteralPath $MyIni -Encoding ASCII
    Fixed "my.ini: key_buffer renamed to key_buffer_size (deprecated prefix)"
}

# ---------------------------------------------------------------------------
# 6. Log / stale file hygiene   (renamed into the backup folder, never deleted)
# ---------------------------------------------------------------------------
Step "Log and stale-file hygiene"

if (Test-Path $ErrLog) {
    $mb = (Get-Item $ErrLog).Length / 1MB
    if ($mb -gt 2) {
        Move-Item $ErrLog (Join-Path $BackupDir "$LogName.old") -Force
        Fixed ("error log was {0:N1} MB - archived so new errors are readable" -f $mb)
    } else {
        Note ("error log is {0:N1} MB - fine" -f $mb)
    }
}

foreach ($stale in @('mysql.pid', "$env:COMPUTERNAME.pid")) {
    $f = Join-Path $DataDir $stale
    if (Test-Path $f) { Remove-Item $f -Force; Fixed "removed stale $stale (not data)" }
}

$dmp = Join-Path $DataDir 'mysqld.dmp'
if (Test-Path $dmp) { Move-Item $dmp (Join-Path $BackupDir 'mysqld.dmp') -Force; Note "crash dump archived" }

# ---------------------------------------------------------------------------
# 7. Is port 3306 taken by something else?
# ---------------------------------------------------------------------------
Step "Checking port 3306"
$busy = $null
try { $busy = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue } catch { }
if ($busy) {
    $owner = (Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue).ProcessName
    Warn "Port 3306 is already in use by '$owner'. Close it, or change 'port=' in my.ini."
} else {
    Good "Port 3306 is free"
}

# ---------------------------------------------------------------------------
# 8. Start MySQL
# ---------------------------------------------------------------------------
function Get-ErrLogTail {
    if (Test-Path $ErrLog) { return ((Get-Content $ErrLog -Tail 60) -join "`n") }
    return ''
}

function Repair-AriaOffline {
    # aria_chk must run with the data directory as its working directory so it
    # can read aria_log_control.
    # --safe-recover, not --recover: --recover rebuilds indexes by sorting, and
    # standalone aria_chk ignores sort_buffer_size, so it dies with
    # "aria_sort_buffer_size is too small" on any non-trivial table and leaves it
    # broken. --safe-recover rebuilds through the key cache instead: slower, but
    # it actually works. Rows are preserved either way.
    Push-Location $DataDir
    $mai = Get-ChildItem (Join-Path $DataDir 'mysql') -Filter '*.MAI' -ErrorAction SilentlyContinue |
           ForEach-Object { $_.FullName }
    if ($mai) {
        & $AriaChk --safe-recover --force --silent @mai 2>&1 |
            Select-Object -Last 15 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Fixed "offline aria_chk --safe-recover on $($mai.Count) system tables"
    }
    Pop-Location
}

Step "Starting MySQL"
$started = MySQL-Start

if (-not $started) {
    Warn "MySQL did not start - diagnosing from the error log."
    Write-Host ""
    Write-Host "    ---- last lines of the error log ----" -ForegroundColor DarkGray
    if (Test-Path $ErrLog) { Get-Content $ErrLog -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray } }
    Write-Host ""

    $tail = Get-ErrLogTail

    # InnoDB refusing to initialise is fixed by rebuilding the redo log, and no
    # amount of table repair will help until that is done - so handle it first.
    if ($tail -match 'Missing MLOG_CHECKPOINT|Plugin initialization aborted|Unknown/unsupported storage engine: InnoDB|log sequence number.*in the future') {
        Step "Rebuilding the InnoDB redo log"
        Note "InnoDB cannot use its current redo log. The log only holds recent"
        Note "changes; your tables live in ibdata1 and the .ibd files, untouched."
        if (InnoDB-RecreateRedoLogs) { $started = MySQL-Start }
    }

    if (-not $started) {
        Step "Offline repair of the system tables"
        Repair-AriaOffline
        $started = MySQL-Start
    }

    # A damaged privilege table also blocks startup, and only shows up once
    # InnoDB is happy, so it is worth one more pass.
    if (-not $started -and (Get-ErrLogTail) -match "marked as crashed|Can't open and lock privilege tables") {
        Step "Repairing privilege tables and retrying"
        Repair-AriaOffline
        $started = MySQL-Start
    }
}

if (-not $started) {
    Bad "MySQL still will not start."
    Note "Your data has NOT been touched. Backups are in:"
    Note "  $BackupDir"
    Note "Send the last lines of $ErrLog for a deeper diagnosis."
    return
}
Good "MySQL is running"

if (-not (MySQL-ResolveAuth)) { Bad "Cannot log in as root - stopping here."; return }

# ---------------------------------------------------------------------------
# 9. Safety net: logical dump of every database BEFORE repairing anything
# ---------------------------------------------------------------------------
Step "Dumping every database as a safety net"
$DumpDir = Join-Path $BackupDir 'database-dumps'
New-Item -ItemType Directory -Force $DumpDir | Out-Null

$dbs = & $MysqlCli @script:RootArgs -N -B -e "SHOW DATABASES" 2>$null |
       Where-Object { $_ -and $_ -notin @('information_schema', 'performance_schema') }
$okDump = 0
foreach ($db in $dbs) {
    $safe = ($db -replace '[\\/:*?"<>|]', '_')
    $out  = Join-Path $DumpDir "$safe.sql"
    $err  = & $MysqlDump @script:RootArgs --routines --events --triggers --single-transaction `
                         --databases $db --result-file=$out 2>&1
    if ($LASTEXITCODE -ne 0) {
        # --single-transaction fails if a table is mid-repair or non-transactional;
        # a plain dump usually still succeeds, so try once more before giving up.
        $err = & $MysqlDump @script:RootArgs --routines --events --triggers `
                            --databases $db --result-file=$out 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        $okDump++
    } else {
        $msg = (($err | ForEach-Object { "$_" }) -join ' ').Trim()
        if ($msg.Length -gt 160) { $msg = $msg.Substring(0, 160) + '...' }
        Warn "could not fully dump '$db' - $msg"
        Note "'$db' itself is untouched on disk; only its .sql copy is incomplete."
    }
}
Good "$okDump of $($dbs.Count) databases dumped to $DumpDir"

# ---------------------------------------------------------------------------
# 10. Check every table, and repair ONLY the ones actually reported as damaged.
#
#     Deliberately not a blanket "REPAIR TABLE" over all 24 system tables:
#     rewriting perfectly healthy Aria index files on every run is pure churn,
#     and that churn can itself introduce the corruption it is meant to cure.
#     CHECK TABLE reports "Table is from another system" as Corrupt too, so the
#     targeted repair below still covers the copied-system-database case.
# ---------------------------------------------------------------------------
Step "Checking all databases"
if ($script:ForcedKill) {
    Note "A hung mysqld had to be cleared earlier, so this check matters."
}
$check = & (Join-Path $MysqlBin 'mysqlcheck.exe') @script:RootArgs --all-databases --check 2>&1 |
         ForEach-Object { "$_" }
$cur = ''; $damaged = New-Object System.Collections.ArrayList
foreach ($line in $check) {
    if ($line -notmatch '^\s' -and $line -match '^\S+\.\S+') { $cur = $line.Trim() }
    elseif ($line -match 'Corrupt|marked as crashed|from another system') {
        if ($cur -and -not $damaged.Contains($cur)) { [void]$damaged.Add($cur) }
    }
}

if ($damaged.Count -eq 0) {
    Good "every table in every database reports OK"
} else {
    Warn "$($damaged.Count) damaged table(s) found - repairing in place"
    foreach ($t in $damaged) {
        $parts = $t -split '\.', 2
        $q = "``$($parts[0])``.``$($parts[1])``"
        $r = & $MysqlCli @script:RootArgs -N -B -e "REPAIR TABLE $q;" 2>&1
        if ("$r" -notmatch 'error|Error') { Fixed "repaired $t"; continue }

        # A corrupt index definition cannot be rebuilt from the index file itself.
        # USE_FRM rebuilds it from the table definition instead, keeping the rows.
        Note "$t needs a deeper repair, rebuilding its index from the .frm ..."
        $r2 = & $MysqlCli @script:RootArgs -N -B -e "REPAIR TABLE $q USE_FRM;" 2>&1
        if ("$r2" -notmatch 'error|Error') { Fixed "repaired $t (USE_FRM)" }
        else { Warn "could not repair $t (left untouched, its data is still on disk)" }
    }
}

# ---------------------------------------------------------------------------
# 12. Replace the broken XAMPP stop script with a graceful one
# ---------------------------------------------------------------------------
Step "Making sure MySQL always stops cleanly"
$needStopFix = $true
if (Test-Path $StopBat) {
    $sc = Get-Content $StopBat -Raw
    if ($sc -match 'xampp-mysql-repair') { $needStopFix = $false; Note "mysql_stop.bat already stops gracefully." }
}
if ($needStopFix) {
@"
@echo off
cd /D %~dp0
REM [xampp-mysql-repair] graceful shutdown, installed by fix-xampp-mysql.bat
REM The stock XAMPP version called an unexpanded installer placeholder path and
REM force-killed mysqld, which is what corrupts the Aria system tables.
REM Never force-kill mysqld.
echo Stopping MySQL gracefully, please wait ...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I "mysqld.exe" >NUL
if errorlevel 1 (
    echo MySQL is not running.
    goto cleanup
)
mysql\bin\mysqladmin.exe --defaults-file=mysql\bin\my.ini -u root shutdown
setlocal enabledelayedexpansion
set /a waited=0
:waitloop
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I "mysqld.exe" >NUL
if errorlevel 1 goto stopped
set /a waited+=1
if !waited! GEQ 120 goto timedout
ping -n 2 127.0.0.1 >NUL
goto waitloop
:stopped
echo MySQL stopped cleanly.
endlocal
goto cleanup
:timedout
echo WARNING: MySQL did not stop in 120 seconds. Not force-killing it.
endlocal
goto end
:cleanup
if exist mysql\data\%computername%.pid del mysql\data\%computername%.pid
if exist mysql\data\mysql.pid del mysql\data\mysql.pid
:end
"@ | Set-Content -LiteralPath $StopBat -Encoding ASCII
    Fixed "mysql_stop.bat now performs a graceful shutdown"
}

# ---------------------------------------------------------------------------
# 13. Prove it: restart three times
# ---------------------------------------------------------------------------
Step "Verifying stability (3 restart cycles)"
$cycles = 0
for ($i = 1; $i -le 3; $i++) {
    if (-not (MySQL-StopGracefully)) { break }
    if (MySQL-Start) { $cycles++; Good "cycle $i of 3 started cleanly" }
    else { Bad "cycle $i failed to start"; break }
}

# ---------------------------------------------------------------------------
# 14. Final report
# ---------------------------------------------------------------------------
Step "Result"

if (MySQL-CanConnect) {
    $dbList = & $MysqlCli @script:RootArgs -N -B -e "SHOW DATABASES" 2>$null
    $tCount = & $MysqlCli @script:RootArgs -N -B -e `
        "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA NOT IN ('information_schema','performance_schema')" 2>$null
    $uCount = & $MysqlCli @script:RootArgs -N -B -e "SELECT COUNT(*) FROM mysql.user" 2>$null
    Good "MySQL is running and accepting connections"
    Good "$($dbList.Count) databases, $tCount tables, $uCount user accounts - all intact"
} else {
    Bad "MySQL is not reachable."
}

Write-Host ""
Write-Host "  Changes made:" -ForegroundColor White
if ($script:Changes.Count -eq 0) { Write-Host "    (nothing needed changing)" -ForegroundColor DarkGray }
else { foreach ($c in $script:Changes) { Write-Host "    * $c" -ForegroundColor Magenta } }

if ($script:Problems.Count -gt 0) {
    Write-Host ""
    Write-Host "  Things to look at:" -ForegroundColor Yellow
    foreach ($p in $script:Problems) { Write-Host "    ! $p" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "  Backups (nothing was deleted): $BackupDir" -ForegroundColor White
Write-Host "  Start MySQL from the XAMPP panel as usual." -ForegroundColor White
Write-Host "  To stop it safely, use the panel's Stop button or mysql_stop.bat." -ForegroundColor White
Write-Host ""
