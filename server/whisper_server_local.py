#!/usr/bin/env python3
"""
Local version of the whisper server using SQLite instead of MongoDB
"""

import asyncio
import json
import logging
import numpy as np
import torch
import queue
import threading
import webrtcvad
import sounddevice as sd
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from faster_whisper import WhisperModel
import os
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List, Optional
from difflib import SequenceMatcher

# Local imports
from summarization import OfflineSummarizer
from local_database import local_db

import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="webrtcvad")

# Additional imports for serving static files
import sys
from fastapi.staticfiles import StaticFiles

# Pydantic models for request/response
class MeetingCreate(BaseModel):
    meeting_name: str
    transcript: List[dict]
    summary: Optional[str] = None

class MeetingResponse(BaseModel):
    meeting_id: str
    meeting_name: str
    transcript: List[dict]
    summary: Optional[str] = None
    created_at: str
    audio_file_path: Optional[str] = None

class MeetingListResponse(BaseModel):
    meeting_id: str
    meeting_name: str
    created_at: str
    summary: Optional[str] = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Meeting Transcriber Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static file serving for bundled app ---
# Determine the path for static files based on whether the app is frozen
if getattr(sys, 'frozen', False):
    # Path when running from a PyInstaller bundle
    static_files_dir = os.path.join(sys._MEIPASS, 'dist')
else:
    # Path when running in a development environment
    # Assumes server/whisper_server_local.py is the script location
    # and dist is at the project root.
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_files_dir = os.path.join(project_root, 'dist')

# Mount the static files directory to serve the React frontend
if os.path.exists(static_files_dir):
    app.mount("/", StaticFiles(directory=static_files_dir, html=True), name="static")
    logger.info(f"Serving static files from {static_files_dir}")
else:
    logger.warning(f"Static files directory not found at: {static_files_dir}")
    logger.warning("Frontend will not be served. Run 'npm run build' in the root directory.")
# -----------------------------------------

# Microphone configuration
SAMPLE_RATE = 16000
FRAME_DURATION = 30  # ms
FRAME_SIZE = int(SAMPLE_RATE * FRAME_DURATION / 1000)
CHANNELS = 1

class WhisperTranscriber:
    def __init__(self):
        self.whisper_model = None
        self.audio_buffer = np.array([], dtype=np.float32)
        self.sample_rate = SAMPLE_RATE
        self.chunk_duration = 10.0
        self.min_chunk_duration = 0.5
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.compute_type = "float16" if self.device == "cuda" else "int8"
        self.whisper_model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        self.last_chunk_end = 0.0
        
        # Microphone state
        self.mic_running = False
        self.mic_queue = queue.Queue()
        self.vad = webrtcvad.Vad(2)
        self.mic_thread = None
        self.vad_thread = None
        
        # Session state for summarization
        self.session_transcript = []
        self.session_lock = threading.Lock()
        
        # Transcription cache
        self.transcription_cache = set()
        self.cache_lock = threading.Lock()
        self.cache_timestamps = {}
        self.cache_timeout = 30

    async def initialize_models(self):
        """Initialize Whisper model"""
        try:
            logger.info(f"Loading Whisper model ({self.whisper_model_size}) on {self.device}...")
            
            # Use local models directory
            models_dir = os.path.join(os.path.dirname(__file__), "models")
            self.whisper_model = WhisperModel(
                self.whisper_model_size,
                device=self.device,
                compute_type=self.compute_type,
                download_root=models_dir
            )
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Error initializing model: {e}")
            raise
    
    def bytes_to_audio(self, audio_bytes):
        """Convert audio bytes to numpy array"""
        try:
            audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
            return audio_data.astype(np.float32) / 32768.0
        except Exception as e:
            logger.error(f"Error converting audio bytes: {e}")
            return None

    def is_duplicate_transcription(self, text):
        """Check if transcription is a duplicate"""
        with self.cache_lock:
            current_time = time.time()
            
            # Clean up old cache entries
            expired_keys = []
            for cached_text, timestamp in self.cache_timestamps.items():
                if current_time - timestamp > self.cache_timeout:
                    expired_keys.append(cached_text)
                    self.transcription_cache.discard(cached_text)
            
            for key in expired_keys:
                del self.cache_timestamps[key]
            
            normalized_text = ' '.join(text.strip().split())
            
            for cached_text in self.transcription_cache:
                if normalized_text == cached_text:
                    self.cache_timestamps[cached_text] = current_time
                    return True
                
                if normalized_text in cached_text or cached_text in normalized_text:
                    self.cache_timestamps[cached_text] = current_time
                    return True
            
            if normalized_text:
                self.transcription_cache.add(normalized_text)
                self.cache_timestamps[normalized_text] = current_time
            
            return False
    
    def clear_transcription_cache(self):
        """Clear the transcription cache"""
        with self.cache_lock:
            self.transcription_cache.clear()
            self.cache_timestamps.clear()
    
    async def transcribe_audio(self, audio_data, adjust_timestamps=True):
        """Transcribe audio with Whisper"""
        try:
            segments, _ = self.whisper_model.transcribe(
                audio_data,
                language="en",
                beam_size=5,
                vad_filter=True,
                word_timestamps=False,
                without_timestamps=True,
                temperature=0.2
            )
            
            results = []
            for segment in segments:
                if not segment.text.strip():
                    continue
                
                if self.is_duplicate_transcription(segment.text):
                    continue
                
                if adjust_timestamps:
                    start = self.last_chunk_end + segment.start
                    end = self.last_chunk_end + segment.end
                    timestamp = f"{int(start//60):02d}:{int(start%60):02d}"
                else:
                    start = segment.start
                    end = segment.end
                    timestamp = f"{int(start//60):02d}:{int(start%60):02d}"
                
                results.append({
                    'speaker': 'Speaker',
                    'text': segment.text.strip(),
                    'start': start,
                    'end': end,
                    'timestamp': timestamp
                })
                
                if adjust_timestamps:
                    self.last_chunk_end = end
                
            return results
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return []

    async def process_audio(self, audio_bytes):
        """Process audio data through buffer"""
        new_audio = self.bytes_to_audio(audio_bytes)
        if new_audio is None:
            return []
        
        self.audio_buffer = np.concatenate((self.audio_buffer, new_audio))
        
        buffer_duration = len(self.audio_buffer) / self.sample_rate
        results = []
        
        while buffer_duration >= self.chunk_duration:
            chunk_samples = int(self.chunk_duration * self.sample_rate)
            chunk_data = self.audio_buffer[:chunk_samples]
            
            segments = await self.transcribe_audio(chunk_data)
            results.extend(segments)
            
            keep_samples = int(0.5 * self.sample_rate)
            self.audio_buffer = self.audio_buffer[chunk_samples - keep_samples:]
            buffer_duration = len(self.audio_buffer) / self.sample_rate
        
        return results

    # Microphone functions
    def mic_callback(self, indata, frames, time, status):
        """Sounddevice callback for microphone input"""
        if status:
            logger.warning(f"Audio input status: {status}")
        self.mic_queue.put(bytes(indata))

    async def vad_collector(self, websocket):
        """Collect and transcribe voiced audio chunks"""
        buffer = []
        voiced = False
        while self.mic_running:
            try:
                frame = self.mic_queue.get(timeout=0.1)
                is_speech = self.vad.is_speech(frame, SAMPLE_RATE)
                
                if is_speech:
                    voiced = True
                    buffer.append(frame)
                elif voiced:
                    audio_chunk = b"".join(buffer)
                    audio_np = np.frombuffer(audio_chunk, np.int16).astype(np.float32) / 32768.0
                    
                    segments = await self.transcribe_audio(audio_np, adjust_timestamps=False)
                    
                    if segments:
                        with self.session_lock:
                            self.session_transcript.extend([seg['text'] for seg in segments])
                        
                        response = {
                            "type": "transcription",
                            "segments": segments,
                            "source": "microphone"
                        }
                        await websocket.send_text(json.dumps(response))
                    
                    buffer = []
                    voiced = False
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"VAD error: {e}")

    def start_microphone(self, websocket):
        """Start microphone capture and VAD processing"""
        if self.mic_running:
            logger.warning("Microphone already running")
            return
        
        with self.session_lock:
            self.session_transcript = []
        
        self.mic_running = True
        
        self.mic_thread = threading.Thread(
            target=sd.InputStream,
            kwargs={
                'samplerate': SAMPLE_RATE,
                'channels': CHANNELS,
                'dtype': 'int16',
                'blocksize': FRAME_SIZE,
                'callback': self.mic_callback
            },
            daemon=True
        )
        self.mic_thread.start()
        
        self.vad_thread = threading.Thread(
            target=lambda: asyncio.run(self.vad_collector(websocket)),
            daemon=True
        )
        self.vad_thread.start()
        
        logger.info("Microphone recording started")

    def stop_microphone(self):
        """Stop microphone capture and processing"""
        if not self.mic_running:
            return
            
        self.mic_running = False
        sd.stop()
        
        if self.mic_thread:
            self.mic_thread.join(timeout=1.0)
        if self.vad_thread:
            self.vad_thread.join(timeout=1.0)
            
        while not self.mic_queue.empty():
            self.mic_queue.get()
            
        logger.info("Microphone recording stopped")
    
    def get_session_transcript(self):
        """Get the full transcript for the current session"""
        with self.session_lock:
            return " ".join(self.session_transcript)

# Global instances
transcriber = WhisperTranscriber()
summarizer = OfflineSummarizer()

@app.on_event("startup")
async def startup_event():
    await transcriber.initialize_models()

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    transcriber.clear_transcription_cache()
    transcriber.last_chunk_end = 0.0
    transcriber.audio_buffer = np.array([], dtype=np.float32)
    
    session_transcript = []
    
    try:
        while True:
            try:
                data = await websocket.receive_bytes()
                segments = await transcriber.process_audio(data)
                
                if segments:
                    for segment in segments:
                        session_transcript.append(segment['text'])
                    
                    response = {
                        "type": "transcription",
                        "segments": segments,
                        "source": "websocket"
                    }
                    await websocket.send_text(json.dumps(response))
            except Exception as e:
                logger.error(f"Error processing audio data: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")
        
        if len(transcriber.audio_buffer) / transcriber.sample_rate > transcriber.min_chunk_duration:
            segments = await transcriber.transcribe_audio(transcriber.audio_buffer)
            if segments:
                for segment in segments:
                    session_transcript.append(segment['text'])
                
                response = {
                    "type": "transcription",
                    "segments": segments,
                    "is_final": True
                }
                await websocket.send_text(json.dumps(response))
        
        if session_transcript:
            full_transcript = " ".join(session_transcript)
            if full_transcript:
                summary = summarizer.summarize(full_transcript)
                
                response = {
                    "type": "summary",
                    "text": summary,
                    "transcript_length": len(full_transcript)
                }
                await websocket.send_text(json.dumps(response))
        
        transcriber.audio_buffer = np.array([], dtype=np.float32)
        transcriber.last_chunk_end = 0.0
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()

@app.websocket("/ws/microphone")
async def microphone_ws(websocket: WebSocket):
    await websocket.accept()
    logger.info("Microphone WebSocket connection established")
    
    transcriber.clear_transcription_cache()
    
    try:
        transcriber.start_microphone(websocket)
        
        while transcriber.mic_running:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=0.5)
                
                if "text" in message:
                    data = message["text"]
                    if isinstance(data, str) and data.lower() == "stop":
                        logger.info("Received stop command from client")
                        break
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.warning(f"Error receiving message: {e}")
                continue
                
    except WebSocketDisconnect:
        logger.info("Microphone WebSocket disconnected")
    except Exception as e:
        logger.error(f"Microphone error: {e}")
    finally:
        transcriber.stop_microphone()
        
        full_transcript = transcriber.get_session_transcript()
        if full_transcript:
            summary = summarizer.summarize(full_transcript)
            
            response = {
                "type": "summary",
                "text": summary,
                "transcript_length": len(full_transcript)
            }
            await websocket.send_text(json.dumps(response))
        else:
            await websocket.send_text(json.dumps({
                "type": "summary",
                "text": "No transcript available for summarization"
            }))
            
        await websocket.close()
        logger.info("Microphone processing stopped")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "whisper_model_loaded": transcriber.whisper_model is not None
    }

# ===== MEETING DATABASE ENDPOINTS =====

@app.post("/meetings", response_model=MeetingResponse)
async def save_meeting(meeting_data: MeetingCreate):
    """Save a meeting to the local database"""
    try:
        meeting_id = local_db.save_meeting({
            'meeting_name': meeting_data.meeting_name,
            'transcript': meeting_data.transcript,
            'summary': meeting_data.summary
        })
        
        return MeetingResponse(
            meeting_id=meeting_id,
            meeting_name=meeting_data.meeting_name,
            transcript=meeting_data.transcript,
            summary=meeting_data.summary,
            created_at=datetime.now().isoformat(),
            audio_file_path=None
        )
    except Exception as e:
        logger.error(f"Error saving meeting: {e}")
        raise HTTPException(status_code=500, detail="Failed to save meeting")

@app.get("/meetings", response_model=List[MeetingListResponse])
async def list_meetings():
    """List all meetings"""
    try:
        meetings = local_db.get_all_meetings()
        return [MeetingListResponse(
            meeting_id=m['meeting_id'],
            meeting_name=m['meeting_name'],
            created_at=m['created_at'],
            summary=m.get('summary')
        ) for m in meetings]
    except Exception as e:
        logger.error(f"Error retrieving meetings: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve meetings")

@app.get("/meetings/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str):
    """Get a specific meeting by ID"""
    try:
        meeting = local_db.get_meeting(meeting_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        return MeetingResponse(
            meeting_id=meeting['meeting_id'],
            meeting_name=meeting['meeting_name'],
            transcript=meeting['transcript'],
            summary=meeting['summary'],
            created_at=meeting['created_at'],
            audio_file_path=meeting.get('audio_file_path')
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving meeting: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve meeting")

@app.post("/meetings/{meeting_id}/audio")
async def save_meeting_audio(meeting_id: str, request: Request):
    """Save audio file for a meeting"""
    try:
        audio_data = await request.body()
        
        # Save audio file to local storage
        audio_dir = os.path.join(os.getenv('APPDATA', ''), 'MeetingTranscriber', 'audio')
        os.makedirs(audio_dir, exist_ok=True)
        
        filename = f"meeting_{meeting_id}.wav"
        file_path = os.path.join(audio_dir, filename)
        
        with open(file_path, 'wb') as f:
            f.write(audio_data)
        
        # Update meeting with audio file path
        local_db.save_meeting({
            'meeting_id': meeting_id,
            'audio_file_path': file_path
        })
        
        return {"message": "Audio saved successfully", "file_path": file_path}
    except Exception as e:
        logger.error(f"Error saving audio: {e}")
        raise HTTPException(status_code=500, detail="Failed to save audio")

@app.get("/meetings/{meeting_id}/audio")
async def get_meeting_audio(meeting_id: str):
    """Get audio file for a meeting"""
    try:
        meeting = local_db.get_meeting(meeting_id)
        if not meeting or not meeting.get('audio_file_path'):
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        file_path = meeting['audio_file_path']
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        with open(file_path, 'rb') as f:
            audio_data = f.read()
        
        return Response(content=audio_data, media_type="audio/wav")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving audio: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve audio")

@app.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str):
    """Delete a meeting by ID"""
    try:
        success = local_db.delete_meeting(meeting_id)
        if not success:
            raise HTTPException(status_code=404, detail="Meeting not found")
        return {"message": "Meeting deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting meeting: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete meeting")

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8765,
        log_level="info"
    )
