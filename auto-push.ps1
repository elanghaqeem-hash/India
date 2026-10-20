# Auto-push changes from the LOCAL Windows checkout only.
# Requires authenticated Git remote. Keep this process running while working.
param(
    [ValidateRange(2,3600)][int]$IntervalSeconds = 3,
    [string]$Branch = 'main',
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Invoke-Git {
    param([string[]]$ArgsList)
    $output = & git @ArgsList 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git failed: $($ArgsList -join ' ') : $($output | Out-String)"
    }
    return $output
}

function Sync-GitChanges {
    try {
        $actualBranch = (Invoke-Git -ArgsList @('branch','--show-current') | Out-String).Trim()
        if ($actualBranch -ne $Branch) {
            throw "Expected branch $Branch but found $actualBranch"
        }
        $origin = (Invoke-Git -ArgsList @('remote','get-url','origin') | Out-String).Trim()
        if ($origin -notmatch '^(https://github[.]com/elanghaqeem-hash/India([.]git)?|git@github[.]com:elanghaqeem-hash/India([.]git)?)$') {
            throw "Unexpected origin: $origin"
        }

        $status = @(Invoke-Git -ArgsList @('status','--porcelain'))
        if ($status.Count -gt 0) {
            Start-Sleep -Seconds 2
            Invoke-Git -ArgsList @('add','-A') | Out-Null
            $staged = @(Invoke-Git -ArgsList @('diff','--cached','--name-only'))
            $blocked = @($staged | Where-Object {
                $_ -match '(^|/)([.]env($|[.])|[.]dev[.]vars($|[.])|credentials([.]|$)|icop_database[.]json$)' -or $_ -match '[.](pem|key)$'
            })
            if ($blocked.Count -gt 0) {
                throw "Sensitive files staged; remove them first: $($blocked -join ', ')"
            }
            if ($staged.Count -gt 0) {
                $message = 'Auto-update: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
                Invoke-Git -ArgsList @('commit','-m',$message) | Out-Null
                Write-Host "Commit created: $message" -ForegroundColor Cyan
            }
        }
        # Retry any earlier unpushed commits, even when no new files changed.
        Invoke-Git -ArgsList @('push','origin',"HEAD:refs/heads/$Branch") | Out-Null
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] GitHub push verified." -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

if ($Once) {
    if (Sync-GitChanges) { exit 0 }
    exit 1
}

Write-Host "Auto-push India; branch=$Branch; interval=$IntervalSeconds seconds." -ForegroundColor Cyan
Write-Host "Keep this window open. Press Ctrl+C to stop." -ForegroundColor Yellow
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $PSScriptRoot
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$global:hasChanges = $true
$handler = {
    $name = $Event.SourceEventArgs.Name
    if ($name -notmatch '(^|[\\/])[.]git([\\/]|$)' -and $name -notmatch '(^|[\\/])~[$]' -and $name -notmatch '[.]tmp$') {
        $global:hasChanges = $true
    }
}
$subs = @(
    (Register-ObjectEvent $watcher Changed -Action $handler),
    (Register-ObjectEvent $watcher Created -Action $handler),
    (Register-ObjectEvent $watcher Deleted -Action $handler),
    (Register-ObjectEvent $watcher Renamed -Action $handler)
)
$elapsed = 0
try {
    while ($true) {
        Start-Sleep -Seconds $IntervalSeconds
        $elapsed += $IntervalSeconds
        if ($global:hasChanges -or $elapsed -ge 30) {
            $global:hasChanges = $false
            $elapsed = 0
            Sync-GitChanges | Out-Null
        }
    }
}
finally {
    foreach ($sub in $subs) {
        Unregister-Event -SourceIdentifier $sub.Name -ErrorAction SilentlyContinue
    }
    $watcher.Dispose()
}
