import React, { useEffect, useState } from 'react';

function LiveTranscriber() {
  const [transcription, setTranscription] = useState('');

  useEffect(() => {

    const ws = new WebSocket("ws://localhost:8000/ws/transcribe");

    ws.onopen = () => {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorder.start(250); // send data every 250ms

        mediaRecorder.ondataavailable = event => {
          if (event.data.size > 0 && ws.readyState === 1) {
            ws.send(event.data);
          }
        };
      })
      .catch(err => {
        console.error("Failed to get microphone access:", err);
      });
    };

    ws.onmessage = event => {
      setTranscription(prev => prev + ' ' + event.data);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div>
      <h2>Live Transcription</h2>
      <div>{transcription}</div>
    </div>
  );
}

export default LiveTranscriber;
