#!/usr/bin/env python3
"""
Warmup script to pre-compile the ONNX model during Docker build.

This forces ONNX Runtime to compile and optimize the model graph,
which can take significant time on first run. By doing this during
build, container startup is much faster.
"""

import os
import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    # Import here to catch any import errors
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    
    model_path = os.environ.get("KOKORO_MODEL_PATH", "/app/models/kokoro-v1.0.onnx")
    voices_path = os.environ.get("KOKORO_VOICES_PATH", "/app/models/voices-v1.0.bin")
    
    logger.info(f"Available ONNX Runtime providers: {ort.get_available_providers()}")
    logger.info(f"Loading model from: {model_path}")
    logger.info(f"Loading voices from: {voices_path}")
    
    # Use MIGraphX provider for warmup to pre-compile the model graph
    providers = ['MIGraphXExecutionProvider']
    logger.info(f"Using providers for warmup: {providers}")
    
    # Create ONNX session and Kokoro instance
    session = ort.InferenceSession(model_path, providers=providers)
    kokoro = Kokoro.from_session(session, voices_path)
    
    logger.info("Model loaded, running warmup inference...")
    
    # Run a simple TTS call to force graph compilation
    audio_samples, sample_rate = kokoro.create(
        text="The melting point of iron is 1,538 degrees Fahrenheit, or 837 degrees Celsius. That’s pretty hot! Would you like to know more?",
        voice="af_heart",
        speed=1.0,
        lang="en-us"
    )
    
    logger.info(f"Warmup complete! Generated {len(audio_samples)} samples at {sample_rate}Hz")
    
    # Save the audio sample
    import soundfile as sf
    output_path = "/app/models/warmup_sample.wav"
    sf.write(output_path, audio_samples, sample_rate)
    logger.info(f"Audio sample saved to: {output_path}")
    
    logger.info("ONNX model compilation successful")
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        logger.error(f"Warmup failed: {e}")
        sys.exit(1)
