# Chatty Buddy

A voice chat agent application that combines speech-to-text, LLM-powered responses, and text-to-speech to create an interactive voice assistant. Built with AMD ROCm GPU acceleration.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Server      │────▶│   ML Services   │
│  React/Vite     │     │  Node/Fastify   │     │   ROCm GPU      │
│    :5173        │◀────│     :3001       │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                              ▼                         ▼                         ▼
                    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
                    │  STT Service    │     │     Ollama      │     │  TTS Service    │
                    │  Whisper        │     │   gemma-3       │     │     Dia         │
                    │    :8001        │     │    :11434       │     │    :8002        │
                    └─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Project Structure

```
chatty-buddy/
├── frontend/                 # React + Vite + Tailwind + TypeScript
├── server/                   # Node.js + Fastify + TypeScript
├── stt-service/              # Python + Whisper small.en
├── tts-service/              # Python + Dia model
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
docker-compose exec ollama ollama pull gemma3
```

### 4. Access the Application

Open your browser and navigate to:

```
http://localhost:5173
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React web interface with voice recording |
| Server | 3001 | Fastify API orchestrating ML services |
| STT Service | 8001 | Whisper-based speech-to-text |
| TTS Service | 8002 | Dia-based text-to-speech |
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
  "audioUrl": "base64 encoded audio or blob URL"
}
```

### STT Service

#### `POST /transcribe`

Convert audio to text.

**Request:**
- Content-Type: `multipart/form-data` or audio file
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
  "text": "Text to synthesize"
}
```

**Response:**
- Audio file (WAV)

## Development

### Running Individual Services

You can run services individually for development:

```bash
# Frontend only
cd frontend && npm run dev

# Server only
cd server && npm run dev

# STT Service only
cd stt-service && python app.py

# TTS Service only
cd tts-service && python app.py
```

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `VITE_API_URL` | Frontend | Server API URL |
| `STT_SERVICE_URL` | Server | Speech-to-text service URL |
| `LLM_SERVICE_URL` | Server | Ollama service URL |
| `TTS_SERVICE_URL` | Server | Text-to-speech service URL |
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
docker-compose exec ollama ollama pull gemma3
```

## License

MIT
