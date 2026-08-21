$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required. Install/start Docker Desktop, then run this script again."
}

if (-not (Test-Path ".env.test")) {
  if (-not (Test-Path ".env.test.example")) {
    throw ".env.test.example is missing."
  }
  Copy-Item ".env.test.example" ".env.test"
  Write-Host "Created .env.test from .env.test.example"
}

docker compose up -d postgres-test

for ($i = 0; $i -lt 30; $i++) {
  $container = docker compose ps -q postgres-test
  if ($container) {
    $health = docker inspect --format='{{.State.Health.Status}}' $container 2>$null
    if ($health -eq "healthy") { break }
  }
  Start-Sleep -Seconds 2
}

$container = docker compose ps -q postgres-test
$health = if ($container) { docker inspect --format='{{.State.Health.Status}}' $container 2>$null } else { "" }
if ($health -ne "healthy") {
  throw "Test PostgreSQL did not become healthy. Run: docker compose logs postgres-test"
}

npx prisma generate
npm run test:db:migrate
Write-Host "Integration test database is ready on localhost:5434/kd_app_test"
