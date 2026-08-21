$ErrorActionPreference = "Stop"

Write-Host "==============================================="
Write-Host " Kitchen Diaries - Local Desktop Setup"
Write-Host "==============================================="

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required. Install/start Docker Desktop, then run this script again."
}

if (-not (Test-Path ".env")) {
  if (-not (Test-Path ".env.local.example")) {
    throw ".env.local.example is missing."
  }
  Copy-Item ".env.local.example" ".env"
  Write-Host "Created .env from .env.local.example"
}

Write-Host "Starting PostgreSQL..."
docker compose up -d postgres

Write-Host "Waiting for PostgreSQL health..."
for ($i = 0; $i -lt 30; $i++) {
  $container = docker compose ps -q postgres
  if ($container) {
    $health = docker inspect --format='{{.State.Health.Status}}' $container 2>$null
    if ($health -eq "healthy") { break }
  }
  Start-Sleep -Seconds 2
}

$container = docker compose ps -q postgres
$health = if ($container) { docker inspect --format='{{.State.Health.Status}}' $container 2>$null } else { "" }
if ($health -ne "healthy") {
  throw "PostgreSQL did not become healthy. Run: docker compose logs postgres"
}

Write-Host "Generating Prisma Client..."
npx prisma generate

Write-Host "Resetting the local migration-managed database..."
npx prisma migrate reset --force

Write-Host "Seeding demo data..."
npm run seed:desktop

Write-Host ""
Write-Host "==============================================="
Write-Host " Desktop database is ready."
Write-Host "==============================================="
Write-Host "PRO:   owner@kitchendiaries.local / Demo@12345"
Write-Host "       KD-DEMO-PRO-12M"
Write-Host "BASIC: basic.owner@kitchendiaries.local / Demo@12345"
Write-Host "       KD-DEMO-BASIC-12M"
Write-Host ""
Write-Host "Start app: npm run dev"
Write-Host "==============================================="
