/**
 * Voice Chat Agent Server
 *
 * This Fastify server orchestrates the voice chat pipeline:
 * 1. Receives audio from frontend
 * 2. Forwards to STT service for transcription
 * 3. Sends transcription to Ollama LLM for response
 * 4. Forwards LLM response to TTS service for audio synthesis
 * 5. Returns transcription, response text, and audio to frontend
 *
 * It also serves the built frontend static files.
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to frontend build directory
const FRONTEND_DIR = process.env.FRONTEND_DIR || join(__dirname, "../../frontend/dist");

// Service URLs from environment variables
const STT_SERVICE_URL = process.env.STT_SERVICE_URL || "http://localhost:8001";
const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || "http://localhost:11434";
const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || "http://localhost:8002";

// Server configuration
const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";

// LLM model configuration
const LLM_MODEL = process.env.LLM_MODEL || "gemma3:4b";

// System prompt for the voice assistant
const SYSTEM_PROMPT = `You are a friendly and helpful voice assistant. Keep your responses concise and conversational, as they will be spoken aloud. Aim for 1-3 sentences unless the user asks for more detail. Avoid using markdown, bullet points, or special formatting since your response will be converted to speech. Be natural and engaging.`;

// Initialize Fastify
const fastify = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

// Register plugins
await fastify.register(fastifyCors, {
  origin: true, // Allow all origins in development
});

await fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Serve static frontend files
await fastify.register(fastifyStatic, {
  root: FRONTEND_DIR,
  prefix: "/",
});

// Types
interface ChatResponse {
  transcription: string;
  response: string;
  audioBase64: string;
}

interface STTResponse {
  text: string;
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

/**
 * Transcribe audio using the STT service
 */
async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("audio", new Blob([new Uint8Array(audioBuffer)]), filename);

  const response = await fetch(`${STT_SERVICE_URL}/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`STT service error: ${error}`);
  }

  const data = (await response.json()) as STTResponse;
  return data.text;
}

/**
 * Generate a response using Ollama LLM
 */
async function generateLLMResponse(userMessage: string): Promise<string> {
  const response = await fetch(`${LLM_SERVICE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      prompt: userMessage,
      system: SYSTEM_PROMPT,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM service error: ${error}`);
  }

  const data = (await response.json()) as OllamaResponse;
  return data.response;
}

/**
 * Synthesize speech using the TTS service
 */
async function synthesizeSpeech(text: string): Promise<Buffer> {
  const response = await fetch(`${TTS_SERVICE_URL}/synthesize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TTS service error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Health check endpoint
 */
fastify.get("/health", async () => {
  return {
    status: "healthy",
    services: {
      stt: STT_SERVICE_URL,
      llm: LLM_SERVICE_URL,
      tts: TTS_SERVICE_URL,
    },
  };
});

/**
 * Main chat endpoint
 * Accepts audio file, returns transcription, LLM response, and synthesized audio
 */
fastify.post<{ Reply: ChatResponse }>("/api/chat", async (request, reply) => {
  const startTime = Date.now();

  // Get the uploaded audio file
  const data = await request.file();

  if (!data) {
    reply.code(400);
    throw new Error("No audio file provided");
  }

  const audioBuffer = await data.toBuffer();
  const filename = data.filename || "audio.webm";

  fastify.log.info(`Received audio file: ${filename} (${audioBuffer.length} bytes)`);

  try {
    // Step 1: Transcribe audio
    fastify.log.info("Transcribing audio...");
    const transcriptionStart = Date.now();
    const transcription = await transcribeAudio(audioBuffer, filename);
    fastify.log.info(
      `Transcription complete (${Date.now() - transcriptionStart}ms): "${transcription}"`
    );

    if (!transcription.trim()) {
      reply.code(400);
      throw new Error("Could not transcribe audio - no speech detected");
    }

    // Step 2: Generate LLM response
    fastify.log.info("Generating LLM response...");
    const llmStart = Date.now();
    const llmResponse = await generateLLMResponse(transcription);
    fastify.log.info(
      `LLM response complete (${Date.now() - llmStart}ms): "${llmResponse.substring(0, 100)}..."`
    );

    // Step 3: Synthesize speech
    fastify.log.info("Synthesizing speech...");
    const ttsStart = Date.now();
    const audioResponse = await synthesizeSpeech(llmResponse);
    fastify.log.info(`TTS complete (${Date.now() - ttsStart}ms): ${audioResponse.length} bytes`);

    // Convert audio to base64 for JSON response
    const audioBase64 = audioResponse.toString("base64");

    const totalTime = Date.now() - startTime;
    fastify.log.info(`Total request time: ${totalTime}ms`);

    return {
      transcription,
      response: llmResponse,
      audioBase64,
    };
  } catch (error) {
    fastify.log.error(error, "Chat pipeline error");
    throw error;
  }
});

/**
 * SPA catch-all route - serve index.html for client-side routing
 * This must be registered after all other routes
 */
fastify.setNotFoundHandler(async (request, reply) => {
  // Only serve index.html for non-API routes (SPA client-side routing)
  if (!request.url.startsWith("/api/") && !request.url.startsWith("/health")) {
    return reply.sendFile("index.html");
  }
  reply.code(404);
  return { error: "Not found" };
});

// Start the server
try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`Server listening on http://${HOST}:${PORT}`);
  fastify.log.info(`STT Service: ${STT_SERVICE_URL}`);
  fastify.log.info(`LLM Service: ${LLM_SERVICE_URL}`);
  fastify.log.info(`TTS Service: ${TTS_SERVICE_URL}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
