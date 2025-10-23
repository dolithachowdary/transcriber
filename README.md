# 🗣️ Meeting Transcriber with Whisper Backend

A **real-time meeting transcription system** powered by **OpenAI Whisper**, featuring **speaker diarization**, **offline support**, and **live streaming** using **FastAPI** and **React**.

---

## 🚀 Features

- 🎙️ **Real-Time Transcription** — Converts speech to text instantly using Whisper.  
- 🧠 **Speaker Diarization** — Automatically detects and labels speakers (e.g., *Speaker 1, Speaker 2*).  
- ⚡ **Low Latency** — Streams transcribed text in near real-time via WebSocket.  
- 🪶 **Offline Mode** — Works fully offline after one-time model setup.  
- 💬 **Multi-Speaker Tracking** — Maintains consistent speaker labels across the conversation.  
- 🧩 **Frontend-Backend Integration** — React (Vite) frontend with FastAPI backend for seamless communication.  
- 🧱 **Modular Architecture** — Easily extendable for meeting summaries, analytics, or AI insights.  

---

## 🧰 Tech Stack

### **Frontend**
- React (Vite)
- WebSocket API
- Tailwind CSS (for clean UI)

### **Backend**
- FastAPI
- Faster-Whisper (for offline transcription)
- PyAnnote.Audio (for speaker diarization)
- Torch (CPU-based inference)

### **Other Tools**
- Python
- Node.js
- WebSocket Streaming
- REST APIs

---

## 🧩 System Architecture

```text
🎤 Microphone Input 
     ↓
🔊 Audio Stream (WebSocket)
     ↓
⚙️ FastAPI Backend
     ↳ Whisper → Transcription
     ↳ PyAnnote → Speaker Diarization
     ↓
🖥️ React Frontend
     ↳ Live Transcript Display
     ↳ Speaker Labels
```
⚙️ Installation & Setup
1. Clone the Repository
```bash

git clone https://github.com/your-username/meeting-transcriber.git
cd meeting-transcriber
```
2. Backend Setup (FastAPI)
```bash

cd backend
python -m venv venv
source venv/Scripts/activate    # (Windows)
# or
source venv/bin/activate        # (Mac/Linux)

pip install -r requirements.txt
```
3. Run the Backend Server
```bash

uvicorn main:app --reload --port 8000
```
4. Frontend Setup (React)
```bash

cd ../frontend
npm install
npm run dev
```
5. Access the App
Open your browser and visit:
👉 http://localhost:5173

🔒 Offline Usage
This project supports completely offline transcription and diarization.
After downloading the models once, the backend works without an internet connection.

## To ensure offline use:

Download Whisper model locally (e.g., base.en or small).

Download PyAnnote diarization models for CPU.

Set local model paths in your backend configuration.

## Future Enhancements
Automated meeting summarization
Meeting analytics dashboard (word count, talk time, etc.)
Integration with Google Meet / Zoom APIs
Local meeting storage & search


🤝 Contributing
Contributions, issues, and feature requests are welcome!
Feel free to open a pull request or create an issue.


👨‍💻 Developed by
Dolitha Dasari
💼 CSE | FastAPI | React | AI | Whisper | PyAnnote
🔗 LinkedIn • GitHub

“Turning conversations into structured, intelligent insights — one meeting at a time.”
