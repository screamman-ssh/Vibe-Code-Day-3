$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$db = 'vibe_code_training'

function Invoke-D1Migration {
    param(
        [string]$Label,
        [string]$File,
        [switch]$Optional
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & npx wrangler d1 execute $db --remote --file=$File
    if ($LASTEXITCODE -ne 0) {
        if ($Optional) {
            Write-Host "   (skipped - likely already applied)" -ForegroundColor Yellow
            return
        }
        throw "Migration failed: $File"
    }
}

Write-Host "Migrating production D1: vibe_code_training" -ForegroundColor Green

Invoke-D1Migration '0001_init' './migrations/0001_init.sql'
Invoke-D1Migration '0002_social' './migrations/0002_social.sql'
Invoke-D1Migration '0002_user_bio (optional)' './migrations/0002_user_bio.sql' -Optional
Invoke-D1Migration '0004_social_repost_columns (optional)' './migrations/0004_social_repost_columns.sql' -Optional
Invoke-D1Migration '0003_social_engagement' './migrations/0003_social_engagement.sql'
Invoke-D1Migration '0005_chat_history' './migrations/0005_chat_history.sql'

Write-Host ""
Write-Host "Production D1 migration complete." -ForegroundColor Green
