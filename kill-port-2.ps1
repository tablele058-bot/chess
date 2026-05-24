$connections = netstat -ano | Select-String ":4000 "
$connections | ForEach-Object {
    $line = $_.ToString()
    $parts = $line -split '\s+'
    $pid = $parts[-1]
    taskkill /F /PID $pid 2>$null
}
