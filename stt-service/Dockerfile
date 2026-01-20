# STT Service - Speech-to-Text using OpenAI Whisper
# Extends the shared ROCm base image with Whisper-specific dependencies
#
# Build the base image first:
#   docker build -t chatty-buddy-rocm-base -f docker/Dockerfile.rocm-base .
# Then build this service:
#   docker build -t chatty-buddy-stt -f stt-service/Dockerfile .

FROM chatty-buddy-rocm-base

LABEL maintainer="chatty-buddy"
LABEL description="Speech-to-Text service using Whisper small.en"

# Copy requirements first for better layer caching
COPY requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/requirements.txt

# Pre-download the Whisper small.en model during build
# This avoids downloading on first request and ensures reproducible builds
RUN python -c "import whisper; whisper.load_model('small.en')"

# Copy application code
COPY . /app/

# Expose the service port
EXPOSE 8001

# Run the Flask application with Gunicorn for production
# - Workers: 1 (ML models are memory-intensive, single worker avoids GPU memory issues)
# - Threads: 1 (Whisper is not thread-safe with GPU)
# - Timeout: 120s (transcription can take time for longer audio)
CMD ["gunicorn", "--bind", "0.0.0.0:8001", "--workers", "1", "--threads", "1", "--timeout", "120", "app:app"]
