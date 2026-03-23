#!/bin/bash
echo "Starting AI-MSE with Ollama..."
# Use .env.local if it exists
if [ -f .env.local ]; then
  docker-compose --env-file .env.local up -d --build
else
  docker-compose up -d --build
fi

echo "Waiting for services to initialize..."
# The backend will wait for Ollama to be healthy and the model to be pulled
# but we can still show a friendly message.
echo "Ollama is pre-loading gemma3:4b (first-time only). Check status with: docker logs -f ollama-pull-model"
echo "Success! The application will be reachable at http://localhost:3000"
