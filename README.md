
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

## 📁 Project Structure

```

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

