param(
    [string]$DbName = "test"
)

$BackupRoot = "d:\TTSmartEcomWeb\wdata"
$LogFile = "d:\TTSmartEcomWeb\wdata\backup.log"
$MongoDumpPath = "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe"

if (!(Test-Path -Path $BackupRoot)) {
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
}

function Get-LogTimestamp {
    return [DateTime]::Now.ToString("ddd MM/dd/yyyy  h:mm:ss.ff", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Write-BackupLog {
    param([string]$Message)
    Write-Output $Message
    Add-Content -Path $LogFile -Value $Message
}

if (!(Test-Path -Path $MongoDumpPath)) {
    $TimeErr = Get-LogTimestamp
    Write-BackupLog "[ERROR] $TimeErr - mongodump.exe not found at `"$MongoDumpPath`". Backup stopped."
    exit 1
}

$DateString = Get-Date -Format "yyyy-MM-dd"
<<<<<<< HEAD
$BackupFileName = "${DbName}_${DateString}_ 400.archive"
=======
$BackupFileName = "${DbName}_${DateString}_ 400.archive.gz"
>>>>>>> 6fb78fc (FINAL)
$BackupFile = Join-Path -Path $BackupRoot -ChildPath $BackupFileName

$Time1 = Get-LogTimestamp
Write-BackupLog "[INFO] $Time1 - Backing up database `"$DbName`" to `"$BackupFile`""
Write-BackupLog "[INFO] Database: $DbName"
Write-BackupLog "[INFO] Archive: $BackupFile"

try {
<<<<<<< HEAD
    & $MongoDumpPath --db $DbName --archive=$BackupFile 2>&1 | Out-Null
=======
    & $MongoDumpPath --db $DbName --archive=$BackupFile --gzip 2>&1 | Out-Null
>>>>>>> 6fb78fc (FINAL)

    if ($LASTEXITCODE -ne 0) {
        throw "mongodump exited with code $LASTEXITCODE"
    }

    if (!(Test-Path -Path $BackupFile)) {
        throw "Backup archive was not created: $BackupFile"
    }

    $BackupSize = (Get-Item -Path $BackupFile).Length
    if ($BackupSize -le 0) {
        throw "Backup archive is empty: $BackupFile"
    }

    $Time2 = Get-LogTimestamp
    Write-BackupLog "[INFO] $Time2 - Backup completed! File size: $BackupSize bytes"

    $LimitDate = (Get-Date).AddDays(-7)
<<<<<<< HEAD
    Get-ChildItem -Path $BackupRoot -Filter "${DbName}_*.archive" | Where-Object { $_.LastWriteTime -lt $LimitDate } | ForEach-Object {
=======
    Get-ChildItem -Path $BackupRoot -Filter "${DbName}_*.archive*" | Where-Object { $_.LastWriteTime -lt $LimitDate } | ForEach-Object {
>>>>>>> 6fb78fc (FINAL)
        Remove-Item -Path $_.FullName -Force
    }

    $Time3 = Get-LogTimestamp
    Write-BackupLog "[INFO] $Time3 - Old backups cleaned up."
} catch {
    $TimeErr = Get-LogTimestamp
    Write-BackupLog "[ERROR] $TimeErr - Backup failed: $_"
    exit 1
}
