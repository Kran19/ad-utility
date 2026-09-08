<#
.SYNOPSIS
  PostgreSQL Database Restore Script for Utility + Ad Platform
#>
param(
  [Parameter(Mandatory=$true)]
  [string]$BackupFile,
  [string]$ContainerName = "ad_utility_postgres",
  [string]$DbUser = "postgres",
  [string]$TargetDb = "ad_utility_db"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupFile)) {
  Write-Error "Backup file does not exist: $BackupFile"
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " Starting PostgreSQL Database Restore" -ForegroundColor Cyan
Write-Host " Container: $ContainerName"
Write-Host " Target DB: $TargetDb"
Write-Host " Backup:    $BackupFile"
Write-Host "=================================================================" -ForegroundColor Cyan

Get-Content -Path $BackupFile -Raw | & docker exec -i $ContainerName psql -U $DbUser -d $TargetDb -v ON_ERROR_STOP=1

Write-Host "=================================================================" -ForegroundColor Green
Write-Host " Database successfully restored into $TargetDb!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
