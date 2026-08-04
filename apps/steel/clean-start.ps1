# Limpia todo y arranca el programa
Write-Host "Limpiando cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -Filter *.tsbuildinfo | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Compilando..." -ForegroundColor Yellow
npm run build

Write-Host "Arrancando servidor..." -ForegroundColor Green
npx vite preview --host
