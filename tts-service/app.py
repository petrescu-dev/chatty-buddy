"""
Text-to-Speech Service using Kokoro

This Flask service provides an HTTP endpoint for synthesizing speech from text
using the Kokoro-82M model, a lightweight but high-quality TTS model.

Endpoint:
    POST /synthesize
    - Accepts: JSON { "text": string, "voice": string (optional), "lang": string (optional) }
    - Returns: Audio file (WAV)
"""

import io
import logging
from flask import Flask, request, jsonify, send_file
from kokoro import KPipeline
import torch
import soundfile as sf
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Global pipeline instance (loaded once at startup)
pipeline = None

# Audio sample rate for Kokoro output
SAMPLE_RATE = 24000

# Default voice
DEFAULT_VOICE = "af_heart"

# Default language code
DEFAULT_LANG = "a"  # American English

# Supported language codes
# 'a' => American English, 'b' => British English
# 'e' => Spanish, 'f' => French, 'h' => Hindi
# 'i' => Italian, 'j' => Japanese, 'p' => Brazilian Portuguese
# 'z' => Mandarin Chinese
SUPPORTED_LANGS = {
    "a": "American English",
    "b": "British English",
    "e": "Spanish",
    "f": "French",
    "h": "Hindi",
    "i": "Italian",
}

# Available voices (American English examples)
AVAILABLE_VOICES = [
    "af_heart",    # American female
    "af_bella",    # American female
    "af_nicole",   # American female
    "af_sarah",    # American female
    "af_sky",      # American female
    "am_adam",     # American male
    "am_michael",  # American male
    "bf_emma",     # British female
    "bf_isabella", # British female
    "bm_george",   # British male
    "bm_lewis",    # British male
]


def get_device():
    """Determine the best available device for inference."""
    # Note: torch.cuda.* APIs work for both NVIDIA CUDA and AMD ROCm.
    # When PyTorch is built with ROCm support, the CUDA API is mapped
    # to ROCm via HIP (Heterogeneous-compute Interface for Portability).
    if not torch.cuda.is_available():
        raise RuntimeError(
            "No GPU available. This service requires ROCm/CUDA for acceptable "
            "performance. Ensure GPU devices are properly mapped to the container "
            "(/dev/kfd and /dev/dri) and ROCm drivers are installed on the host."
        )
    
    logger.info(f"Using GPU device: {torch.cuda.get_device_name(0)}")
    return "cuda"


def load_model():
    """Load the Kokoro pipeline on startup."""
    global pipeline
    device = get_device()
    
    logger.info(f"Loading Kokoro pipeline on device: {device}")
    
    # Initialize pipeline with American English and explicit device
    pipeline = KPipeline(lang_code=DEFAULT_LANG, device=device)
    
    # Verify GPU is being used
    logger.info(f"Kokoro pipeline loaded successfully on {device}")
    logger.info(f"CUDA memory allocated: {torch.cuda.memory_allocated() / 1024**2:.1f} MB")
    
    return pipeline


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for container orchestration."""
    return jsonify({
        "status": "healthy",
        "model_loaded": pipeline is not None,
        "available_voices": AVAILABLE_VOICES,
        "supported_languages": SUPPORTED_LANGS
    })


@app.route('/synthesize', methods=['POST'])
def synthesize():
    """
    Synthesize speech from text.
    
    Expects a JSON body with:
    - 'text' (required): The text to synthesize
    - 'voice' (optional): Voice ID (default: "af_heart")
    - 'speed' (optional): Speech speed multiplier (default: 1.0)
    
    Use GET /health to see available voices.
    
    Returns:
        Audio file in WAV format
    """
    # Check content type
    if not request.is_json:
        logger.warning("Request content type is not JSON")
        return jsonify({"error": "Content-Type must be application/json"}), 400
    
    data = request.get_json()
    
    # Validate input
    if 'text' not in data:
        logger.warning("No text field provided in request")
        return jsonify({"error": "No text field provided"}), 400
    
    text = data['text']
    voice = data.get('voice', DEFAULT_VOICE)
    speed = data.get('speed', 1.0)
    
    if not text or not text.strip():
        logger.warning("Empty text provided")
        return jsonify({"error": "Text cannot be empty"}), 400
    
    try:
        logger.info(f"Synthesizing speech for text (voice={voice}): {text[:100]}...")
        
        # Log GPU memory before synthesis
        if torch.cuda.is_available():
            logger.info(f"GPU memory before synthesis: {torch.cuda.memory_allocated() / 1024**2:.1f} MB")
        else:
            logger.info("No GPU available, using CPU (will be slower)")
        
        # Generate speech using Kokoro pipeline
        # The generator yields (graphemes, phonemes, audio) tuples
        generator = pipeline(text, voice=voice, speed=speed)
        
        # Collect all audio segments
        audio_segments = []
        for i, (gs, ps, audio) in enumerate(generator):
            audio_segments.append(audio)
        
        # Concatenate all segments
        if audio_segments:
            full_audio = np.concatenate(audio_segments)
        else:
            return jsonify({"error": "No audio generated"}), 500
        
        # Log GPU memory after synthesis
        if torch.cuda.is_available():
            logger.info(f"GPU memory after synthesis: {torch.cuda.memory_allocated() / 1024**2:.1f} MB")
        
        # Write to buffer as WAV
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, full_audio, SAMPLE_RATE, format='WAV')
        audio_buffer.seek(0)
        
        logger.info("Speech synthesis complete")
        
        return send_file(
            audio_buffer,
            mimetype='audio/wav',
            as_attachment=True,
            download_name='speech.wav'
        )
    
    except Exception as e:
        logger.error(f"Synthesis error: {str(e)}")
        return jsonify({"error": f"Synthesis failed: {str(e)}"}), 500


# Load model at startup when running directly or with Gunicorn
with app.app_context():
    load_model()


if __name__ == '__main__':
    # Development server - use Gunicorn in production
    app.run(host='0.0.0.0', port=8002, debug=False)
