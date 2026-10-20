# auto-push.ps1
param(
    [int]$IntervalSeconds = 3,
    [string]$Branch = "main"
)

Set-Location -Path $PSScriptRoot

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   Git Auto-Push Watcher Aktif                   " -ForegroundColor Cyan
Write-Host "   Direktori: $PSScriptRoot                      " -ForegroundColor DarkGray
Write-Host "   Branch   : $Branch                            " -ForegroundColor DarkGray
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Memantau perubahan file secara realtime..." -ForegroundColor Yellow
Write-Host "Tekan Ctrl+C untuk menghentikan pemantauan.`n" -ForegroundColor Yellow

function Sync-GitChanges {
    try {
        $status = git status --porcelain 2>&1
        if ($status) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Perubahan terdeteksi:" -ForegroundColor Green
            $status | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }

            # Debounce singkat agar program penyimpan file (misal Word) selesai menulis
            Start-Sleep -Seconds 2

            git add -A
            $diffCheck = git diff --staged --name-only
            if ($diffCheck) {
                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                $commitMsg = "Auto-update: $timestamp"

                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Melakukan commit: '$commitMsg'..." -ForegroundColor Cyan
                git commit -m $commitMsg

                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Melakukan push ke origin $Branch..." -ForegroundColor Cyan
                $pushOutput = git push origin $Branch 2>&1
                Write-Host $pushOutput -ForegroundColor Gray
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Push berhasil!`n" -ForegroundColor Green
            }
        }
    }
    catch {
        Write-Host "[ERROR] Terjadi kesalahan: $_" -ForegroundColor Red
    }
}

# Lakukan sinkronisasi awal jika ada perubahan tertunda
Sync-GitChanges

$global:hasChanges = $false

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $PSScriptRoot
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

$eventHandler = {
    $name = $Event.SourceEventArgs.Name
    # Abaikan perubahan di direktori .git atau file sementara Word (~$)
    if ($name -notmatch '^\.git' -and $name -notmatch '^~\$' -and $name -notmatch '\.tmp$') {
        $global:hasChanges = $true
    }
}

$subChanged = Register-ObjectEvent $watcher "Changed" -Action $eventHandler
$subCreated = Register-ObjectEvent $watcher "Created" -Action $eventHandler
$subDeleted = Register-ObjectEvent $watcher "Deleted" -Action $eventHandler
$subRenamed = Register-ObjectEvent $watcher "Renamed" -Action $eventHandler

$tickCount = 0

try {
    while ($true) {
        Start-Sleep -Seconds $IntervalSeconds
        $tickCount += $IntervalSeconds

        # Jika ada event dari watcher ATAU cek berkala tiap 30 detik
        if ($global:hasChanges -or ($tickCount -ge 30)) {
            $global:hasChanges = $false
            $tickCount = 0
            Sync-GitChanges
        }
    }
}
finally {
    Unregister-Event -SourceIdentifier $subChanged.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $subCreated.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $subDeleted.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $subRenamed.Name -ErrorAction SilentlyContinue
    $watcher.Dispose()
    Write-Host "`nAuto-push watcher telah dinonaktifkan." -ForegroundColor Yellow
}
