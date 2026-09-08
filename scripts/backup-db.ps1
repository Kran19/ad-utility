<#
.SYNOPSIS
  PostgreSQL Database Backup Script for Utility + Ad Platform
#>
param(
  [string]$ContainerName = "ad_utility_postgres",
  [string]$DbUser = "postgres",
  [string]$DbName = "ad_utility_db",
  [string]$OutputDir = "./backups"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFilename = "${DbName}_backup_${timestamp}.sql"
$backupPath = Join-Path $OutputDir $backupFilename

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " Starting PostgreSQL Database Backup" -ForegroundColor Cyan
Write-Host " Container: $ContainerName"
Write-Host " Database:  $DbName"
Write-Host " Target:    $backupPath"
Write-Host "=================================================================" -ForegroundColor Cyan

& docker exec $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges -F p | Set-Content -Path $backupPath -Encoding UTF8

if (Test-Path $backupPath) {
  $size = (Get-Item $backupPath).Length
  Write-Host "=================================================================" -ForegroundColor Green
  Write-Host " Backup created successfully! Size: $size bytes" -ForegroundColor Green
  Write-Host " Path: $backupPath" -ForegroundColor Green
  Write-Host "=================================================================" -ForegroundColor Green
} else {
  Write-Error "Backup failed to generate output file."
}
