<<<<<<< HEAD
# Meeting Transcriber with Whisper Backend

A real-time meeting transcription application that uses OpenAI's Whisper model for accurate speech-to-text conversion with speaker diarization.

## 🚀 Features

- **Real-time Transcription**: Live speech-to-text using Whisper AI
- **Speaker Diarization**: Automatic speaker identification (Speaker 1, Speaker 2, etc.)
- **High Accuracy**: Powered by OpenAI's Whisper model
- **Privacy-First**: All processing happens on your server
- **Modern UI**: React-based interface with real-time waveform visualization
- **Export Options**: Download transcripts and audio recordings

## 🏗️ Architecture

### Frontend (React + Vite)
- **Audio Recording**: Web Audio API for recording and visualization
- **Real-time Streaming**: WebSocket connection to Python backend
- **UI Components**: Modern interface with Tailwind CSS and Radix UI
- **State Management**: React hooks for audio and transcript management

### Backend (Python + FastAPI)
- **Whisper Integration**: OpenAI's Whisper for transcription
- **Speaker Diarization**: pyannote.audio for speaker identification
- **WebSocket Server**: Real-time audio streaming and processing
- **Audio Processing**: Chunked processing for low-latency transcription

## 📋 Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.8+ (for backend)
- **FFmpeg** (for audio processing)
- **Git** (for cloning the repository)

### System Dependencies

**macOS:**
```bash
brew install ffmpeg portaudio
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg portaudio19-dev python3-pyaudio
```

**Windows:**
- Install FFmpeg and add to PATH
- Install Visual Studio Build Tools

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/dolithachowdary/drdo.git
cd drdo
```

### 2. Backend Setup (Python Server)

#### Automatic Setup (Recommended)
```bash
cd server
python setup.py
```

#### Manual Setup
```bash
cd server

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# Download Whisper models
python -c "import whisper; whisper.load_model('base')"
```

### 3. Frontend Setup
```bash
# Install Node.js dependencies
npm install

# Start development server
npm run dev
```

### 4. Start the Backend Server
```bash
cd server

# Activate virtual environment (if not already active)
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Start the Whisper server
python whisper_server.py
```

The backend server will start on `http://localhost:8765`

## 🚀 Usage

1. **Start the Backend**: Run the Python Whisper server
2. **Start the Frontend**: Run the React development server
3. **Open the App**: Navigate to `http://localhost:5173` (or the port shown by Vite)
4. **Start Recording**: Click the record button to begin transcription
5. **View Transcript**: See real-time transcription with speaker labels

## 🔧 Configuration

### Whisper Model Selection
Edit `server/whisper_server.py` to change the model:
```python
# Options: tiny, base, small, medium, large
self.whisper_model = whisper.load_model("base")
```

**Model Comparison:**
- `tiny`: Fastest, least accurate
- `base`: Good balance (recommended)
- `small`: Better accuracy, slower
- `medium`: High accuracy, much slower
- `large`: Best accuracy, very slow

### Audio Processing Settings
Adjust in `server/whisper_server.py`:
```python
self.chunk_duration = 2.0      # Process every 2 seconds
self.overlap_duration = 0.5    # 0.5 second overlap
self.min_chunk_duration = 1.0  # Minimum chunk size
```

## 🔍 API Endpoints

### WebSocket
- **URL**: `ws://localhost:8765/ws/transcribe`
- **Purpose**: Real-time audio streaming and transcription

### HTTP Endpoints
- **Health Check**: `GET /health`
- **Root**: `GET /`

## 🧪 Testing

### Test Backend Connection
```bash
curl http://localhost:8765/health
```

### Test WebSocket (using wscat)
```bash
npm install -g wscat
wscat -c ws://localhost:8765/ws/transcribe
```
=======

---


#  Offline Meeting Transcriber with Speaker Diarization

This is an **offline speech-to-text transcription tool** for meetings and conversations. It uses **OpenAI Whisper** to transcribe audio and identify **who spoke what** using speaker diarization — all running **completely offline**.

---

## 🔧 Features

- ✅ Works offline (no internet needed after setup)
- 🧠 Speaker diarization (distinguishes different speakers)
- 🗣️ Accurate transcription using Whisper
- ⚙️ Backend in Python (FastAPI or Flask)
- 🌐 Optional frontend in React for live audio input

---
>>>>>>> 51a3a0ac69b69031ce41f1368f478bc65d03e3cd

## 📁 Project Structure

```
<<<<<<< HEAD
├── server/
│   ├── whisper_server.py      # Main Python server
│   ├── requirements.txt       # Python dependencies
│   ├── setup.py              # Setup script
│   └── start_server.sh/bat    # Start scripts
├── src/
│   ├── components/            # React components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility libraries
│   │   └── whisperWebSocket.jsx # WebSocket client
│   └── App.jsx               # Main React component
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## 🔧 Troubleshooting

### Common Issues

**1. "Module not found" errors**
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # or venv\Scripts\activate
pip install -r requirements.txt
```

**2. WebSocket connection failed**
- Ensure the Python server is running on port 8765
- Check firewall settings
- Verify the WebSocket URL in the frontend

**3. Audio not being processed**
- Check microphone permissions in browser
- Ensure FFmpeg is installed and in PATH
- Check browser console for errors

**4. Poor transcription quality**
- Try a larger Whisper model (small, medium, large)
- Ensure good audio quality (minimal background noise)
- Check microphone positioning

### Performance Optimization

**For faster transcription:**
- Use `tiny` or `base` Whisper models
- Reduce `chunk_duration` for lower latency
- Use GPU acceleration (install CUDA-enabled PyTorch)

**For better accuracy:**
- Use `small`, `medium`, or `large` models
- Increase `chunk_duration` for more context
- Ensure high-quality audio input

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- **OpenAI Whisper**: For the excellent speech recognition model
- **pyannote.audio**: For speaker diarization capabilities
- **FastAPI**: For the robust WebSocket server framework
- **React**: For the modern frontend framework

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section
2. Review the server logs
3. Open an issue on GitHub with detailed error information

---

**Note**: This application processes audio locally on your server, ensuring privacy and data security.
=======

transcriber-project/
├── backend/
│   ├── app.py             # Backend logic (FastAPI/Flask)
│   ├── models/            # Whisper or WhisperX model files
│   ├── utils/             # Audio processing, diarization
│   └── ...
├── frontend/
│   └── react-app/         # React frontend (optional)
├── requirements.txt
└── README.md

````

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/transcriber-project.git
cd transcriber-project
````

### 2. Set Up Backend

Install Python dependencies:

```bash
cd backend
pip install -r requirements.txt
```

Start the backend server:

```bash
python app.py
```

> ⚠️ Make sure you have Whisper or WhisperX installed and model files downloaded (e.g. `base`, `small`, etc.)

### 3. Run the Frontend (Optional)

```bash
cd frontend/react-app
npm install
npm run dev
```

---

## 🧰 Requirements

* Python 3.8+
* `openai-whisper` or `whisperx`
* `ffmpeg`, `torch`, `fastapi` or `flask`
* Node.js & npm (for frontend)

---

## 🧪 Example Output

```
[Speaker 1] Hello team, let's start the meeting.
[Speaker 2] Sure, here’s the update from my side…
```

---

## 💡 Use Cases

* Transcribe meetings & interviews
* Generate speaker-tagged notes
* Use in offline environments (defense, research, etc.)
* Private voice documentation

---

## 🛠️ To Do / Improvements

* Meeting summarization
* Export transcripts to PDF or DOCX
* Real-time transcription with live speaker labeling
* Speaker name identification (instead of Speaker 1, 2)

---

>>>>>>> 51a3a0ac69b69031ce41f1368f478bc65d03e3cd
