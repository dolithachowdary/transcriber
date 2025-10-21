"""Configuration settings for Whisper server optimizations"""

from typing import Dict, Any
import os

class Config:
    """Configuration class for Whisper server optimizations"""
    
    # Audio processing settings
    AUDIO_CHUNK_SIZE = int(os.getenv('AUDIO_CHUNK_SIZE', 1024))
    AUDIO_BUFFER_MAX_SIZE = int(os.getenv('AUDIO_BUFFER_MAX_SIZE', 50 * 1024 * 1024))  # 50MB
    AUDIO_SAMPLE_RATE = int(os.getenv('AUDIO_SAMPLE_RATE', 16000))
    
    # Model settings
    MODEL_SIZE = os.getenv('WHISPER_MODEL_SIZE', 'base')
    DEVICE = os.getenv('WHISPER_DEVICE', 'auto')  # auto, cpu, cuda
    COMPUTE_TYPE = os.getenv('WHISPER_COMPUTE_TYPE', 'float16')  # float16, int8, int16
    
    # Performance settings
    BATCH_SIZE = int(os.getenv('TRANSCRIPTION_BATCH_SIZE', 4))
    MAX_CONCURRENT_TRANSCRIPTIONS = int(os.getenv('MAX_CONCURRENT_TRANSCRIPTIONS', 10))
    
    # Cache settings
    CACHE_SIZE = int(os.getenv('TRANSCRIPTION_CACHE_SIZE', 1000))
    CACHE_TTL = int(os.getenv('TRANSCRIPTION_CACHE_TTL', 3600))  # 1 hour
    
    # WebSocket settings
    WS_MAX_CONNECTIONS = int(os.getenv('WS_MAX_CONNECTIONS', 100))
    WS_RATE_LIMIT = int(os.getenv('WS_RATE_LIMIT', 10))  # messages per second
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    ENABLE_METRICS = os.getenv('ENABLE_METRICS', 'true').lower() == 'true'
    
    @classmethod
    def get_model_config(cls) -> Dict[str, Any]:
        """Get model configuration"""
        return {
            'model_size': cls.MODEL_SIZE,
            'device': cls.DEVICE,
            'compute_type': cls.COMPUTE_TYPE,
            'batch_size': cls.BATCH_SIZE
        }
