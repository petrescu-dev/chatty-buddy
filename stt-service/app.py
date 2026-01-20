"""
Speech-to-Text Service using OpenAI Whisper

This Flask service provides an HTTP endpoint for transcribing audio files
using the Whisper small.en model optimized for English speech recognition.

Endpoint:
    POST /transcribe
    - Accepts: Audio file (WAV, WebM, MP3, etc.)
    - Returns: JSON { "text": "transcribed text" }
"""

import os
import tempfile
import logging
from flask import Flask, request, jsonify
import whisper
import torch

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Global model instance (loaded once at startup)
model = None


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
    """Load the Whisper model on startup."""
    global model
    device = get_device()
    logger.info("Loading Whisper small.en model...")
    model = whisper.load_model("small.en", device=device)
    logger.info("Model loaded successfully")
    return model


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for container orchestration."""
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "device": str(next(model.parameters()).device) if model else None
    })


@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio file to text.
    
    Expects a file upload with key 'audio' containing the audio data.
    Supports various audio formats including WAV, WebM, MP3, etc.
    
    Returns:
        JSON object with 'text' field containing the transcription
    """
    # Check if audio file is present in request
    if 'audio' not in request.files:
        logger.warning("No audio file provided in request")
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    
    if audio_file.filename == '':
        logger.warning("Empty filename in request")
        return jsonify({"error": "No audio file selected"}), 400
    
    try:
        # Save uploaded file to temporary location
        # Whisper requires a file path, not a file object
        with tempfile.NamedTemporaryFile(delete=False, suffix=_get_suffix(audio_file.filename)) as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name
        
        logger.info(f"Processing audio file: {audio_file.filename}")
        
        # Transcribe the audio (fp16=True for GPU inference)
        result = model.transcribe(tmp_path, fp16=True)
        
        transcription = result["text"].strip()
        logger.info(f"Transcription complete: {len(transcription)} characters")
        
        return jsonify({"text": transcription})
    
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500
    
    finally:
        # Clean up temporary file
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _get_suffix(filename):
    """Extract file suffix from filename for temporary file."""
    if '.' in filename:
        return '.' + filename.rsplit('.', 1)[1].lower()
    return '.wav'  # Default to .wav if no extension


# Load model at startup when running directly or with Gunicorn
with app.app_context():
    load_model()


if __name__ == '__main__':
    # Development server - use Gunicorn in production
    app.run(host='0.0.0.0', port=8001, debug=False)
