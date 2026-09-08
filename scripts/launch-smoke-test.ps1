<#
.SYNOPSIS
  Phase 13 Launch Smoke Test Script (PowerShell)
.DESCRIPTION
  Performs complete automated verification of the platform before public launch:
  1. Backend Health & Split Probes (/health, /liveness, /readiness)
  2. Frontend Public & SEO Routes (Homepage, Robots, Sitemap, Category, Utility)
  3. Security Boundaries (Unauthenticated Admin 401)
  4. Representative Utility Execution (Deterministic transform)
  5. Ad Engine Slot Delivery (Fallback / House ad verification)
  6. Ad Impression & Click Flow (HMAC token verification)
  7. Telemetry & Analytics Funnel Ingestion
#>

[CmdletBinding()]
param(
  [string]$FrontendUrl = "http://localhost:3001",
  [string]$BackendUrl = "http://localhost:4001"
)

$ErrorActionPreference = "Continue"
$passedCount = 0
$failedCount = 0
$results = @()

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Category,
    [scriptblock]$TestBlock
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $result = & $TestBlock
    $sw.Stop()
    $duration = "$($sw.ElapsedMilliseconds)ms"
    if ($result.Success) {
      $script:passedCount++
      $script:results += [PSCustomObject]@{
        Category = $Category
        TestName = $Name
        Status   = "PASS"
        Duration = $duration
        Details  = $result.Details
      }
      Write-Host "  [PASS] $Name ($duration) - $($result.Details)" -ForegroundColor Green
    } else {
      $script:failedCount++
      $script:results += [PSCustomObject]@{
        Category = $Category
        TestName = $Name
        Status   = "FAIL"
        Duration = $duration
        Details  = $result.Details
      }
      Write-Host "  [FAIL] $Name ($duration) - $($result.Details)" -ForegroundColor Red
    }
  } catch {
    $sw.Stop()
    $duration = "$($sw.ElapsedMilliseconds)ms"
    $script:failedCount++
    $script:results += [PSCustomObject]@{
      Category = $Category
      TestName = $Name
      Status   = "ERROR"
      Duration = $duration
      Details  = $_.Exception.Message
    }
    Write-Host "  [ERROR] $Name ($duration) - $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " STARTING PLATFORM LAUNCH SMOKE TESTS" -ForegroundColor Cyan
Write-Host " Frontend: $FrontendUrl" -ForegroundColor Cyan
Write-Host " Backend:  $BackendUrl" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# -------------------------------------------------------------
# 1. Health & Probes
# -------------------------------------------------------------
Write-Host "`n1. Observability & Health Probes..." -ForegroundColor Yellow

Test-Endpoint -Category "Observability" -Name "GET /api/v1/health" -TestBlock {
  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/health" -Method Get
  if ($res.success -and $res.data.status -eq "ok") {
    return @{ Success = $true; Details = "Service: $($res.data.service), Env: $($res.data.environment)" }
  }
  return @{ Success = $false; Details = "Unexpected payload" }
}

Test-Endpoint -Category "Observability" -Name "GET /api/v1/health/liveness" -TestBlock {
  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/health/liveness" -Method Get
  if ($res.success -and $res.data.status -eq "alive" -and $res.data.uptimeSeconds -ge 0) {
    return @{ Success = $true; Details = "Uptime: $($res.data.uptimeSeconds)s" }
  }
  return @{ Success = $false; Details = "Status not alive" }
}

Test-Endpoint -Category "Observability" -Name "GET /api/v1/health/readiness" -TestBlock {
  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/health/readiness" -Method Get
  if ($res.success -and $res.data.status -eq "ready" -and $res.data.database -eq "connected") {
    return @{ Success = $true; Details = "Database connected" }
  }
  return @{ Success = $false; Details = "Readiness check failed" }
}

# -------------------------------------------------------------
# 2. Public Frontend & SEO Routes
# -------------------------------------------------------------
Write-Host "`n2. Public Frontend & SEO Routes..." -ForegroundColor Yellow

Test-Endpoint -Category "Frontend" -Name "GET / (Homepage)" -TestBlock {
  $res = Invoke-WebRequest -Uri "$FrontendUrl/" -UseBasicParsing
  if ($res.StatusCode -eq 200 -and $res.Content.Length -gt 100) {
    return @{ Success = $true; Details = "HTTP 200, Content Length: $($res.Content.Length)" }
  }
  return @{ Success = $false; Details = "Status $($res.StatusCode)" }
}

Test-Endpoint -Category "Frontend" -Name "GET /robots.txt" -TestBlock {
  $res = Invoke-WebRequest -Uri "$FrontendUrl/robots.txt" -UseBasicParsing
  if ($res.StatusCode -eq 200 -and $res.Content -match "User-agent") {
    return @{ Success = $true; Details = "HTTP 200, Robots directives present" }
  }
  return @{ Success = $false; Details = "Robots missing User-agent" }
}

Test-Endpoint -Category "Frontend" -Name "GET /sitemap.xml" -TestBlock {
  $res = Invoke-WebRequest -Uri "$FrontendUrl/sitemap.xml" -UseBasicParsing
  if ($res.StatusCode -eq 200 -and $res.Content -match "<urlset") {
    return @{ Success = $true; Details = "HTTP 200, XML sitemap valid" }
  }
  return @{ Success = $false; Details = "Sitemap missing urlset" }
}

Test-Endpoint -Category "Frontend" -Name "GET /category/image" -TestBlock {
  $res = Invoke-WebRequest -Uri "$FrontendUrl/category/image" -UseBasicParsing
  if ($res.StatusCode -eq 200) {
    return @{ Success = $true; Details = "HTTP 200, Category directory rendered" }
  }
  return @{ Success = $false; Details = "Status $($res.StatusCode)" }
}

Test-Endpoint -Category "Frontend" -Name "GET /case-converter (Utility Tool Page)" -TestBlock {
  $res = Invoke-WebRequest -Uri "$FrontendUrl/case-converter" -UseBasicParsing
  if ($res.StatusCode -eq 200) {
    return @{ Success = $true; Details = "HTTP 200, Tool shell rendered" }
  }
  return @{ Success = $false; Details = "Status $($res.StatusCode)" }
}

# -------------------------------------------------------------
# 3. Security Boundaries
# -------------------------------------------------------------
Write-Host "`n3. Security & Access Boundaries..." -ForegroundColor Yellow

Test-Endpoint -Category "Security" -Name "GET /api/v1/admin/users without token" -TestBlock {
  try {
    $res = Invoke-WebRequest -Uri "$BackendUrl/api/v1/admin/users" -UseBasicParsing
    return @{ Success = $false; Details = "Expected 401, got $($res.StatusCode)" }
  } catch {
    if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::Unauthorized) {
      return @{ Success = $true; Details = "HTTP 401 Unauthorized correctly enforced" }
    }
    return @{ Success = $false; Details = "Unexpected error: $($_.Exception.Message)" }
  }
}

Test-Endpoint -Category "Security" -Name "GET /api/v1/admin/ads/campaigns without token" -TestBlock {
  try {
    $res = Invoke-WebRequest -Uri "$BackendUrl/api/v1/admin/ads/campaigns" -UseBasicParsing
    return @{ Success = $false; Details = "Expected 401, got $($res.StatusCode)" }
  } catch {
    if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::Unauthorized) {
      return @{ Success = $true; Details = "HTTP 401 Unauthorized correctly enforced" }
    }
    return @{ Success = $false; Details = "Unexpected error: $($_.Exception.Message)" }
  }
}

# -------------------------------------------------------------
# 4. Representative Utility Execution
# -------------------------------------------------------------
Write-Host "`n4. Representative Utility Execution..." -ForegroundColor Yellow

Test-Endpoint -Category "Utility" -Name "GET /api/v1/utilities/case-converter (Public Metadata)" -TestBlock {
  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/utilities/case-converter" -Method Get
  if ($res.success -and $res.data.slug -eq "case-converter" -and $res.data.status -eq "ACTIVE") {
    return @{ Success = $true; Details = "Tool: $($res.data.name), Mode: $($res.data.implementationMode)" }
  }
  return @{ Success = $false; Details = "Unexpected metadata payload" }
}

Test-Endpoint -Category "Utility" -Name "POST /api/v1/utilities/ai-paraphraser/execute (Offline AI Execution)" -TestBlock {
  $body = @{
    input = @{
      text = "Phase 13 production launch readiness verified."
    }
  } | ConvertTo-Json

  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/utilities/ai-paraphraser/execute" -Method Post -ContentType "application/json" -Body $body
  if ($res.success -and $res.data.result.paraphrasedText -and $res.data.requestId) {
    return @{ Success = $true; Details = "Execution ID: $($res.data.requestId), Mode: $($res.data.mode)" }
  }
  return @{ Success = $false; Details = "Execution failed" }
}

# -------------------------------------------------------------
# 5. Ad Delivery, Impression & Click Flow
# -------------------------------------------------------------
Write-Host "`n5. Monetization & Ad Engine..." -ForegroundColor Yellow

$global:smokeTrackingToken = $null

Test-Endpoint -Category "Monetization" -Name "POST /api/v1/ads/slot (Delivery)" -TestBlock {
  $body = @{
    placement = "HEADER_BANNER"
    categorySlug = "developer"
    device = "DESKTOP"
  } | ConvertTo-Json

  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/ads/slot" -Method Post -ContentType "application/json" -Body $body
  if ($res.success -and $res.data.hasAd -and $res.data.creative.trackingToken) {
    $global:smokeTrackingToken = $res.data.creative.trackingToken
    return @{ Success = $true; Details = "Ad delivered. Tier: $($res.data.fallbackTier), Type: $($res.data.creative.type)" }
  }
  return @{ Success = $false; Details = "No ad delivered for HEADER_BANNER" }
}

Test-Endpoint -Category "Monetization" -Name "POST /api/v1/ads/impression (Viewability Recording)" -TestBlock {
  if (-not $global:smokeTrackingToken) {
    return @{ Success = $false; Details = "Missing tracking token from ad delivery" }
  }

  $body = @{
    trackingToken = $global:smokeTrackingToken
    placement = "HEADER_BANNER"
    device = "DESKTOP"
  } | ConvertTo-Json

  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/ads/impression" -Method Post -ContentType "application/json" -Body $body
  if ($res.success -and $res.data.recorded) {
    return @{ Success = $true; Details = "Impression verified & recorded in DB" }
  }
  return @{ Success = $false; Details = "Impression recording failed" }
}

Test-Endpoint -Category "Monetization" -Name "POST /api/v1/ads/click (Authoritative Click Flow)" -TestBlock {
  if (-not $global:smokeTrackingToken) {
    return @{ Success = $false; Details = "Missing tracking token from ad delivery" }
  }

  $body = @{
    trackingToken = $global:smokeTrackingToken
    placement = "HEADER_BANNER"
    device = "DESKTOP"
  } | ConvertTo-Json

  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/ads/click" -Method Post -ContentType "application/json" -Body $body
  if ($res.success -and $res.data.destinationUrl -match "^https?://") {
    return @{ Success = $true; Details = "Click verified. Destination: $($res.data.destinationUrl)" }
  }
  return @{ Success = $false; Details = "Click failed or invalid destination" }
}

# -------------------------------------------------------------
# 6. Telemetry & Funnel Ingestion
# -------------------------------------------------------------
Write-Host "`n6. Telemetry & Analytics Funnel..." -ForegroundColor Yellow

Test-Endpoint -Category "Analytics" -Name "POST /api/v1/analytics/events (Batch Funnel Ingestion)" -TestBlock {
  $testSession = "smoke_sess_" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
  $events = @(
    @{
      eventId = "evt_smoke_1_" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
      eventType = "PAGE_VIEW"
      utilitySlug = "case-converter"
      sessionToken = $testSession
      timestamp = (Get-Date).ToUniversalTime().ToString("o")
    },
    @{
      eventId = "evt_smoke_2_" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
      eventType = "TOOL_START"
      utilitySlug = "case-converter"
      sessionToken = $testSession
      timestamp = (Get-Date).ToUniversalTime().ToString("o")
    },
    @{
      eventId = "evt_smoke_3_" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
      eventType = "TOOL_COMPLETE"
      utilitySlug = "case-converter"
      sessionToken = $testSession
      metadata = @{ executionTimeMs = 42 }
      timestamp = (Get-Date).ToUniversalTime().ToString("o")
    }
  )

  $body = $events | ConvertTo-Json
  $res = Invoke-RestMethod -Uri "$BackendUrl/api/v1/analytics/events" -Method Post -ContentType "application/json" -Body $body
  if ($res.success -and $res.data.received -eq 3 -and $res.data.accepted -eq 3) {
    return @{ Success = $true; Details = "Ingested 3 events (PAGE_VIEW -> TOOL_START -> TOOL_COMPLETE)" }
  }
  return @{ Success = $false; Details = "Telemetry batch failed: $($res.data.accepted)/$($res.data.received) accepted" }
}

# -------------------------------------------------------------
# Summary
# -------------------------------------------------------------
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " LAUNCH SMOKE TEST SUMMARY" -ForegroundColor Cyan
Write-Host " Total Tests: $($passedCount + $failedCount) | Passed: $passedCount | Failed: $failedCount" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$results | Format-Table -Property Category, TestName, Status, Duration, Details -AutoSize

if ($failedCount -eq 0) {
  Write-Host "`nALL LAUNCH SMOKE TESTS PASSED! Platform is operational for launch." -ForegroundColor Green
  exit 0
} else {
  Write-Host "`nLAUNCH SMOKE TESTS FAILED! Review failing endpoints before launching." -ForegroundColor Red
  exit 1
}
