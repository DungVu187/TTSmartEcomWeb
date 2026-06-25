# Cấu hình đường dẫn
$BackupRoot = "d:\TTSmartEcomWeb\wdata"
$LogFile = "d:\TTSmartEcomWeb\wdata\backup.log"
$MongoDumpPath = "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe"
$DbName = "test"

# Tạo thư mục backup gốc nếu chưa có
if (!(Test-Path -Path $BackupRoot)) {
    New-Item -ItemType Directory -Force -Path $BackupRoot
}

# Lấy thời gian hiện tại cho tên file
$DateString = Get-Date -Format "yyyy-MM-dd"
$BackupFileName = "${DbName}_${DateString}_ 400.archive"
$BackupFile = Join-Path -Path $BackupRoot -ChildPath $BackupFileName

# Hàm tạo chuỗi log format giống như log mẫu của người dùng
function Get-LogTimestamp {
    return [DateTime]::Now.ToString("ddd MM/dd/yyyy  h:mm:ss.ff", [System.Globalization.CultureInfo]::InvariantCulture)
}

# Ghi log bắt đầu backup
$Time1 = Get-LogTimestamp
$StartMsg = "[INFO] $Time1 - Backing up database `"$DbName`" to `"$BackupFile`""
Write-Output $StartMsg
Add-Content -Path $LogFile -Value $StartMsg

# Chạy mongodump với mode archive
try {
    # Dump ra 1 file archive duy nhất
    & $MongoDumpPath --db $DbName --archive=$BackupFile 2>&1 | Out-Null
    
    # Ghi log hoàn thành backup
    $Time2 = Get-LogTimestamp
    $SuccessMsg = "[INFO] $Time2 - Backup completed!"
    Write-Output $SuccessMsg
    Add-Content -Path $LogFile -Value $SuccessMsg
    
    # Xóa các file archive cũ hơn 7 ngày
    $LimitDate = (Get-Date).AddDays(-7)
    Get-ChildItem -Path $BackupRoot -Filter "test_*.archive" | Where-Object { $_.LastWriteTime -lt $LimitDate } | ForEach-Object {
        Remove-Item -Path $_.FullName -Force
    }
    
    # Ghi log dọn dẹp thành công
    $Time3 = Get-LogTimestamp
    $CleanMsg = "[INFO] $Time3 - Old backups cleaned up."
    Write-Output $CleanMsg
    Add-Content -Path $LogFile -Value $CleanMsg
} catch {
    $TimeErr = Get-LogTimestamp
    $ErrMsg = "[ERROR] $TimeErr - Lỗi khi backup: $_"
    Write-Output $ErrMsg
    Add-Content -Path $LogFile -Value $ErrMsg
}
