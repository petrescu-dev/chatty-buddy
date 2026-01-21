# TTS2 Service - Text-to-Speech using Kokoro-ONNX
# Extends the shared ROCm base image with Kokoro-ONNX-specific dependencies
#
# Build the base image first:
#   docker build -t chatty-buddy-rocm-base -f docker/Dockerfile.rocm-base .
# Then build this service:
#   docker build -t chatty-buddy-tts2 -f tts2-service/Dockerfile tts2-service/

FROM chatty-buddy-rocm-base

LABEL maintainer="chatty-buddy"
LABEL description="Text-to-Speech service using Kokoro-82M ONNX with MIGraphX/ROCm"

# Add AMD ROCm 7.1.1 apt repository for half and migraphx packages
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    && curl -fsSL https://repo.radeon.com/rocm/rocm.gpg.key | gpg --dearmor -o /etc/apt/keyrings/rocm.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/rocm.gpg] https://repo.radeon.com/rocm/apt/7.1.1 noble main" \
    > /etc/apt/sources.list.d/rocm.list \
    && apt-get update

# Install espeak-ng for phonemization (required by Kokoro for fallback)
# Install half and migraphx from AMD ROCm repository
RUN apt-get install -y \
    espeak-ng \
    half \
    migraphx \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt /app/requirements.txt

# Install Python dependencies (excluding ONNX Runtime)
RUN pip install --no-cache-dir -r /app/requirements.txt

# Install ONNX Runtime with MIGraphX support from AMD's repository
# Try onnxruntime-migraphx which should include MIGraphXExecutionProvider
RUN pip install onnxruntime-migraphx -f https://repo.radeon.com/rocm/manylinux/rocm-rel-7.1.1/

# Create models directory
RUN mkdir -p /app/models

# Download Kokoro ONNX model and voices file
# Model: ~330MB, Voices: ~50MB
RUN wget -q -O /app/models/kokoro-v1.0.onnx \
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx" && \
    wget -q -O /app/models/voices-v1.0.bin \
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

# Copy application code
COPY . /app/

# Environment variables for model paths
ENV KOKORO_MODEL_PATH=/app/models/kokoro-v1.0.onnx
ENV KOKORO_VOICES_PATH=/app/models/voices-v1.0.bin

# Expose the service port (using 8003 to run alongside tts-service if needed)
EXPOSE 8003

# Run the Flask application with Gunicorn for production
# - Workers: 1 (ML models are memory-intensive, single worker avoids GPU memory issues)
# - Threads: 1 (Model inference is not thread-safe with GPU)
# - Timeout: 120s (synthesis can take time for longer text)
CMD ["gunicorn", "--bind", "0.0.0.0:8003", "--workers", "1", "--threads", "1", "--timeout", "120", "app:app"]
