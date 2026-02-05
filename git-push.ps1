# Git Auto Push Script
# Usage: npm run git:push

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host ""
Write-Host "========================================"
Write-Host "   Git Auto Push - QingCheng"
Write-Host "========================================"
Write-Host ""

$status = git status --porcelain
if (-not $status) {
    Write-Host "[OK] No changes to commit, already up to date!"
    exit 0
}

Write-Host "Changed files:"
git status --short
Write-Host ""

Write-Host "Adding all changes..."
git add .

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Update - $timestamp"

Write-Host "Committing..."
git commit -m $commitMessage

Write-Host "Pushing to GitHub..."
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "   [SUCCESS] Code pushed to GitHub!"
    Write-Host "========================================"
} else {
    Write-Host ""
    Write-Host "[ERROR] Push failed!"
}
