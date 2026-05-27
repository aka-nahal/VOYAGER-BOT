# Complete rebuild script for Voyager Bot APK
Write-Host "=== Voyager Bot APK Rebuild ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean everything
Write-Host "Step 1: Cleaning build artifacts..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .next, out, android\app\build -ErrorAction SilentlyContinue
Write-Host "✓ Cleaned" -ForegroundColor Green
Write-Host ""

# Step 2: Build Next.js app
Write-Host "Step 2: Building Next.js app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Next.js build complete" -ForegroundColor Green
Write-Host ""

# Step 3: Sync to Android
Write-Host "Step 3: Syncing to Android..." -ForegroundColor Yellow
npx cap sync android
Write-Host "✓ Synced" -ForegroundColor Green
Write-Host ""

# Step 4: Build APK
Write-Host "Step 4: Building Android APK..." -ForegroundColor Yellow
Set-Location android
.\gradlew clean assembleDebug
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ APK build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..
Write-Host "✓ APK build complete" -ForegroundColor Green
Write-Host ""

# Step 5: Show APK location
$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $size = (Get-Item $apkPath).Length / 1MB
    Write-Host "=== BUILD SUCCESSFUL ===" -ForegroundColor Green
    Write-Host "APK Location: $((Get-Item $apkPath).FullName)" -ForegroundColor Cyan
    Write-Host "APK Size: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "IMPORTANT: To see the AI tab:" -ForegroundColor Yellow
    Write-Host "1. Uninstall the old app completely from your device" -ForegroundColor White
    Write-Host "2. Install this new APK" -ForegroundColor White
    Write-Host "3. The AI tab should appear in the bottom navigation" -ForegroundColor White
} else {
    Write-Host "✗ APK not found!" -ForegroundColor Red
}





