"""
Text-to-Speech Service using Kokoro-ONNX

This Flask service provides an HTTP endpoint for synthesizing speech from text
using the Kokoro-82M ONNX model. This implementation uses ONNX Runtime with
MIGraphX/ROCm execution provider for AMD GPU acceleration.

Endpoint:
    POST /synthesize
    - Accepts: JSON { "text": string, "voice": string (optional), "lang": string (optional) }
    - Returns: Audio file (WAV)
"""

import io
import logging
import os
from flask import Flask, request, jsonify, send_file
from kokoro_onnx import Kokoro
import soundfile as sf
import numpy as np
import onnxruntime as ort

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Global Kokoro instance (loaded once at startup)
kokoro = None

# Model and voices file paths
MODEL_PATH = os.environ.get("KOKORO_MODEL_PATH", "/app/models/kokoro-v1.0.onnx")
VOICES_PATH = os.environ.get("KOKORO_VOICES_PATH", "/app/models/voices-v1.0.bin")

# Default voice
DEFAULT_VOICE = "af_heart"

# Default language code
DEFAULT_LANG = "en-us"

# Supported language codes for kokoro-onnx
# Format differs slightly from PyTorch version
SUPPORTED_LANGS = {
    "en-us": "American English",
    "en-gb": "British English",
    "es": "Spanish",
    "fr": "French",
    "hi": "Hindi",
    "it": "Italian",
}

# Available voices (same as PyTorch version)
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


def get_execution_providers():
    """
    Determine the best available ONNX Runtime execution providers.
    
    Prioritizes MIGraphX (AMD GPU) > ROCm > CPU
    """
    available = ort.get_available_providers()
    logger.info(f"Available ONNX Runtime providers: {available}")
    
    # Priority order for AMD GPUs
    preferred_order = [
        'MIGraphXExecutionProvider',
        'ROCMExecutionProvider',
        'CPUExecutionProvider'
    ]
    
    providers = []
    for provider in preferred_order:
        if provider in available:
            providers.append(provider)
    
    if not providers:
        providers = ['CPUExecutionProvider']
    
    # Check if we have GPU acceleration
    gpu_providers = {'MIGraphXExecutionProvider', 'ROCMExecutionProvider'}
    has_gpu = bool(gpu_providers & set(providers))
    
    if not has_gpu:
        logger.warning(
            "No GPU execution provider available. Running on CPU will be slower. "
            "Ensure ROCm/MIGraphX is properly installed and GPU devices are mapped."
        )
    else:
        logger.info(f"Using GPU acceleration via: {providers[0]}")
    
    return providers


def load_model():
    """Load the Kokoro ONNX model on startup."""
    global kokoro
    
    # Verify model files exist
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    if not os.path.exists(VOICES_PATH):
        raise FileNotFoundError(f"Voices file not found: {VOICES_PATH}")
    
    logger.info(f"Loading Kokoro ONNX model from: {MODEL_PATH}")
    logger.info(f"Loading voices from: {VOICES_PATH}")
    
    # Get execution providers
    providers = get_execution_providers()
    
    # Initialize Kokoro with ONNX model
    # Note: kokoro-onnx handles the ONNX session creation internally
    kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
    
    logger.info("Kokoro ONNX model loaded successfully")
    
    return kokoro


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for container orchestration."""
    return jsonify({
        "status": "healthy",
        "model_loaded": kokoro is not None,
        "available_voices": AVAILABLE_VOICES,
        "supported_languages": SUPPORTED_LANGS,
        "backend": "onnx",
        "execution_providers": ort.get_available_providers()
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
    lang = data.get('lang', DEFAULT_LANG)
    
    if not text or not text.strip():
        logger.warning("Empty text provided")
        return jsonify({"error": "Text cannot be empty"}), 400
    
    try:
        logger.info(f"Synthesizing speech for text (voice={voice}, lang={lang}): {text[:100]}...")
        
        # Generate speech using Kokoro ONNX
        # The create() method returns (audio_samples, sample_rate)
        audio_samples, sample_rate = kokoro.create(
            text=text,
            voice=voice,
            speed=speed,
            lang=lang
        )
        
        # Check if audio was generated
        if audio_samples is None or len(audio_samples) == 0:
            return jsonify({"error": "No audio generated"}), 500
        
        # Write to buffer as WAV
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, audio_samples, sample_rate, format='WAV')
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
    app.run(host='0.0.0.0', port=8003, debug=False)
