[CmdletBinding()]
param(
    [string]$ContainerName = "kd-postgres",
    [string]$LocalDatabaseUser = "kd_user",
    [string]$LocalDatabaseName = "kd_app",
    [string]$ProductionAdminImage = "postgres:17-alpine"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ======================================================
# PATHS AND STATE
# ======================================================

$script:ProjectRoot = Split-Path -Parent $PSScriptRoot
$script:BackupDirectory = Join-Path $script:ProjectRoot "db-backups"
$script:Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$script:LocalContainerDump =
    "/tmp/kd-local-to-production-$($script:Timestamp).dump"

$script:LocalHostDump =
    Join-Path `
        $script:BackupDirectory `
        "kd-local-$($script:Timestamp).dump"

$script:ProductionHostBackup =
    Join-Path `
        $script:BackupDirectory `
        "kd-production-before-reset-$($script:Timestamp).dump"

$script:LocalDumpFileName =
    Split-Path -Leaf $script:LocalHostDump

$script:ProductionBackupFileName =
    Split-Path -Leaf $script:ProductionHostBackup

$script:ProductionAdminImage = $ProductionAdminImage
$script:ProductionUrl = $null
$script:BackupMount = $null
$script:ProductionSchemaDropped = $false
$script:ReplacementVerified = $false

$previousProdUrl =
    [Environment]::GetEnvironmentVariable(
        "PROD_URL",
        "Process"
    )

# ======================================================
# SQL
# ======================================================

$script:DropPublicSchemaSql = @'
SET lock_timeout = '30s';
SET statement_timeout = '5min';

DROP SCHEMA IF EXISTS public CASCADE;
'@

$script:ConnectionCheckSql = @'
SELECT
    current_database() AS database_name,
    current_user AS database_user,
    current_setting('server_version') AS server_version;
'@

$script:CountsSql = @'
SELECT json_build_object(
    'Restaurant',        (SELECT COUNT(*) FROM "Restaurant"),
    'User',              (SELECT COUNT(*) FROM "User"),
    'Category',          (SELECT COUNT(*) FROM "Category"),
    'MenuItem',          (SELECT COUNT(*) FROM "MenuItem"),
    'InventoryItem',     (SELECT COUNT(*) FROM "InventoryItem"),
    'Order',             (SELECT COUNT(*) FROM "Order"),
    'Bill',              (SELECT COUNT(*) FROM "Bill"),
    'BillPayment',       (SELECT COUNT(*) FROM "BillPayment"),
    'BillRefund',        (SELECT COUNT(*) FROM "BillRefund"),
    'Wastage',           (SELECT COUNT(*) FROM "Wastage"),
    '_prisma_migrations',(SELECT COUNT(*) FROM "_prisma_migrations")
)::text;
'@

$script:AnalyzeSql = @'
ANALYZE;
'@

$script:CountProperties = @(
    "Restaurant",
    "User",
    "Category",
    "MenuItem",
    "InventoryItem",
    "Order",
    "Bill",
    "BillPayment",
    "BillRefund",
    "Wastage",
    "_prisma_migrations"
)

# ======================================================
# HELPERS
# ======================================================

function Assert-LastExitCode {
    param(
        [Parameter(Mandatory)]
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

function Assert-FileExistsAndNotEmpty {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description was not created: $Path"
    }

    $file = Get-Item -LiteralPath $Path

    if ($file.Length -le 0) {
        throw "$Description is empty: $Path"
    }
}

function Invoke-Docker {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,

        [Parameter(Mandatory)]
        [string]$Step
    )

    & docker @Arguments
    Assert-LastExitCode -Step $Step
}

function Invoke-DockerCapture {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,

        [Parameter(Mandatory)]
        [string]$Step
    )

    $output = @(
        & docker @Arguments 2>&1
    )

    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw @"
$Step failed with exit code $exitCode.

$($output -join "`n")
"@
    }

    return $output
}

function Assert-ArchiveContainsKitchenDiaries {
    param(
        [Parameter(Mandatory)]
        [string]$ArchiveListText
    )

    $requiredTables = [ordered]@{
        "_prisma_migrations" =
            '(?im)\bTABLE\b\s+public\s+_prisma_migrations\b'

        "Restaurant" =
            '(?im)\bTABLE\b\s+public\s+Restaurant\b'

        "User" =
            '(?im)\bTABLE\b\s+public\s+User\b'

        "Order" =
            '(?im)\bTABLE\b\s+public\s+Order\b'

        "Bill" =
            '(?im)\bTABLE\b\s+public\s+Bill\b'
    }

    foreach ($requiredTable in $requiredTables.GetEnumerator()) {
        if ($ArchiveListText -notmatch $requiredTable.Value) {
            throw @"
The local dump is missing the required table:
$($requiredTable.Key)

Production was not changed.
"@
        }
    }
}

function Get-ArchiveListText {
    param(
        [Parameter(Mandatory)]
        [string]$ArchiveFileName,

        [Parameter(Mandatory)]
        [string]$Step
    )

    $arguments = @(
        "run",
        "--rm",
        "--mount",
        $script:BackupMount,
        $script:ProductionAdminImage,
        "pg_restore",
        "--list",
        "/backup/$ArchiveFileName"
    )

    $output =
        Invoke-DockerCapture `
            -Arguments $arguments `
            -Step $Step

    return ($output -join "`n")
}

function Read-ProductionDatabaseUrl {
    Write-Host ""
    Write-Host "Open the production Supabase project."
    Write-Host "Choose Connect -> Session pooler."
    Write-Host "Use the PostgreSQL URI on port 5432."
    Write-Host ""
    Write-Host "Paste the URI at the hidden prompt below."
    Write-Host "The value will not be printed."
    Write-Host ""

    $secureValue =
        Read-Host `
            "Production DIRECT_URL" `
            -AsSecureString

    $pointer =
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
            $secureValue
        )

    try {
        $plainValue =
            [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
                $pointer
            )
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
            $pointer
        )
    }

    if ($null -eq $plainValue) {
        throw "No production database URL was provided."
    }

    $plainValue = $plainValue.Trim()

    if ([string]::IsNullOrWhiteSpace($plainValue)) {
        throw "No production database URL was provided."
    }

    if ($plainValue -match "\[YOUR-PASSWORD\]") {
        throw "The connection string still contains [YOUR-PASSWORD]."
    }

    return $plainValue
}

function Assert-ProductionDatabaseUrl {
    param(
        [Parameter(Mandatory)]
        [string]$Url
    )

    try {
        $uri = [System.Uri]$Url
    }
    catch {
        throw "The supplied production value is not a valid PostgreSQL URL."
    }

    if ($uri.Scheme -notin @("postgres", "postgresql")) {
        throw "The supplied value is not a PostgreSQL URL."
    }

    if ($uri.Host -eq "localhost") {
        throw "Refusing to use localhost as the production target."
    }

    $isSupabasePooler =
        $uri.Host -match "(^|\.)pooler\.supabase\.com$"

    $isSupabaseDirect =
        $uri.Host -match "^db\.[a-z0-9]+\.supabase\.co$"

    if (-not $isSupabasePooler -and -not $isSupabaseDirect) {
        throw "The target is not a recognised Supabase database host: $($uri.Host)"
    }

    if ($uri.Port -ne 5432) {
        throw "Use the Supabase Session pooler or direct URL on port 5432. Detected port: $($uri.Port)"
    }

    if (
        [string]::IsNullOrWhiteSpace($uri.UserInfo) -or
        $uri.UserInfo -notmatch ":"
    ) {
        throw "The production URL does not contain database credentials."
    }

    $databaseName = $uri.AbsolutePath.TrimStart("/")

    if ([string]::IsNullOrWhiteSpace($databaseName)) {
        throw "The production URL does not contain a database name."
    }

    $username = ($uri.UserInfo -split ":", 2)[0]
    $projectReference = "unknown"

    if ($username -match "^postgres\.(.+)$") {
        $projectReference = $Matches[1]
    }

    Write-Host ""
    Write-Host "Production target verified:"
    Write-Host "Host:        $($uri.Host)"
    Write-Host "Port:        $($uri.Port)"
    Write-Host "Database:    $databaseName"
    Write-Host "Project ref: $projectReference"
    Write-Host ""

    return $uri
}

function Invoke-LocalSqlCapture {
    param(
        [Parameter(Mandatory)]
        [string]$Sql,

        [Parameter(Mandatory)]
        [string]$Step
    )

    $arguments = @(
        "exec",
        "-i",
        $ContainerName,
        "psql",
        "--username=$LocalDatabaseUser",
        "--dbname=$LocalDatabaseName",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-A",
        "-t"
    )

    $output = @(
        $Sql |
            & docker @arguments 2>&1
    )

    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw @"
$Step failed with exit code $exitCode.

$($output -join "`n")
"@
    }

    return (($output -join "`n").Trim())
}

function Invoke-ProductionSqlCapture {
    param(
        [Parameter(Mandatory)]
        [string]$Sql,

        [Parameter(Mandatory)]
        [string]$Step
    )

    $arguments = @(
        "run",
        "--rm",
        "-i",
        "--env",
        "PROD_URL",
        "--env",
        "PGCONNECT_TIMEOUT=20",
        "--env",
        "PGOPTIONS=-c statement_timeout=300000 -c lock_timeout=30000",
        $script:ProductionAdminImage,
        "sh",
        "-lc",
        'psql "$PROD_URL" -X -v ON_ERROR_STOP=1 -A -t -P pager=off'
    )

    $output = @(
        $Sql |
            & docker @arguments 2>&1
    )

    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw @"
$Step failed with exit code $exitCode.

$($output -join "`n")
"@
    }

    return (($output -join "`n").Trim())
}

function Invoke-ProductionSql {
    param(
        [Parameter(Mandatory)]
        [string]$Sql,

        [Parameter(Mandatory)]
        [string]$Step
    )

    $arguments = @(
        "run",
        "--rm",
        "-i",
        "--env",
        "PROD_URL",
        "--env",
        "PGCONNECT_TIMEOUT=20",
        "--env",
        "PGOPTIONS=-c statement_timeout=300000 -c lock_timeout=30000",
        $script:ProductionAdminImage,
        "sh",
        "-lc",
        'psql "$PROD_URL" -X -v ON_ERROR_STOP=1 -P pager=off'
    )

    $Sql |
        & docker @arguments

    Assert-LastExitCode -Step $Step
}

function Invoke-ProductionRestore {
    param(
        [Parameter(Mandatory)]
        [string]$ArchiveFileName,

        [Parameter(Mandatory)]
        [string]$Step
    )

    $arguments = @(
        "run",
        "--rm",
        "--mount",
        $script:BackupMount,
        "--env",
        "PROD_URL",
        "--env",
        "PGCONNECT_TIMEOUT=20",
        "--env",
        "DUMP_FILE=/backup/$ArchiveFileName",
        $script:ProductionAdminImage,
        "sh",
        "-lc",
        'pg_restore --dbname="$PROD_URL" --no-owner --no-privileges --exit-on-error --single-transaction "$DUMP_FILE"'
    )

    Invoke-Docker `
        -Arguments $arguments `
        -Step $Step
}

function Convert-CountsJson {
    param(
        [Parameter(Mandatory)]
        [string]$Json,

        [Parameter(Mandatory)]
        [string]$Source
    )

    try {
        return ($Json | ConvertFrom-Json)
    }
    catch {
        throw @"
Could not parse record counts returned by $Source.

Returned value:
$Json
"@
    }
}

function Show-Counts {
    param(
        [Parameter(Mandatory)]
        [object]$Counts,

        [Parameter(Mandatory)]
        [string]$Title
    )

    Write-Host ""
    Write-Host $Title

    $rows =
        foreach ($propertyName in $script:CountProperties) {
            [PSCustomObject]@{
                Table = $propertyName
                Rows  = [Int64]$Counts.$propertyName
            }
        }

    $rows |
        Format-Table -AutoSize |
        Out-Host
}

function Assert-CountsMatch {
    param(
        [Parameter(Mandatory)]
        [object]$LocalCounts,

        [Parameter(Mandatory)]
        [object]$ProductionCounts
    )

    $mismatches = @()

    foreach ($propertyName in $script:CountProperties) {
        $localValue =
            [Int64]$LocalCounts.$propertyName

        $productionValue =
            [Int64]$ProductionCounts.$propertyName

        if ($localValue -ne $productionValue) {
            $mismatches +=
                "$propertyName local=$localValue production=$productionValue"
        }
    }

    if ($mismatches.Count -gt 0) {
        throw @"
Production verification failed because record counts do not match local Docker.

$($mismatches -join "`n")
"@
    }
}

# ======================================================
# PRE-FLIGHT
# ======================================================

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is not installed or is unavailable in PATH."
}

$containerState =
    Invoke-DockerCapture `
        -Arguments @(
            "inspect",
            "--format",
            "{{.State.Running}}",
            $ContainerName
        ) `
        -Step "Checking local PostgreSQL container"

if (($containerState -join "").Trim() -ne "true") {
    throw "Docker container '$ContainerName' is not running."
}

New-Item `
    -ItemType Directory `
    -Path $script:BackupDirectory `
    -Force |
    Out-Null

$resolvedBackupDirectory =
    (Resolve-Path -LiteralPath $script:BackupDirectory).Path

$dockerBackupDirectory =
    $resolvedBackupDirectory.Replace("\", "/")

$script:BackupMount =
    "type=bind,source=$dockerBackupDirectory,target=/backup"

# ======================================================
# MAIN
# ======================================================

try {
    Write-Host ""
    Write-Host "Preparing PostgreSQL 17 administrative tools..."

    Invoke-Docker `
        -Arguments @(
            "pull",
            $script:ProductionAdminImage
        ) `
        -Step "Pulling PostgreSQL 17 client image"

    $clientVersion =
        Invoke-DockerCapture `
            -Arguments @(
                "run",
                "--rm",
                $script:ProductionAdminImage,
                "pg_dump",
                "--version"
            ) `
            -Step "Checking PostgreSQL 17 client version"

    Write-Host ($clientVersion -join "`n")

    # ==================================================
    # LOCAL DUMP
    # ==================================================

    Write-Host ""
    Write-Host "Creating local Docker database dump..."

    Invoke-Docker `
        -Arguments @(
            "exec",
            $ContainerName,
            "pg_dump",
            "--username=$LocalDatabaseUser",
            "--dbname=$LocalDatabaseName",
            "--format=custom",
            "--schema=public",
            "--no-owner",
            "--no-privileges",
            "--file=$($script:LocalContainerDump)"
        ) `
        -Step "Creating local database dump"

    Invoke-Docker `
        -Arguments @(
            "cp",
            "${ContainerName}:$($script:LocalContainerDump)",
            $script:LocalHostDump
        ) `
        -Step "Copying local database dump to the host"

    Assert-FileExistsAndNotEmpty `
        -Path $script:LocalHostDump `
        -Description "Local database dump"

    $localArchiveList =
        Get-ArchiveListText `
            -ArchiveFileName $script:LocalDumpFileName `
            -Step "Inspecting local database dump"

    Assert-ArchiveContainsKitchenDiaries `
        -ArchiveListText $localArchiveList

    Write-Host "Local dump validation passed."
    Write-Host "Local dump saved:"
    Write-Host $script:LocalHostDump

    $localCountsJson =
        Invoke-LocalSqlCapture `
            -Sql $script:CountsSql `
            -Step "Reading local database record counts"

    $localCounts =
        Convert-CountsJson `
            -Json $localCountsJson `
            -Source "local Docker"

    Show-Counts `
        -Counts $localCounts `
        -Title "Current local database record counts:"

    # ==================================================
    # PRODUCTION CONNECTION
    # ==================================================

    $script:ProductionUrl =
        Read-ProductionDatabaseUrl

    $productionUri =
        Assert-ProductionDatabaseUrl `
            -Url $script:ProductionUrl

    $env:PROD_URL =
        $script:ProductionUrl

    Write-Host "Checking production database connection..."

    Invoke-ProductionSql `
        -Sql $script:ConnectionCheckSql `
        -Step "Connecting to Supabase production database"

    # ==================================================
    # PRODUCTION BACKUP
    # ==================================================

    Write-Host ""
    Write-Host "Backing up the current Supabase public schema..."

    Invoke-Docker `
        -Arguments @(
            "run",
            "--rm",
            "--mount",
            $script:BackupMount,
            "--env",
            "PROD_URL",
            "--env",
            "PGCONNECT_TIMEOUT=20",
            "--env",
            "BACKUP_FILE=/backup/$($script:ProductionBackupFileName)",
            $script:ProductionAdminImage,
            "sh",
            "-lc",
            'pg_dump "$PROD_URL" --format=custom --schema=public --no-owner --no-privileges --file="$BACKUP_FILE"'
        ) `
        -Step "Backing up production database"

    Assert-FileExistsAndNotEmpty `
        -Path $script:ProductionHostBackup `
        -Description "Production backup"

    $null =
        Get-ArchiveListText `
            -ArchiveFileName $script:ProductionBackupFileName `
            -Step "Validating production backup"

    $productionBackupInfo =
        Get-Item -LiteralPath $script:ProductionHostBackup

    Write-Host "Production backup validation passed."
    Write-Host "Production backup saved:"
    Write-Host $script:ProductionHostBackup
    Write-Host "Backup size: $($productionBackupInfo.Length) bytes"

    # ==================================================
    # FINAL CONFIRMATION
    # ==================================================

    Write-Host ""
    Write-Warning @"
The production backup was created successfully.

The next step will permanently replace the production public schema
with the exact schema and data from local Docker.

Production host:
$($productionUri.Host)

Production database:
$($productionUri.AbsolutePath.TrimStart("/"))

Production backup:
$($script:ProductionHostBackup)
"@

    $confirmation =
        Read-Host `
            "Type RESET_PRODUCTION_FROM_LOCAL to continue"

    if ($confirmation -cne "RESET_PRODUCTION_FROM_LOCAL") {
        throw "Confirmation did not match. Production was not changed."
    }

    # ==================================================
    # DROP AND RESTORE
    # ==================================================

    Write-Host ""
    Write-Warning "Deleting the production public schema..."

    Invoke-ProductionSql `
        -Sql $script:DropPublicSchemaSql `
        -Step "Deleting production public schema"

    $script:ProductionSchemaDropped = $true

    Write-Host ""
    Write-Host "Restoring local Docker database into Supabase..."

    Invoke-ProductionRestore `
        -ArchiveFileName $script:LocalDumpFileName `
        -Step "Restoring local database into production"

    # ==================================================
    # VERIFY RESTORE
    # ==================================================

    $productionCountsJson =
        Invoke-ProductionSqlCapture `
            -Sql $script:CountsSql `
            -Step "Reading production database record counts"

    $productionCounts =
        Convert-CountsJson `
            -Json $productionCountsJson `
            -Source "Supabase production"

    Show-Counts `
        -Counts $productionCounts `
        -Title "Production record counts after restore:"

    Assert-CountsMatch `
        -LocalCounts $localCounts `
        -ProductionCounts $productionCounts

    $script:ReplacementVerified = $true

    Write-Host ""
    Write-Host "Record-count verification passed."
    Write-Host "Updating PostgreSQL query statistics..."

    Invoke-ProductionSql `
        -Sql $script:AnalyzeSql `
        -Step "Analyzing production database"

    Write-Host ""
    Write-Host "=============================================="
    Write-Host "PRODUCTION DATABASE REPLACEMENT COMPLETED"
    Write-Host "=============================================="
    Write-Host ""
    Write-Host "Local Docker schema and data are now in Supabase."
    Write-Host ""
    Write-Host "Local dump:"
    Write-Host $script:LocalHostDump
    Write-Host ""
    Write-Host "Previous production backup:"
    Write-Host $script:ProductionHostBackup
    Write-Host ""
}
catch {
    $originalError =
        $_.Exception.Message

    if (
        $script:ProductionSchemaDropped -and
        -not $script:ReplacementVerified -and
        (Test-Path -LiteralPath $script:ProductionHostBackup)
    ) {
        Write-Host ""
        Write-Warning "Replacement failed after the production schema was deleted."
        Write-Warning "Attempting automatic rollback..."

        $rollbackError = $null

        try {
            Invoke-ProductionSql `
                -Sql $script:DropPublicSchemaSql `
                -Step "Preparing production schema for rollback"

            Invoke-ProductionRestore `
                -ArchiveFileName $script:ProductionBackupFileName `
                -Step "Restoring previous production backup"
        }
        catch {
            $rollbackError =
                $_.Exception.Message
        }

        if ($null -ne $rollbackError) {
            throw @"
CRITICAL DATABASE ERROR

The local-to-production replacement failed.
The automatic rollback also failed.

Original replacement error:
$originalError

Rollback error:
$rollbackError

The previous production backup is stored at:
$($script:ProductionHostBackup)

Do not run another reset until that backup has been restored manually.
"@
        }

        throw @"
The local-to-production replacement failed.

The previous production database was restored automatically.

Original error:
$originalError
"@
    }

    throw
}
finally {
    try {
        & docker exec `
            $ContainerName `
            rm `
            -f `
            $script:LocalContainerDump `
            2>$null |
            Out-Null
    }
    catch {
        # Cleanup failure must not hide the main result.
    }

    if ($null -eq $previousProdUrl) {
        Remove-Item `
            Env:PROD_URL `
            -ErrorAction SilentlyContinue
    }
    else {
        $env:PROD_URL =
            $previousProdUrl
    }

    $script:ProductionUrl = $null
}