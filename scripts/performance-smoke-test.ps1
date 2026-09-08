# ============================================================
# PHASE 17 — PERFORMANCE & LATENCY SMOKE TEST SCRIPT
# Measures P50, P95, P99, Average Latency, and Throughput
# ============================================================

param (
  [string]$BackendUrl = "http://localhost:4001",
  [int]$Iterations = 20
)

$ErrorActionPreference = "Continue"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " PERFORMANCE & LATENCY SMOKE TEST" -ForegroundColor Cyan
Write-Host " Backend Target: $BackendUrl | Iterations: $Iterations" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

function Measure-EndpointLatency {
  param (
    [string]$Name,
    [string]$Method = "GET",
    [string]$Uri,
    [string]$Body = $null,
    [hashtable]$Headers = @{}
  )

  $latencies = @()
  $successCount = 0
  $failCount = 0

  for ($i = 0; $i -lt $Iterations; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      if ($Method -eq "POST") {
        $res = Invoke-RestMethod -Uri $Uri -Method Post -ContentType "application/json" -Body $Body -Headers $Headers -TimeoutSec 10
      } else {
        $res = Invoke-RestMethod -Uri $Uri -Method Get -Headers $Headers -TimeoutSec 10
      }
      $sw.Stop()
      $latencies += $sw.ElapsedMilliseconds
      $successCount++
    } catch {
      $sw.Stop()
      $latencies += $sw.ElapsedMilliseconds
      $failCount++
    }
  }

  $sorted = $latencies | Sort-Object
  $count = $sorted.Count
  $avg = ($latencies | Measure-Object -Average).Average

  $p50Index = [Math]::Floor($count * 0.50)
  $p95Index = [Math]::Min($count - 1, [Math]::Floor($count * 0.95))
  $p99Index = [Math]::Min($count - 1, [Math]::Floor($count * 0.99))

  $p50 = $sorted[$p50Index]
  $p95 = $sorted[$p95Index]
  $p99 = $sorted[$p99Index]

  [PSCustomObject]@{
    Endpoint = $Name
    Method   = $Method
    Success  = "$successCount/$Iterations"
    AvgMs    = [Math]::Round($avg, 1)
    P50Ms    = $p50
    P95Ms    = $p95
    P99Ms    = $p99
  }
}

$results = @()

Write-Host "1. Benchmarking Health & Readiness Probes..." -ForegroundColor Yellow
$results += Measure-EndpointLatency -Name "/api/v1/health" -Method "GET" -Uri "$BackendUrl/api/v1/health"
$results += Measure-EndpointLatency -Name "/api/v1/health/liveness" -Method "GET" -Uri "$BackendUrl/api/v1/health/liveness"
$results += Measure-EndpointLatency -Name "/api/v1/health/readiness" -Method "GET" -Uri "$BackendUrl/api/v1/health/readiness"

Write-Host "`n2. Benchmarking Public Utility Catalog & Categories..." -ForegroundColor Yellow
$results += Measure-EndpointLatency -Name "/api/v1/utilities" -Method "GET" -Uri "$BackendUrl/api/v1/utilities"
$results += Measure-EndpointLatency -Name "/api/v1/utilities/categories" -Method "GET" -Uri "$BackendUrl/api/v1/utilities/categories"
$results += Measure-EndpointLatency -Name "/api/v1/utilities/case-converter" -Method "GET" -Uri "$BackendUrl/api/v1/utilities/case-converter"

Write-Host "`n3. Benchmarking Utility Execution (Text / Local)..." -ForegroundColor Yellow
$caseConverterBody = @{ input = @{ text = "hello performance testing world"; targetCase = "uppercase" } } | ConvertTo-Json
$results += Measure-EndpointLatency -Name "POST /utilities/case-converter/execute" -Method "POST" -Uri "$BackendUrl/api/v1/utilities/case-converter/execute" -Body $caseConverterBody

$textCleanerBody = @{ input = @{ text = "  clean   up   spaces   and   tabs  " } } | ConvertTo-Json
$results += Measure-EndpointLatency -Name "POST /utilities/text-cleaner/execute" -Method "POST" -Uri "$BackendUrl/api/v1/utilities/text-cleaner/execute" -Body $textCleanerBody

Write-Host "`n4. Benchmarking Ad Engine Slot Delivery..." -ForegroundColor Yellow
$adBody = @{ placement = "HEADER_BANNER"; categorySlug = "developer"; device = "DESKTOP" } | ConvertTo-Json
$results += Measure-EndpointLatency -Name "POST /ads/slot" -Method "POST" -Uri "$BackendUrl/api/v1/ads/slot" -Body $adBody

Write-Host "`n5. Benchmarking AI Gateway Execution (Mock Engine)..." -ForegroundColor Yellow
$aiBody = @{ input = @{ text = "Please paraphrase this performance benchmark sentence." } } | ConvertTo-Json
$results += Measure-EndpointLatency -Name "POST /utilities/ai-paraphraser/execute" -Method "POST" -Uri "$BackendUrl/api/v1/utilities/ai-paraphraser/execute" -Body $aiBody

Write-Host "`n6. Benchmarking Analytics Event Ingestion..." -ForegroundColor Yellow
$analyticsBody = @(
  @{ eventType = "PAGE_VIEW"; utilitySlug = "case-converter"; timestamp = (Get-Date).ToString("o") }
) | ConvertTo-Json
$results += Measure-EndpointLatency -Name "POST /analytics/events" -Method "POST" -Uri "$BackendUrl/api/v1/analytics/events" -Body $analyticsBody

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " PERFORMANCE BENCHMARK SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
$results | Format-Table -AutoSize

Write-Host "`nPerformance Benchmark Completed Successfully.`n" -ForegroundColor Green
