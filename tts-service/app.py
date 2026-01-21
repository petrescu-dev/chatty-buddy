"""
Text-to-Speech Service using Coqui VITS

This Flask service provides an HTTP endpoint for synthesizing speech from text
using the VITS model from Coqui with multiple built-in speakers.

Endpoint:
    POST /synthesize
    - Accepts: JSON { "text": string, "speaker_id": string (optional) }
    - Returns: Audio file (WAV)
"""

import io
import logging
from flask import Flask, request, jsonify, send_file
from TTS.api import TTS
import torch
import soundfile as sf

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Global TTS instance (loaded once at startup)
tts = None

# Model name - VITS with VCTK multi-speaker dataset (English)
# This model has 109 built-in speakers and doesn't require voice cloning
MODEL_NAME = "tts_models/en/vctk/vits"

# Audio sample rate for VITS output
SAMPLE_RATE = 22050

# Default speaker ID (p225 is a clear female voice)
DEFAULT_SPEAKER = "p225"


def get_device():
    """Determine the best available device for inference.
    
    Raises:
        RuntimeError: If no GPU is available. CPU-only inference is too slow
            for practical voice chat use.
    """
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
    """Load the VITS model on startup."""
    global tts
    device = get_device()
    
    logger.info("Loading VITS model...")
    
    # Load the model using Coqui TTS API and move to device
    tts = TTS(MODEL_NAME).to(device)
    
    logger.info("Model loaded successfully")
    return tts


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for container orchestration."""
    # Get available speakers from the model
    speakers = []
    if tts is not None and hasattr(tts, 'speakers'):
        speakers = tts.speakers if tts.speakers else []
    
    return jsonify({
        "status": "healthy",
        "model_loaded": tts is not None,
        "available_speakers": speakers[:20] if len(speakers) > 20 else speakers,  # Limit response size
        "total_speakers": len(speakers)
    })


@app.route('/synthesize', methods=['POST'])
def synthesize():
    """
    Synthesize speech from text.
    
    Expects a JSON body with:
    - 'text' (required): The text to synthesize
    - 'speaker_id' (optional): Speaker ID from the model (default: "p225")
    
    Use GET /health to see available speaker IDs.
    
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
    speaker_id = data.get('speaker_id', DEFAULT_SPEAKER)
    
    if not text or not text.strip():
        logger.warning("Empty text provided")
        return jsonify({"error": "Text cannot be empty"}), 400
    
    # Validate speaker_id if model has speakers
    if tts.speakers and speaker_id not in tts.speakers:
        logger.warning(f"Invalid speaker_id: {speaker_id}")
        return jsonify({
            "error": f"Invalid speaker_id: {speaker_id}",
            "available_speakers": tts.speakers[:20] if len(tts.speakers) > 20 else tts.speakers
        }), 400
    
    try:
        logger.info(f"Synthesizing speech for text (speaker={speaker_id}): {text[:100]}...")
        
        # Generate speech using VITS with speaker ID
        wav = tts.tts(text=text, speaker=speaker_id)
        
        # Write to buffer as WAV
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, wav, SAMPLE_RATE, format='WAV')
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
