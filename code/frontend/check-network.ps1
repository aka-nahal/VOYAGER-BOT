# Check and configure Windows Firewall for Next.js dev server
Write-Host "Checking Windows Firewall rules for port 3000..." -ForegroundColor Cyan

# Check if rule exists
$rule = Get-NetFirewallRule -DisplayName "Next.js Dev Server" -ErrorAction SilentlyContinue

if ($rule) {
    Write-Host "Firewall rule already exists." -ForegroundColor Green
} else {
    Write-Host "Creating firewall rule..." -ForegroundColor Yellow
    New-NetFirewallRule -DisplayName "Next.js Dev Server" `
        -Direction Inbound `
        -LocalPort 3000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Domain,Private,Public
    
    Write-Host "Firewall rule created successfully!" -ForegroundColor Green
}

# Show current rules for port 3000
Write-Host "`nCurrent firewall rules for port 3000:" -ForegroundColor Cyan
Get-NetFirewallRule | Where-Object { $_.DisplayName -like "*3000*" -or $_.DisplayName -like "*Next.js*" } | Format-Table DisplayName, Enabled, Direction, Action

Write-Host "`nTo manually allow port 3000:" -ForegroundColor Yellow
Write-Host "1. Open Windows Defender Firewall" -ForegroundColor White
Write-Host "2. Advanced Settings > Inbound Rules > New Rule" -ForegroundColor White
Write-Host "3. Port > TCP > Specific local ports: 3000" -ForegroundColor White
Write-Host "4. Allow the connection > Apply to all profiles" -ForegroundColor White

