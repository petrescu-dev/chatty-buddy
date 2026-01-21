# TTS Service - Text-to-Speech using Kokoro
# Extends the shared ROCm base image with Kokoro-specific dependencies
#
# Build the base image first:
#   docker build -t chatty-buddy-rocm-base -f docker/Dockerfile.rocm-base .
# Then build this service:
#   docker build -t chatty-buddy-tts -f tts-service/Dockerfile tts-service/

FROM chatty-buddy-rocm-base

LABEL maintainer="chatty-buddy"
LABEL description="Text-to-Speech service using Kokoro-82M"

# Install espeak-ng for phonemization (required by Kokoro for fallback)
RUN apt-get update && apt-get install -y \
    espeak-ng \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/requirements.txt

# Pre-download the Kokoro model during build
# This initializes the pipeline and downloads model weights
RUN python -c "from kokoro import KPipeline; KPipeline(lang_code='a')"

# Copy application code
COPY . /app/

# Expose the service port
EXPOSE 8002

# Run the Flask application with Gunicorn for production
# - Workers: 1 (ML models are memory-intensive, single worker avoids GPU memory issues)
# - Threads: 1 (Model inference is not thread-safe with GPU)
# - Timeout: 120s (synthesis can take time for longer text)
CMD ["gunicorn", "--bind", "0.0.0.0:8002", "--workers", "1", "--threads", "1", "--timeout", "120", "app:app"]
