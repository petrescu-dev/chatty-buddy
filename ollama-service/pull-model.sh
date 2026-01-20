#!/bin/bash
set -e

MODEL_NAME="${1:-gemma3:4b}"

echo "Starting Ollama server in background..."
ollama serve &
SERVER_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "Error: Ollama server failed to start after $MAX_RETRIES attempts"
        exit 1
    fi
    echo "Waiting for Ollama server... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo "Ollama server is ready. Pulling model: $MODEL_NAME"
ollama pull "$MODEL_NAME"

echo "Model $MODEL_NAME pulled successfully!"

# Stop the server gracefully
echo "Stopping Ollama server..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "Done!"
