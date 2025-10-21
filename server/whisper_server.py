# import asyncio
# import json
# import logging
# import numpy as np
# import torch
# import queue
# import threading
# import webrtcvad
# import sounddevice as sd
# import time
# from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
# from starlette.responses import StreamingResponse
# from fastapi.middleware.cors import CORSMiddleware
# import uvicorn
# from faster_whisper import WhisperModel
# import os
# import uuid
# from datetime import datetime, timezone
# from pydantic import BaseModel
# from typing import List, Optional
# from difflib import SequenceMatcher

# # Local imports
# from summarization import OfflineSummarizer  # Import our new summarizer
# from database import db_manager

# import warnings
# warnings.filterwarnings("ignore", category=UserWarning, module="webrtcvad")

# # Pydantic models for request/response
# class MeetingCreate(BaseModel):
#     meeting_name: str
#     transcript: List[dict]
#     summary: Optional[str] = None

# class MeetingResponse(BaseModel):
#     meeting_id: str
#     meeting_name: str
#     transcript: List[dict]
#     summary: Optional[str] = None
#     created_at: datetime
#     audio_file_id: Optional[str] = None

# class MeetingListResponse(BaseModel):
#     meeting_id: str
#     meeting_name: str
#     created_at: datetime
#     summary: Optional[str] = None

# # Configure logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# app = FastAPI(title="Whisper Transcription Server")

# # Add CORS middleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Add middleware to handle CORS for all routes
# @app.middleware("http")
# async def add_cors_header(request, call_next):
#     response = await call_next(request)
#     response.headers["Access-Control-Allow-Origin"] = "*"
#     response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
#     response.headers["Access-Control-Allow-Headers"] = "*"
#     return response

# # Microphone configuration
# SAMPLE_RATE = 16000
# FRAME_DURATION = 30  # ms
# FRAME_SIZE = int(SAMPLE_RATE * FRAME_DURATION / 1000)
# CHANNELS = 1

# class WhisperTranscriber:
#     def __init__(self):
#         self.whisper_model = None
#         self.audio_buffer = np.array([], dtype=np.float32)
#         self.sample_rate = SAMPLE_RATE
#         self.chunk_duration = 5.0  # Process every 5 seconds
#         self.min_chunk_duration = 0.5  # Minimum chunk size
#         self.device = "cuda" if torch.cuda.is_available() else "cpu"
#         self.compute_type = "float16" if self.device == "cuda" else "int8"
#         self.whisper_model_size = os.getenv("WHISPER_MODEL_SIZE", "small")
#         self.last_chunk_end = 0.0  # Track end time of last segment
        
#         # Microphone state
#         self.mic_running = False
#         self.mic_queue = queue.Queue()
#         self.vad = webrtcvad.Vad(2)  # Aggressiveness 0-3
#         self.mic_thread = None
#         self.vad_thread = None
        
#         # Session state for summarization
#         self.session_transcript = []
#         self.session_lock = threading.Lock()
        
#         # Transcription cache to prevent duplicates
#         self.transcription_cache = set()
#         self.cache_lock = threading.Lock()
#         self.cache_timestamps = {}  # Track when items were added to cache
#         self.cache_timeout = 30  # Clear cache items older than 30 seconds



#     def is_similar(a, b, threshold=0.9):
#         return SequenceMatcher(None, a, b).ratio() >= threshold

#     def is_duplicate_transcription(self, text):
#         normalized = ' '.join(text.strip().split())
#         with self.cache_lock:
#             # Check with improve similarity
#             for cached_text in self.transcription_cache:
#                 if is_similar(normalized, cached_text):
#                     return True
#             # On no similar, save
#             if normalized:
#                 self.transcription_cache.add(normalized)
#             return False
        
#     async def initialize_models(self):
#         """Initialize Whisper model"""
#         try:
#             logger.info(f"Loading Whisper model ({self.whisper_model_size}) on {self.device}...")
#             self.whisper_model = WhisperModel(
#                 self.whisper_model_size,
#                 device=self.device,
#                 compute_type=self.compute_type,
#                 download_root="./models"
#             )
#             logger.info("Whisper model loaded successfully")
#         except Exception as e:
#             logger.error(f"Error initializing model: {e}")
#             raise
    
#     def bytes_to_audio(self, audio_bytes):
#         """Convert audio bytes to numpy array"""
#         try:
#             # Add debugging to see what type of data we're receiving
#             logger.info(f"bytes_to_audio received data type: {type(audio_bytes)}, length: {len(audio_bytes) if hasattr(audio_bytes, '__len__') else 'N/A'}")
            
#             # Convert 16-bit PCM to float32
#             audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
#             return audio_data.astype(np.float32) / 32768.0
#         except Exception as e:
#             logger.error(f"Error converting audio bytes: {e}")
#             return None

#     def is_duplicate_transcription(self, text):
#         """Check if transcription is a duplicate and add to cache if not"""
#         with self.cache_lock:
#             current_time = time.time()
            
#             # Clean up old cache entries
#             expired_keys = []
#             for cached_text, timestamp in self.cache_timestamps.items():
#                 if current_time - timestamp > self.cache_timeout:
#                     expired_keys.append(cached_text)
#                     self.transcription_cache.discard(cached_text)
            
#             for key in expired_keys:
#                 del self.cache_timestamps[key]
            
#             # Normalize text for comparison (remove extra whitespace)
#             normalized_text = ' '.join(text.strip().split())
            
#             # Check if text or similar text already exists in cache
#             for cached_text in self.transcription_cache:
#                 # Exact match
#                 if normalized_text == cached_text:
#                     # Update timestamp for this entry
#                     self.cache_timestamps[cached_text] = current_time
#                     return True
                
#                 # Partial overlap (one text contains the other)
#                 if normalized_text in cached_text or cached_text in normalized_text:
#                     # Update timestamp for this entry
#                     self.cache_timestamps[cached_text] = current_time
#                     return True
            
#             # Not a duplicate, add to cache
#             if normalized_text:
#                 self.transcription_cache.add(normalized_text)
#                 self.cache_timestamps[normalized_text] = current_time
            
#             return False
    
#     def clear_transcription_cache(self):
#         """Clear the transcription cache"""
#         with self.cache_lock:
#             self.transcription_cache.clear()
#             self.cache_timestamps.clear()
    
#     async def transcribe_audio(self, audio_data, adjust_timestamps=True):
#         """Transcribe audio with Whisper"""
#         try:
#             segments, _ = self.whisper_model.transcribe(
#                 audio_data,
#                 language="en",
#                 beam_size=5,
#                 vad_filter=True,
#                 word_timestamps=False,
#                 without_timestamps=True,
#                 temperature=0.2
#             )
            
#             results = []
#             for segment in segments:
#                 # Skip empty segments
#                 if not segment.text.strip():
#                     continue
                
#                 # Check for duplicates before adding
#                 if self.is_duplicate_transcription(segment.text):
#                     continue
                
#                 # Adjust timestamps if needed
#                 if adjust_timestamps:
#                     start = self.last_chunk_end + segment.start
#                     end = self.last_chunk_end + segment.end
#                     timestamp = f"{int(start//60):02d}:{int(start%60):02d}"
#                 else:
#                     start = segment.start
#                     end = segment.end
#                     timestamp = f"{int(start//60):02d}:{int(start%60):02d}"
                
#                 results.append({
#                     'speaker': 'Speaker',
#                     'text': segment.text.strip(),
#                     'start': start,
#                     'end': end,
#                     'timestamp': timestamp
#                 })
                
#                 if adjust_timestamps:
#                     self.last_chunk_end = end
                
#             return results
            
#         except Exception as e:
#             logger.error(f"Transcription error: {e}")
#             return []

#     async def process_audio(self, audio_bytes):
#         """Process audio data through buffer"""
#         # Add debugging to see what type of data we're receiving
#         logger.info(f"Received audio data type: {type(audio_bytes)}, length: {len(audio_bytes) if hasattr(audio_bytes, '__len__') else 'N/A'}")
        
#         new_audio = self.bytes_to_audio(audio_bytes)
#         if new_audio is None:
#             return []
        
#         # Add to buffer
#         self.audio_buffer = np.concatenate((self.audio_buffer, new_audio))
        
#         # Check if we have enough data
#         buffer_duration = len(self.audio_buffer) / self.sample_rate
#         results = []
        
#         # Process while we have full chunks
#         while buffer_duration >= self.chunk_duration:
#             # Extract a chunk
#             chunk_samples = int(self.chunk_duration * self.sample_rate)
#             chunk_data = self.audio_buffer[:chunk_samples]
            
#             # Transcribe the chunk
#             # The transcribe_audio method now handles duplicate filtering
#             segments = await self.transcribe_audio(chunk_data)
#             results.extend(segments)
            
#             # Remove processed audio (keep last 0.5s for context)
#             keep_samples = int(0.5 * self.sample_rate)
#             self.audio_buffer = self.audio_buffer[chunk_samples - keep_samples:]
#             buffer_duration = len(self.audio_buffer) / self.sample_rate
        
#         return results

#     # ===== MICROPHONE/VAD FUNCTIONS =====
#     def mic_callback(self, indata, frames, time, status):
#         """Sounddevice callback for microphone input"""
#         if status:
#             logger.warning(f"Audio input status: {status}")
#         self.mic_queue.put(bytes(indata))

#     async def vad_collector(self, websocket):
#         """Collect and transcribe voiced audio chunks"""
#         buffer = []
#         voiced = False
#         while self.mic_running:
#             try:
#                 frame = self.mic_queue.get(timeout=0.1)
#                 is_speech = self.vad.is_speech(frame, SAMPLE_RATE)
                
#                 if is_speech:
#                     voiced = True
#                     buffer.append(frame)
#                 elif voiced:
#                     # End of speech segment
#                     audio_chunk = b"".join(buffer)
#                     audio_np = np.frombuffer(audio_chunk, np.int16).astype(np.float32) / 32768.0
                    
#                     # Transcribe the chunk without adjusting timestamps
#                     # The transcribe_audio method now handles duplicate filtering
#                     segments = await self.transcribe_audio(audio_np, adjust_timestamps=False)
                    
#                     if segments:
#                         # Store text for summarization
#                         with self.session_lock:
#                             self.session_transcript.extend([seg['text'] for seg in segments])
                        
#                         # Send to client
#                         response = {
#                             "type": "transcription",
#                             "segments": segments,
#                             "source": "microphone"
#                         }
#                         await websocket.send_text(json.dumps(response))
                    
#                     # Reset buffer
#                     buffer = []
#                     voiced = False
#             except queue.Empty:
#                 continue
#             except Exception as e:
#                 logger.error(f"VAD error: {e}")

#     def start_microphone(self, websocket):
#         """Start microphone capture and VAD processing"""
#         if self.mic_running:
#             logger.warning("Microphone already running")
#             return
        
#         # Reset session state
#         with self.session_lock:
#             self.session_transcript = []
        
#         self.mic_running = True
        
#         # Start microphone input
#         self.mic_thread = threading.Thread(
#             target=sd.InputStream,
#             kwargs={
#                 'samplerate': SAMPLE_RATE,
#                 'channels': CHANNELS,
#                 'dtype': 'int16',
#                 'blocksize': FRAME_SIZE,
#                 'callback': self.mic_callback
#             },
#             daemon=True
#         )
#         self.mic_thread.start()
        
#         # Start VAD processing
#         self.vad_thread = threading.Thread(
#             target=lambda: asyncio.run(self.vad_collector(websocket)),
#             daemon=True
#         )
#         self.vad_thread.start()
        
#         logger.info("Microphone recording started")

#     def stop_microphone(self):
#         """Stop microphone capture and processing"""
#         if not self.mic_running:
#             return
            
#         self.mic_running = False
#         sd.stop()
        
#         if self.mic_thread:
#             self.mic_thread.join(timeout=1.0)
#         if self.vad_thread:
#             self.vad_thread.join(timeout=1.0)
            
#         # Clear queue
#         while not self.mic_queue.empty():
#             self.mic_queue.get()
            
#         logger.info("Microphone recording stopped")
    
#     def get_session_transcript(self):
#         """Get the full transcript for the current session"""
#         with self.session_lock:
#             return " ".join(self.session_transcript)

# # Global instances
# transcriber = WhisperTranscriber()
# summarizer = OfflineSummarizer()  # Use our offline summarizer

# @app.on_event("startup")
# async def startup_event():
#     await transcriber.initialize_models()

# @app.websocket("/ws/transcribe")
# async def websocket_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     logger.info("WebSocket connection established")
    
#     # Clear transcription cache for new session
#     transcriber.clear_transcription_cache()
#     transcriber.last_chunk_end = 0.0
#     transcriber.audio_buffer = np.array([], dtype=np.float32)
    
#     # Store session transcript for summarization
#     session_transcript = []
    
#     try:
#         while True:
#             try:
#                 data = await websocket.receive_bytes()
#                 segments = await transcriber.process_audio(data)
                
#                 if segments:
#                     # Store text for summarization
#                     for segment in segments:
#                         session_transcript.append(segment['text'])
                    
#                     response = {
#                         "type": "transcription",
#                         "segments": segments,
#                         "source": "websocket"
#                     }
#                     await websocket.send_text(json.dumps(response))
#             except Exception as e:
#                 logger.error(f"Error processing audio data: {e}")
#                 # Break the loop if we encounter an error to properly handle disconnections
#                 break
                
#     except WebSocketDisconnect:
#         logger.info("WebSocket connection closed")
#         # Process remaining audio on disconnect
#         if len(transcriber.audio_buffer) / transcriber.sample_rate > transcriber.min_chunk_duration:
#             segments = await transcriber.transcribe_audio(transcriber.audio_buffer)
#             if segments:
#                 # Store text for summarization
#                 for segment in segments:
#                     session_transcript.append(segment['text'])
                
#                 response = {
#                     "type": "transcription",
#                     "segments": segments,
#                     "is_final": True
#                 }
#                 await websocket.send_text(json.dumps(response))
        
#         # Generate summary after disconnect
#         if session_transcript:
#             full_transcript = " ".join(session_transcript)
#             if full_transcript:
#                 # Generate summary
#                 summary = summarizer.summarize(full_transcript)
                
#                 # Send summary to client
#                 response = {
#                     "type": "summary",
#                     "text": summary,
#                     "transcript_length": len(full_transcript)
#                 }
#                 await websocket.send_text(json.dumps(response))
        
#         # Reset state
#         transcriber.audio_buffer = np.array([], dtype=np.float32)
#         transcriber.last_chunk_end = 0.0
#     except Exception as e:
#         logger.error(f"WebSocket error: {e}")
#         await websocket.close()

# @app.websocket("/ws/microphone")
# async def microphone_ws(websocket: WebSocket):
#     await websocket.accept()
#     logger.info("Microphone WebSocket connection established")
    
#     # Clear transcription cache for new session
#     transcriber.clear_transcription_cache()
    
#     try:
#         # Start microphone capture
#         transcriber.start_microphone(websocket)
        
#         # Keep connection alive while processing
#         while transcriber.mic_running:
#             # Check for stop command from client
#             try:
#                 # Use receive() to handle both text and bytes messages
#                 message = await asyncio.wait_for(websocket.receive(), timeout=0.5)
                
#                 # Check if it's a text message
#                 if "text" in message:
#                     data = message["text"]
#                     if isinstance(data, str) and data.lower() == "stop":
#                         logger.info("Received stop command from client")
#                         break
#                 # Ignore bytes messages (audio data is handled by the mic thread)
#             except asyncio.TimeoutError:
#                 continue
#             except Exception as e:
#                 logger.warning(f"Error receiving message: {e}")
#                 continue
                
#     except WebSocketDisconnect:
#         logger.info("Microphone WebSocket disconnected")
#     except Exception as e:
#         logger.error(f"Microphone error: {e}")
#     finally:
#         transcriber.stop_microphone()
        
#         # Generate summary after stopping
#         full_transcript = transcriber.get_session_transcript()
#         if full_transcript:
#             # Generate summary
#             summary = summarizer.summarize(full_transcript)
            
#             # Send summary to client
#             response = {
#                 "type": "summary",
#                 "text": summary,
#                 "transcript_length": len(full_transcript)
#             }
#             await websocket.send_text(json.dumps(response))
#         else:
#             await websocket.send_text(json.dumps({
#                 "type": "summary",
#                 "text": "No transcript available for summarization"
#             }))
            
#         await websocket.close()
#         logger.info("Microphone processing stopped")

# @app.get("/health")
# async def health_check():
#     return {
#         "status": "healthy",
#         "whisper_model_loaded": transcriber.whisper_model is not None
#     }

# # ===== MEETING DATABASE ENDPOINTS =====

# @app.post("/meetings", response_model=MeetingResponse)
# async def save_meeting(meeting_data: MeetingCreate):
#     """Save a meeting to the database"""
#     try:
#         # Generate a unique meeting ID
#         meeting_id = str(uuid.uuid4())
        
#         # Prepare meeting data for storage
#         meeting_doc = {
#             "meeting_id": meeting_id,
#             "meeting_name": meeting_data.meeting_name,
#             "transcript": meeting_data.transcript,
#             "summary": meeting_data.summary,
#             "created_at": datetime.now(timezone.utc),
#             "audio_file_id": None  # Will be updated when audio is saved
#         }
        
#         # Save to database
#         db_manager.save_meeting(meeting_doc)
        
#         return MeetingResponse(
#             meeting_id=meeting_id,
#             meeting_name=meeting_data.meeting_name,
#             transcript=meeting_data.transcript,
#             summary=meeting_data.summary,
#             created_at=meeting_doc["created_at"],
#             audio_file_id=None
#         )
#     except Exception as e:
#         logger.error(f"Error saving meeting: {e}")
#         raise HTTPException(status_code=500, detail="Failed to save meeting")

# @app.get("/meetings", response_model=List[MeetingListResponse])
# async def list_meetings():
#     """List all meetings"""
#     try:
#         meetings = db_manager.get_all_meetings()
#         return [MeetingListResponse(**meeting) for meeting in meetings]
#     except Exception as e:
#         logger.error(f"Error retrieving meetings: {e}")
#         raise HTTPException(status_code=500, detail="Failed to retrieve meetings")

# @app.get("/meetings/{meeting_id}", response_model=MeetingResponse)
# async def get_meeting(meeting_id: str):
#     """Get a specific meeting by ID"""
#     try:
#         meeting = db_manager.get_meeting(meeting_id)
#         if not meeting:
#             raise HTTPException(status_code=404, detail="Meeting not found")
#         return MeetingResponse(**meeting)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error retrieving meeting: {e}")
#         raise HTTPException(status_code=500, detail="Failed to retrieve meeting")

# from fastapi import Request

# @app.post("/meetings/{meeting_id}/audio")
# async def save_meeting_audio(meeting_id: str, request: Request):
#     """Save audio file for a meeting"""
#     try:
#         audio_data = await request.body()
#         # Save audio file to GridFS
#         filename = f"meeting_{meeting_id}.wav"
#         file_id = db_manager.save_audio_file(audio_data, filename)
        
#         # Update meeting document with audio file ID
#         update_result = db_manager.meetings_collection.update_one(
#             {"meeting_id": meeting_id},
#             {"$set": {"audio_file_id": file_id}}
#         )
#         logger.info(f"Audio file update result: matched={update_result.matched_count}, modified={update_result.modified_count}")
        
#         return {"message": "Audio saved successfully", "file_id": file_id}
#     except Exception as e:
#         logger.error(f"Error saving audio: {e}")
#         raise HTTPException(status_code=500, detail="Failed to save audio")

# @app.post("/meetings/{meeting_id}/summary")
# async def save_meeting_summary(meeting_id: str, summary_data: dict):
#     """Save summary for a meeting"""
#     try:
#         summary_text = summary_data.get("summary")
#         if summary_text is None:
#             raise HTTPException(status_code=400, detail="Summary is required")
        
#         db_manager.meetings_collection.update_one(
#             {"meeting_id": meeting_id},
#             {"$set": {"summary": summary_text}}
#         )
        
#         return {"message": "Summary saved successfully"}
#     except Exception as e:
#         logger.error(f"Error saving summary: {e}")
#         raise HTTPException(status_code=500, detail="Failed to save summary")

# @app.get("/meetings/{meeting_id}/audio")
# async def get_meeting_audio(meeting_id: str):
#     """Get audio file for a meeting"""
#     try:
#         # Get meeting to find audio file ID
#         meeting = db_manager.get_meeting(meeting_id)
#         if not meeting or not meeting.get("audio_file_id"):
#             raise HTTPException(status_code=404, detail="Audio file not found")
        
#         # Retrieve audio file from GridFS
#         file_id = meeting["audio_file_id"]
#         audio_data = db_manager.get_audio_file(file_id)
#         if not audio_data:
#             raise HTTPException(status_code=404, detail="Audio file not found")
        
#         # Return audio data as streaming response with audio/wav content type
#         return Response(content=audio_data, media_type="audio/wav")
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error retrieving audio: {e}")
#         raise HTTPException(status_code=500, detail="Failed to retrieve audio")

# @app.delete("/meetings/{meeting_id}")
# async def delete_meeting(meeting_id: str):
#     """Delete a meeting by ID"""
#     try:
#         result = db_manager.meetings_collection.delete_one({"meeting_id": meeting_id})
#         if result.deleted_count == 0:
#             raise HTTPException(status_code=404, detail="Meeting not found")
#         return {"message": "Meeting deleted successfully"}
#     except Exception as e:
#         logger.error(f"Error deleting meeting: {e}")
#         raise HTTPException(status_code=500, detail="Failed to delete meeting")

# if __name__ == "__main__":
#     uvicorn.run(
#         app,
#         host="0.0.0.0",
#         port=8765,
#         log_level="info"
#     )

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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response, Request
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
from faster_whisper import WhisperModel
import os
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List, Optional
# from difflib import SequenceMatcher  # no longer needed after cleanup

# Local imports
from summarization import OfflineSummarizer  # Import our new summarizer
from database import db_manager

import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="webrtcvad")

# -------------------------------------------------
# Frontend paths (dist is outside the server folder)
# -------------------------------------------------
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "dist"))
FRONTEND_ASSETS_DIR = os.path.join(FRONTEND_DIST_DIR, "assets")
# dist_dir = os.path.join(os.path.dirname(sys.executable), "dist")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Whisper Transcription Server")

# Serve React static assets (Vite outputs to /assets)
if os.path.isdir(FRONTEND_ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS_DIR), name="assets")
    logger.info(f"Mounted frontend assets at /assets from: {FRONTEND_ASSETS_DIR}")
else:
    logger.warning(f"Frontend assets directory not found: {FRONTEND_ASSETS_DIR}")


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add middleware to handle CORS for all routes
@app.middleware("http")
async def add_cors_header(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

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
    created_at: datetime
    audio_file_id: Optional[str] = None

class MeetingListResponse(BaseModel):
    meeting_id: str
    meeting_name: str
    created_at: datetime
    summary: Optional[str] = None

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
        self.chunk_duration = 5.0  # Process every ~10 seconds
        self.min_chunk_duration = 0.5  # Minimum chunk size
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.compute_type = "float16" if self.device == "cuda" else "int8"
        self.whisper_model_size = os.getenv("WHISPER_MODEL_SIZE", "small")
        self.last_chunk_end = 0.0  # Track end time of last segment

        # Microphone state
        self.mic_running = False
        self.mic_queue = queue.Queue()
        self.vad = webrtcvad.Vad(2)  # Aggressiveness 0-3
        self.mic_thread = None
        self.vad_thread = None

        # Session state for summarization
        self.session_transcript = []
        self.session_lock = threading.Lock()

        # Transcription cache to prevent duplicates
        self.transcription_cache = set()
        self.cache_lock = threading.Lock()
        self.cache_timestamps = {}  # Track when items were added to cache
        self.cache_timeout = 30  # Clear cache items older than 30 seconds

    async def initialize_models(self):
        """Initialize Whisper model"""
        try:
            logger.info(f"Loading Whisper model ({self.whisper_model_size}) on {self.device}...")
            self.whisper_model = WhisperModel(
                self.whisper_model_size,
                device=self.device,
                compute_type=self.compute_type,
                download_root="./models"
            )
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Error initializing model: {e}")
            raise

    def bytes_to_audio(self, audio_bytes):
        """Convert audio bytes to numpy array"""
        try:
            logger.info(f"bytes_to_audio received data type: {type(audio_bytes)}, length: {len(audio_bytes) if hasattr(audio_bytes, '__len__') else 'N/A'}")
            # Convert 16-bit PCM to float32
            audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
            return audio_data.astype(np.float32) / 32768.0
        except Exception as e:
            logger.error(f"Error converting audio bytes: {e}")
            return None

    def is_duplicate_transcription(self, text):
        """Check if transcription is a duplicate and add to cache if not"""
        with self.cache_lock:
            current_time = time.time()

            # Clean up old cache entries
            expired_keys = []
            for cached_text, timestamp in list(self.cache_timestamps.items()):
                if current_time - timestamp > self.cache_timeout:
                    expired_keys.append(cached_text)
                    self.transcription_cache.discard(cached_text)
            for key in expired_keys:
                del self.cache_timestamps[key]

            # Normalize text for comparison (remove extra whitespace)
            normalized_text = ' '.join(text.strip().split())

            # Check if text or similar text already exists in cache
            for cached_text in self.transcription_cache:
                # Exact match
                if normalized_text == cached_text:
                    self.cache_timestamps[cached_text] = current_time
                    return True
                # Partial overlap (one text contains the other)
                if normalized_text in cached_text or cached_text in normalized_text:
                    self.cache_timestamps[cached_text] = current_time
                    return True

            # Not a duplicate, add to cache
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
        logger.info(f"Received audio data type: {type(audio_bytes)}, length: {len(audio_bytes) if hasattr(audio_bytes, '__len__') else 'N/A'}")
        new_audio = self.bytes_to_audio(audio_bytes)
        if new_audio is None:
            return []

        # Add to buffer
        self.audio_buffer = np.concatenate((self.audio_buffer, new_audio))

        # Check if we have enough data
        buffer_duration = len(self.audio_buffer) / self.sample_rate
        results = []

        # Process while we have full chunks
        while buffer_duration >= self.chunk_duration:
            # Extract a chunk
            chunk_samples = int(self.chunk_duration * self.sample_rate)
            chunk_data = self.audio_buffer[:chunk_samples]

            # Transcribe the chunk
            segments = await self.transcribe_audio(chunk_data)
            results.extend(segments)

            # Remove processed audio (keep last 0.5s for context)
            keep_samples = int(0.5 * self.sample_rate)
            self.audio_buffer = self.audio_buffer[chunk_samples - keep_samples:]
            buffer_duration = len(self.audio_buffer) / self.sample_rate

        return results

    # ===== MICROPHONE/VAD FUNCTIONS =====
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
                    # End of speech segment
                    audio_chunk = b"".join(buffer)
                    audio_np = np.frombuffer(audio_chunk, np.int16).astype(np.float32) / 32768.0

                    # Transcribe the chunk without adjusting timestamps
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

                    # Reset buffer
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

        # Reset session state
        with self.session_lock:
            self.session_transcript = []

        self.mic_running = True

        # Start microphone input
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

        # Start VAD processing
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

        # Clear queue
        while not self.mic_queue.empty():
            self.mic_queue.get()

        logger.info("Microphone recording stopped")

    def get_session_transcript(self):
        """Get the full transcript for the current session"""
        with self.session_lock:
            return " ".join(self.session_transcript)

# Global instances
transcriber = WhisperTranscriber()
summarizer = OfflineSummarizer()  # Use our offline summarizer

@app.on_event("startup")
async def startup_event():
    await transcriber.initialize_models()
    if os.path.isfile(os.path.join(FRONTEND_DIST_DIR, "index.html")):
        logger.info(f"Frontend index detected at: {os.path.join(FRONTEND_DIST_DIR, 'index.html')}")
    else:
        logger.warning(f"Frontend index not found at: {os.path.join(FRONTEND_DIST_DIR, 'index.html')}")

# -------------------------
# WebSocket transcription
# -------------------------
@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")

    # Clear transcription cache for new session
    transcriber.clear_transcription_cache()
    transcriber.last_chunk_end = 0.0
    transcriber.audio_buffer = np.array([], dtype=np.float32)

    # Store session transcript for summarization
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
        # Process remaining audio on disconnect
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

        # Generate summary after disconnect
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

        # Reset state
        transcriber.audio_buffer = np.array([], dtype=np.float32)
        transcriber.last_chunk_end = 0.0
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()

# -------------------------
# Microphone WebSocket
# -------------------------
@app.websocket("/ws/microphone")
async def microphone_ws(websocket: WebSocket):
    await websocket.accept()
    logger.info("Microphone WebSocket connection established")

    # Clear transcription cache for new session
    transcriber.clear_transcription_cache()

    try:
        # Start microphone capture
        transcriber.start_microphone(websocket)

        # Keep connection alive while processing
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

        # Generate summary after stopping
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

# -------------------------
# Health
# -------------------------
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "whisper_model_loaded": transcriber.whisper_model is not None
    }

# -------------------------
# Meeting DB Endpoints
# -------------------------
@app.post("/meetings", response_model=MeetingResponse)
async def save_meeting(meeting_data: MeetingCreate):
    """Save a meeting to the database"""
    try:
        meeting_id = str(uuid.uuid4())
        meeting_doc = {
            "meeting_id": meeting_id,
            "meeting_name": meeting_data.meeting_name,
            "transcript": meeting_data.transcript,
            "summary": meeting_data.summary,
            "created_at": datetime.now(timezone.utc),
            "audio_file_id": None
        }
        db_manager.save_meeting(meeting_doc)

        return MeetingResponse(
            meeting_id=meeting_id,
            meeting_name=meeting_data.meeting_name,
            transcript=meeting_data.transcript,
            summary=meeting_data.summary,
            created_at=meeting_doc["created_at"],
            audio_file_id=None
        )
    except Exception as e:
        logger.error(f"Error saving meeting: {e}")
        raise HTTPException(status_code=500, detail="Failed to save meeting")

@app.get("/meetings", response_model=List[MeetingListResponse])
async def list_meetings():
    """List all meetings"""
    try:
        meetings = db_manager.get_all_meetings()
        return [MeetingListResponse(**meeting) for meeting in meetings]
    except Exception as e:
        logger.error(f"Error retrieving meetings: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve meetings")

@app.get("/meetings/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str):
    """Get a specific meeting by ID"""
    try:
        meeting = db_manager.get_meeting(meeting_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        return MeetingResponse(**meeting)
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
        filename = f"meeting_{meeting_id}.wav"
        file_id = db_manager.save_audio_file(audio_data, filename)

        update_result = db_manager.meetings_collection.update_one(
            {"meeting_id": meeting_id},
            {"$set": {"audio_file_id": file_id}}
        )
        logger.info(f"Audio file update result: matched={update_result.matched_count}, modified={update_result.modified_count}")

        return {"message": "Audio saved successfully", "file_id": file_id}
    except Exception as e:
        logger.error(f"Error saving audio: {e}")
        raise HTTPException(status_code=500, detail="Failed to save audio")

@app.post("/meetings/{meeting_id}/summary")
async def save_meeting_summary(meeting_id: str, summary_data: dict):
    """Save summary for a meeting"""
    try:
        summary_text = summary_data.get("summary")
        if summary_text is None:
            raise HTTPException(status_code=400, detail="Summary is required")

        db_manager.meetings_collection.update_one(
            {"meeting_id": meeting_id},
            {"$set": {"summary": summary_text}}
        )

        return {"message": "Summary saved successfully"}
    except Exception as e:
        logger.error(f"Error saving summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to save summary")

@app.get("/meetings/{meeting_id}/audio")
async def get_meeting_audio(meeting_id: str):
    """Get audio file for a meeting"""
    try:
        meeting = db_manager.get_meeting(meeting_id)
        if not meeting or not meeting.get("audio_file_id"):
            raise HTTPException(status_code=404, detail="Audio file not found")

        file_id = meeting["audio_file_id"]
        audio_data = db_manager.get_audio_file(file_id)
        if not audio_data:
            raise HTTPException(status_code=404, detail="Audio file not found")

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
        result = db_manager.meetings_collection.delete_one({"meeting_id": meeting_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Meeting not found")
        return {"message": "Meeting deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting meeting: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete meeting")

# -------------------------
# Frontend routes (index & SPA fallback)
# -------------------------
@app.get("/")
async def serve_index():
    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend build not found. Please build the React app."}

@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    """
    Fallback to index.html for any non-API route so client-side routing works.
    API routes above will match first.
    """
    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8765,
        log_level="info"
    )
