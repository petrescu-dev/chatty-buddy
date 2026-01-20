# TTS Service - Text-to-Speech using Coqui XTTS-v2
# Extends the shared ROCm base image with XTTS-specific dependencies
#
# Build the base image first:
#   docker build -t chatty-buddy-rocm-base -f docker/Dockerfile.rocm-base .
# Then build this service:
#   docker build -t chatty-buddy-tts -f tts-service/Dockerfile tts-service/

FROM chatty-buddy-rocm-base

LABEL maintainer="chatty-buddy"
LABEL description="Text-to-Speech service using VITS multi-speaker"

# Install espeak-ng for phonemization (required by VITS model)
RUN apt-get update && apt-get install -y \
    espeak-ng \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt /app/requirements.txt

# Install Python dependencies
# TTS package will install its own dependencies but won't override our ROCm PyTorch
# since we already have a compatible version installed
RUN pip install --no-cache-dir -r /app/requirements.txt

# Pre-download the VITS model during build
# This avoids downloading on first request and ensures reproducible builds
# COQUI_TOS_AGREED=1 accepts the CPML license non-interactively
ENV COQUI_TOS_AGREED=1
RUN python -c "from TTS.api import TTS; TTS('tts_models/en/vctk/vits')"

# Copy application code
COPY . /app/

# Expose the service port
EXPOSE 8002

# Run the Flask application with Gunicorn for production
# - Workers: 1 (ML models are memory-intensive, single worker avoids GPU memory issues)
# - Threads: 1 (Model inference is not thread-safe with GPU)
# - Timeout: 120s (synthesis can take time for longer text)
CMD ["gunicorn", "--bind", "0.0.0.0:8002", "--workers", "1", "--threads", "1", "--timeout", "120", "app:app"]
