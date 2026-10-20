# Creates a "Worksheet Studio" icon on the Desktop that starts the app.
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path $desktop 'Worksheet Studio.lnk'))
$lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$lnk.Arguments = '"' + (Join-Path $root 'start.vbs') + '"'
$lnk.WorkingDirectory = $root
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (Test-Path $edge) { $lnk.IconLocation = "$edge,0" }
$lnk.Description = 'Edit worksheet pictures'
$lnk.Save()
Write-Host '  Desktop icon created.'
