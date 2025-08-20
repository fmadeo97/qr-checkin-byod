param([string]$m = "")

# Asegura que estamos en main
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
  git switch main
}

# Agrega todo
git add -A

# Si no pasaste mensaje, pregunta
if ([string]::IsNullOrWhiteSpace($m)) {
  $m = Read-Host "Commit message"
  if ([string]::IsNullOrWhiteSpace($m)) { $m = "chore: quick deploy" }
}

# Commit si hay cambios
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No changes to commit. Pushing anyway..."
} else {
  git commit -m $m
}

# Push a GitHub (Vercel despliega automáticamente)
git push -u origin main
