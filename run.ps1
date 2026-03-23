Write-Host "Starting AI-MSE with Ollama..." -ForegroundColor Green

# Use .env.local if it exists
if (Test-Path ".env.local") {
    docker-compose --env-file .env.local up -d --build
} else {
    docker-compose up -d --build
}

Write-Host "`nWaiting for services to initialize..." -ForegroundColor Yellow
Write-Host "Ollama is pre-loading gemma3:4b (first-time only). Check status with: docker logs -f ollama-pull-model"
Write-Host "Success! The application will be reachable at http://localhost:3000" -ForegroundColor Cyan
