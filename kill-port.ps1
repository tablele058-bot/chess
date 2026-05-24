$p = netstat -ano | findstr ':4000 '
$r = [regex]::Match($p, '(\d+)$')
if ($r.Success) { taskkill /F /PID $r.Groups[1].Value }
