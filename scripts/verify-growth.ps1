$ErrorActionPreference = "Stop"
$login = Invoke-RestMethod -Uri "http://localhost:4001/api/v1/auth/login" -Method Post -Body '{"email":"admin@adplatform.local","password":"AdminSecurePassword123!"}' -ContentType "application/json"
$token = $login.data.accessToken
$headers = @{ Authorization = "Bearer $token" }

$growth = Invoke-RestMethod -Uri "http://localhost:4001/api/v1/admin/analytics/growth?days=30" -Headers $headers
Write-Host "Growth API success:" $growth.success
Write-Host "Funnel stages count:" $growth.data.funnel.stages.Count
Write-Host "Top of funnel pageViews:" $growth.data.funnel.pageViews
Write-Host "End of funnel resultDownloads:" $growth.data.funnel.resultDownloads
Write-Host "Overall conversion rate:" $growth.data.funnel.overallConversionRate"%"
Write-Host "Tracked utilities count:" $growth.data.utilities.Count
Write-Host "Active experiments count:" $growth.data.experiments.Count
Write-Host "Ad placements performance count:" $growth.data.monetization.placementPerformance.Count

$exp = Invoke-RestMethod -Uri "http://localhost:4001/api/v1/admin/analytics/experiments" -Headers $headers
Write-Host "Experiments API success:" $exp.success
Write-Host "Registered experiments:" $exp.data.Count
