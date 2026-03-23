#!/bin/bash
echo "Starting AI-MSE with Ollama..."
docker-compose up -d --build

echo "Waiting for Ollama to be ready..."
sleep 5

echo "Pulling gemma3:4b model (this may take a while the first time)..."
docker exec -it ollama ollama pull gemma3:4b

echo "Success! The application is ready at http://localhost:3000"
