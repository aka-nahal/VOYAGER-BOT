# Build script for Windows PowerShell
# Builds Next.js app and generates Android APK

Write-Host "Building Next.js app..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Syncing with Capacitor..." -ForegroundColor Cyan
npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Building APK..." -ForegroundColor Cyan
Set-Location android
.\gradlew.bat assembleRelease

if ($LASTEXITCODE -ne 0) {
    Write-Host "APK build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

Write-Host "`nAPK build complete!" -ForegroundColor Green
Write-Host "APK location: android/app/build/outputs/apk/release/app-release-unsigned.apk" -ForegroundColor Yellow










