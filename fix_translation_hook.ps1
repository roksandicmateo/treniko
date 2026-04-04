# fix_translation_hook.ps1
# Fixes components where the script incorrectly inserted the hook inside function params
# Run from treniko\ folder:
#   powershell -ExecutionPolicy Bypass -File fix_translation_hook.ps1

$FrontendSrc = "frontend\src"
$badPattern  = "const { t } = useTranslation(); "
$hookLine    = "`n  const { t } = useTranslation();"
$fixed_count = 0

$files = Get-ChildItem -Path $FrontendSrc -Recurse -Include "*.jsx","*.js" |
    Where-Object { $_.FullName -notmatch "node_modules|locales" }

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)

    if (-not $content.Contains($badPattern)) { continue }

    # Remove the misplaced hook from inside the params
    $fixed = $content.Replace($badPattern, "")

    # Now insert the hook correctly — after the first opening { of the function body
    # Find "}) {" or "} ) {" or simple ") {" that closes the params
    $insertMarker = ") {"
    $idx = $fixed.IndexOf($insertMarker)
    if ($idx -ge 0) {
        $insertAt = $idx + $insertMarker.Length
        $fixed = $fixed.Substring(0, $insertAt) + $hookLine + $fixed.Substring($insertAt)
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($file.FullName, $fixed, $utf8NoBom)
    Write-Host "Fixed: $($file.Name)" -ForegroundColor Green
    $fixed_count++
}

if ($fixed_count -eq 0) {
    Write-Host "No broken files found." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "$fixed_count file(s) fixed." -ForegroundColor Cyan
}
