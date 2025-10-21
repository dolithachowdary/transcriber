
import { formatTime } from '@/lib/utils';
import { initializeOfflineSpeechRecognition, startOfflineRecognition, stopOfflineRecognition } from './offlineSpeechRecognition';

export const initializeSpeechRecognition = (speechRecognitionRef, onTranscriptSegment, getRecordingTime, getIsStreamActive, toast) => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  // Try offline recognition if web speech API is not available
  if (!SpeechRecognition) {
    const offlineRecognizer = initializeOfflineSpeechRecognition(onTranscriptSegment, getRecordingTime, toast);
    if (offlineRecognizer) {
      speechRecognitionRef.current = {
        offlineMode: true,
        recognizer: offlineRecognizer,
        start: () => startOfflineRecognition(offlineRecognizer),
        stop: () => stopOfflineRecognition(offlineRecognizer)
      };
      return;
    }
    
    toast({
      variant: "destructive",
      title: "Speech Recognition Not Supported",
      description: "Neither online nor offline speech recognition is available.",
    });
    return;
  }

  speechRecognitionRef.current = new SpeechRecognition();
  speechRecognitionRef.current.continuous = true;
  speechRecognitionRef.current.interimResults = true;
  speechRecognitionRef.current.lang = 'en-US'; 

  let segmentIndex = 0;

  speechRecognitionRef.current.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        const newText = event.results[i][0].transcript;
        const newSegment = {
          id: `segment-${Date.now()}-${segmentIndex++}`,
          speaker: "Speaker", 
          text: newText.trim(),
          timestamp: formatTime(getRecordingTime()),
        };
        if (newSegment.text) { 
          onTranscriptSegment(newSegment);
        }
      }
    }
  };

  speechRecognitionRef.current.onerror = (event) => {
    console.error("Speech recognition error:", event.error, event.message);
    let description = "An unknown error occurred with speech recognition.";
    if (event.error === 'network') {
      description = "Network error. Please check your internet connection.";
    } else if (event.error === 'audio-capture') {
      description = "Audio capture error. Ensure your microphone is working and not used by another app.";
    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      description = "Speech recognition service not allowed. Check browser permissions.";
    } else if (event.error === 'no-speech') {
      description = "No speech detected. Please try speaking louder or closer to the microphone.";
      return; 
    }
     else {
      description = `Error: ${event.error}. ${event.message || ''}`;
    }
    toast({
      variant: "destructive",
      title: "Speech Recognition Error",
      description: description,
    });
  };
  
  speechRecognitionRef.current.onend = () => {
     if (getIsStreamActive && getIsStreamActive()) { 
       try {
          if (speechRecognitionRef.current) { 
            speechRecognitionRef.current.start();
          }
       } catch(e) {
          console.error("Error restarting speech recognition:", e);
       }
     }
  };

  try {
      speechRecognitionRef.current.start();
  } catch(e) {
      console.error("Error starting speech recognition initially:", e);
       toast({
          variant: "destructive",
          title: "Speech Recognition Start Error",
          description: "Could not start speech recognition. Your browser might not support it or permissions may be denied.",
      });
  }
};

export const cleanupSpeechRecognition = (speechRecognitionRef) => {
  if (speechRecognitionRef.current) {
    if (speechRecognitionRef.current.offlineMode) {
      stopOfflineRecognition(speechRecognitionRef.current.recognizer);
    } else {
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.onend = null;
      try {
        speechRecognitionRef.current.stop();
      } catch(e) {
        console.warn("Error stopping speech recognition during cleanup:", e);
      }
    }
    speechRecognitionRef.current = null;
  }
};
