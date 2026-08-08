Write-Host ""
Write-Host "Matchday Desktop - Git Setup"
Write-Host "============================"
Write-Host ""

if (-not (Test-Path ".git")) {
    git init
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

git branch -M main
git add .
git status

Write-Host ""
Write-Host "Review the files above."
Write-Host ""
Write-Host 'When ready, run:'
Write-Host '  git commit -m "Initial Matchday Desktop platform"'
Write-Host ""
Write-Host "Then create an empty GitHub repo and add its remote."
