# Build APK using Android Studio's Gradle
Write-Host "=== Building Voyager Bot APK ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Next.js
Write-Host "Step 1: Building Next.js app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Sync Capacitor
Write-Host "Step 2: Syncing to Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Web assets built and synced!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Android Studio" -ForegroundColor White
Write-Host "2. File → Open → Select 'frontend\android' folder" -ForegroundColor White
Write-Host "3. Wait for Gradle sync" -ForegroundColor White
Write-Host "4. Build → Build Bundle(s) / APK(s) → Build APK(s)" -ForegroundColor White
Write-Host ""
Write-Host "APK will be in: android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Yellow





