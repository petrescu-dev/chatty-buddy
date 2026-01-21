# Chatty Buddy

A voice chat agent application that combines speech-to-text, LLM-powered responses, and text-to-speech to create an interactive voice assistant. Built with AMD ROCm GPU acceleration.

## Architecture

```
┌─────────────────────────────────────┐     ┌─────────────────────────────────────────────┐
│           Server (:3001)            │     │            ML Services (ROCm GPU)           │
│  ┌─────────────┐  ┌──────────────┐  │     │                                             │
│  │  Frontend   │  │   Fastify    │──┼────▶│  ┌─────────┐  ┌───────┐  ┌───────────────┐ │
│  │  (Static)   │  │     API      │  │     │  │   STT   │  │  LLM  │  │      TTS      │ │
│  │  React/Vite │  │              │◀─┼─────│  │ Whisper │  │gemma-3│  │    Kokoro     │ │
│  └─────────────┘  └──────────────┘  │     │  │  :8001  │  │:11434 │  ├───────┬───────┤ │
└─────────────────────────────────────┘     │  └─────────┘  └───────┘  │PyTorch│ ONNX  │ │
                                            │                          │ :8002 │ :8003 │ │
                                            │                          └───────┴───────┘ │
                                            └─────────────────────────────────────────────┘
```

## Project Structure

```
chatty-buddy/
├── frontend/                 # React + Vite + Tailwind + TypeScript (source)
├── server/                   # Node.js + Fastify + TypeScript (serves frontend + API)
├── stt-service/              # Python + Whisper small.en
├── tts-service/              # Python + Kokoro TTS (PyTorch)
├── tts2-service/             # Python + Kokoro TTS (ONNX Runtime + MIGraphX)
├── ollama-service/           # Ollama with gemma-3 model
├── docker/
│   └── Dockerfile.rocm-base  # Shared ROCm 7.1 PyTorch base image
├── docker-compose.yml        # Orchestrates all services
└── README.md
```

## Prerequisites

- Docker and Docker Compose
- AMD GPU with ROCm support
- ROCm drivers installed on host system

## Quick Start

### 1. Build the ROCm Base Image

First, build the shared base image used by the ML services:

```bash
docker build -t chatty-buddy-rocm-base -f docker/Dockerfile.rocm-base docker/
```

### 2. Start All Services

```bash
docker-compose up --build
```

### 3. Pull the LLM Model

In a separate terminal, pull the gemma-3 model into Ollama:

```bash
docker-compose exec ollama ollama pull gemma3:4b
```

### 4. Access the Application

Open your browser and navigate to:

```
http://localhost:3001
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Server | 3001 | Fastify server (serves frontend + API) |
| STT Service | 8001 | Whisper-based speech-to-text |
| TTS Service | 8002 | Kokoro TTS (PyTorch) text-to-speech |
| TTS2 Service | 8003 | Kokoro TTS (ONNX Runtime + MIGraphX) text-to-speech |
| Ollama | 11434 | LLM inference with gemma-3 |

## API Endpoints

### Server API

#### `POST /api/chat`

Send audio for processing through the voice chat pipeline.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Audio file (WAV/WebM)

**Response:**
```json
{
  "transcription": "User's spoken text",
  "response": "Agent's text response",
  "audioBase64": "base64 encoded WAV audio"
}
```

#### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "stt": "http://stt-service:8001",
    "llm": "http://ollama:11434",
    "tts": "http://tts-service:8002"
  }
}
```

### STT Service

#### `POST /transcribe`

Convert audio to text.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Audio file (WAV/WebM)

**Response:**
```json
{
  "text": "Transcribed text"
}
```

### TTS Service

#### `POST /synthesize`

Convert text to speech audio.

**Request:**
```json
{
  "text": "Text to synthesize",
  "voice": "af_heart",
  "speed": 1.0
}
```

**Response:**
- Audio file (WAV)

## Alternative TTS Service (tts2-service)

The project includes an alternative TTS implementation using **kokoro-onnx** with ONNX Runtime and MIGraphX execution provider. This provides an alternative GPU acceleration path for AMD GPUs.

Onnx runtime consists of native code, quicker than the pytorch libraries.
Also, AMD now recommends using onnxruntime-migraphx over onnxruntime-rocm.

Performance wise, for 30 words TTS conversion on Radeon 9070xt
- pytorch rocm kokoro 15 seconds
- onnxruntime-migraphx - 3 seconds

### Differences

| Feature | tts-service | tts2-service |
|---------|-------------|--------------|
| Backend | PyTorch + ROCm | ONNX Runtime + MIGraphX |
| Model | Kokoro (PyTorch) | Kokoro ONNX |
| Port | 8002 | 8003 |
| GPU Provider | ROCm via PyTorch CUDA API | MIGraphXExecutionProvider |

### Switching to tts2-service

To use the ONNX-based TTS service, update the `TTS_SERVICE_URL` in `docker-compose.yml`:

```yaml
environment:
  - TTS_SERVICE_URL=http://tts2-service:8003
```

Then restart the services:

```bash
docker-compose up --build
```

### API Compatibility

Both TTS services expose identical endpoints (`/synthesize` and `/health`), allowing seamless switching between implementations.

## Development

### Running Individual Services

You can run services individually for development:

```bash
# Build frontend
cd frontend && npm run build

# Server (with frontend)
cd server && npm run dev

# STT Service only
cd stt-service && python app.py

# TTS Service only (PyTorch)
cd tts-service && python app.py

# TTS2 Service only (ONNX Runtime + MIGraphX)
cd tts2-service && python app.py
```

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `FRONTEND_DIR` | Server | Path to frontend build directory |
| `STT_SERVICE_URL` | Server | Speech-to-text service URL |
| `LLM_SERVICE_URL` | Server | Ollama service URL |
| `TTS_SERVICE_URL` | Server | Text-to-speech service URL |
| `LLM_MODEL` | Server | Ollama model name (default: gemma3:4b) |
| `HSA_OVERRIDE_GFX_VERSION` | ML Services | ROCm GPU version override |

## Troubleshooting

### GPU Not Detected

Ensure ROCm drivers are installed and your user is in the `video` and `render` groups:

```bash
sudo usermod -a -G video,render $USER
```

Then log out and back in.

### Permission Denied for /dev/kfd

Run the container with the required device mappings (already configured in docker-compose.yml).

### Ollama Model Not Found

Make sure to pull the model after starting the containers:

```bash
docker-compose exec ollama ollama pull gemma3:4b
```

## License

MIT
