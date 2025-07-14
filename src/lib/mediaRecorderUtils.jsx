
import { formatTime } from '@/lib/utils';

export const initializeMediaRecorder = (stream, mediaRecorderRef, audioChunksRef, onStopCallback) => {
  if (!stream) {
    console.error("No stream provided to initializeMediaRecorder");
    return;
  }
  mediaRecorderRef.current = new MediaRecorder(stream);
  audioChunksRef.current = [];

  mediaRecorderRef.current.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunksRef.current.push(event.data);
    }
  };

  mediaRecorderRef.current.onstop = () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    if (onStopCallback) {
      onStopCallback(audioUrl);
    }
  };
};

export const cleanupMediaRecorder = (mediaRecorderRef, audioContextRef, analyserRef, audioSourceNodeRef, fullCleanup = true) => {
  if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
  }
  if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error("Error stopping media recorder during cleanup:", e);
      }
  }
  mediaRecorderRef.current = null;


  if(fullCleanup) {
    if (audioSourceNodeRef.current) {
        audioSourceNodeRef.current.disconnect();
        audioSourceNodeRef.current = null;
    }
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.error("Error closing audio context:", e));
        audioContextRef.current = null;
    }
  }
};
