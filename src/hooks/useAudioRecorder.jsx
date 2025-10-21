
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { formatTime } from "@/lib/utils";
import { initializeMediaRecorder, cleanupMediaRecorder } from "@/lib/mediaRecorderUtils";
import { initializeWhisperConnection, setupWhisperAudioStreaming, AudioProcessor } from "@/lib/whisperWebSocket";
import { initializeAudioVisualization, cleanupAudioVisualization, visualizeAudio } from "@/lib/audioVisualizationUtils";
import { handleMicrophoneAccess } from "@/lib/audioPermissions";
import { startTimer, clearTimer } from "@/lib/timerUtils";

const useAudioRecorder = (onTranscriptUpdate, onSummaryReceived) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformData, setWaveformData] = useState(Array(50).fill(5));
  const [isPaused, setIsPaused] = useState(false);
  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearTimer(timerRef);
      cleanupAudioVisualization(animationFrameRef);
      
      // Pause audio streaming to Whisper server by stopping the audio processor
      if (audioProcessorRef.current) {
        audioProcessorRef.current.cleanup();
        audioProcessorRef.current = null;
      }
      
      toast({
        title: "Recording paused",
        description: "Your recording is paused. Audio streaming to transcription server has been paused.",
      });
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer(timerRef, () => setRecordingTime(prev => prev + 1));
      initializeAudioVisualization(
        audioStreamRef.current,
        audioContextRef,
        analyserRef,
        audioSourceNodeRef,
        visualizeAudio,
        waveformData,
        setWaveformData,
        animationFrameRef
      );
      
      // Resume audio streaming to Whisper server without reconnecting
      if (audioStreamRef.current && whisperClientRef.current) {
        // Use the same setup function as in start recording for consistency
        setupWhisperAudioStreaming(audioStreamRef.current, whisperClientRef.current)
          .then(audioProcessor => {
            audioProcessorRef.current = audioProcessor;
          })
          .catch(error => {
            console.error("Error resuming audio streaming:", error);
            toast({
              variant: "destructive",
              title: "Audio Streaming Error",
              description: "Failed to resume real-time transcription.",
            });
          });
      }
      
      toast({
        title: "Recording resumed",
        description: "Your recording has resumed. Audio streaming to transcription server has been resumed.",
      });
    }
  };
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationFrameRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const whisperClientRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioSourceNodeRef = useRef(null);
  const lastSegmentsRef = useRef([]); // Track last few segments to prevent duplicates

  const { toast } = useToast();

  const cleanupResources = useCallback((fullCleanup = true) => {
    clearTimer(timerRef);
    
    // Cleanup Whisper WebSocket connection
    if (whisperClientRef.current) {
      whisperClientRef.current.disconnect();
      whisperClientRef.current = null;
    }
    
    // Cleanup audio processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.cleanup();
      audioProcessorRef.current = null;
    }
    
    cleanupAudioVisualization(animationFrameRef);
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    cleanupMediaRecorder(mediaRecorderRef, audioContextRef, analyserRef, audioSourceNodeRef, fullCleanup);

    if (fullCleanup && audioData) {
      URL.revokeObjectURL(audioData);
      setAudioData(null);
    }
  }, [audioData]);


  const onRecordingStop = useCallback((audioUrl) => {
    setAudioData(audioUrl);
    
    // Whisper connection will be cleaned up in handleStopRecording
    toast({
      title: "Recording complete",
      description: `Processing finished for recording of ${formatTime(recordingTime)}.`,
    });
  }, [recordingTime, toast]);


  const handleStartRecording = async () => {
    try {
      cleanupResources(false); 
      setAudioData(null);
      onTranscriptUpdate([]);

      const stream = await handleMicrophoneAccess(toast);
      if (!stream) return;

      audioStreamRef.current = stream;
      
      initializeAudioVisualization(stream, audioContextRef, analyserRef, audioSourceNodeRef, visualizeAudio, waveformData, setWaveformData, animationFrameRef);
      
      initializeMediaRecorder(
        stream,
        mediaRecorderRef,
        audioChunksRef,
        onRecordingStop
      );
      
      // Initialize Whisper WebSocket connection
      whisperClientRef.current = initializeWhisperConnection(
        (transcriptSegment) => {
          onTranscriptUpdate(prev => {
            // Check if segment already exists to prevent duplicates
            const exists = prev.some(segment => segment.id === transcriptSegment.id);
            
            // Additional duplicate check using last segments cache
            const isRecentDuplicate = lastSegmentsRef.current.some(
              segment => 
                segment.text === transcriptSegment.text && 
                Math.abs(segment.start - transcriptSegment.start) < 1.0 // Within 1 second
            );
            
            if (!exists && !isRecentDuplicate) {
              // Add to last segments cache (keep last 5 segments)
              lastSegmentsRef.current = [...lastSegmentsRef.current.slice(-4), transcriptSegment];
              return [...prev, transcriptSegment];
            }
            return prev;
          });
        },
        (error) => {
          toast({
            variant: "destructive",
            title: "Transcription Error",
            description: error,
          });
        },
        (isConnected) => {
          if (!isConnected && isRecording) {
            toast({
              variant: "destructive",
              title: "Connection Lost",
              description: "Lost connection to transcription server. Trying to reconnect...",
            });
          }
        },
        (summary) => {
          // Handle summary received from WebSocket
          // This will be passed up to the parent component
          if (onSummaryReceived) {
            onSummaryReceived(summary);
          }
        }
      );

      // Setup real-time audio streaming to Whisper
      try {
        audioProcessorRef.current = await setupWhisperAudioStreaming(stream, whisperClientRef.current);
      } catch (error) {
        console.error("Error setting up audio streaming:", error);
        toast({
          variant: "destructive",
          title: "Audio Streaming Error",
          description: "Failed to setup real-time transcription. Recording will continue without transcription.",
        });
      }

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setWaveformData(Array(50).fill(5));
      
      startTimer(timerRef, () => setRecordingTime(prev => prev + 1));
      
      toast({
        title: "Recording started",
        description: "Your meeting is now being recorded and transcribed with Whisper.",
      });

    } catch (error) {
      console.error("Error in handleStartRecording:", error);
      toast({
        variant: "destructive",
        title: "Recording Start Failed",
        description: error.message || "An unexpected error occurred.",
      });
      cleanupResources();
    }
  };
  
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); 
      setIsRecording(false);
      setIsPaused(false);
      clearTimer(timerRef);
      cleanupAudioVisualization(animationFrameRef);
      
      // Send stop command to WebSocket to notify server
      if (whisperClientRef.current) {
        whisperClientRef.current.sendStopCommand();
      }
      
      // Cleanup Whisper connection
      if (whisperClientRef.current) {
        whisperClientRef.current.disconnect();
        whisperClientRef.current = null;
      }
      
      // Cleanup audio processor
      if (audioProcessorRef.current) {
        audioProcessorRef.current.cleanup();
        audioProcessorRef.current = null;
      }
      
      // Clear last segments cache
      lastSegmentsRef.current = [];
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      
      cleanupMediaRecorder(mediaRecorderRef, audioContextRef, analyserRef, audioSourceNodeRef, false);

      toast({
        title: "Recording stopped",
        description: `Recording of ${formatTime(recordingTime)} processed with Whisper.`,
      });
    }
  };
  
  const handleDeleteRecording = () => {
    if (audioData) URL.revokeObjectURL(audioData);
    setAudioData(null);
    setRecordingTime(0);
    setWaveformData(Array(50).fill(5));
    onTranscriptUpdate([]);
    lastSegmentsRef.current = []; // Clear last segments cache
    cleanupResources(false);
    toast({
      title: "Recording deleted",
      description: "Your recording and transcript have been deleted.",
    });
  };
  
  const handleSaveRecording = () => {
    if (audioData) {
      const a = document.createElement("a");
      a.href = audioData;
      a.download = `meeting-recording-${new Date().toISOString()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Recording saved",
        description: "Your audio recording has been downloaded.",
      });
    }
  };

  useEffect(() => {
    return () => {
      cleanupResources(true);
    };
  }, [cleanupResources]);

  return {
    isRecording,
    isPaused,
    audioData,
    recordingTime,
    waveformData,
    startRecording: handleStartRecording,
    stopRecording: handleStopRecording,
    pauseRecording: handlePauseRecording,
    resumeRecording: handleResumeRecording,
    deleteRecording: handleDeleteRecording,
    saveRecording: handleSaveRecording,
  };
};

export default useAudioRecorder;
