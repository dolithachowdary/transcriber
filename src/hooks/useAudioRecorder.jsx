
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { formatTime } from "@/lib/utils";
import { initializeMediaRecorder, cleanupMediaRecorder } from "@/lib/mediaRecorderUtils";
import { initializeSpeechRecognition, cleanupSpeechRecognition } from "@/lib/speechRecognitionUtils";
import { initializeAudioVisualization, cleanupAudioVisualization, visualizeAudio } from "@/lib/audioVisualizationUtils";
import { handleMicrophoneAccess } from "@/lib/audioPermissions";
import { startTimer, clearTimer } from "@/lib/timerUtils";

const useAudioRecorder = (onTranscriptUpdate) => {
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
      toast({
        title: "Recording paused",
        description: "Your recording is paused.",
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
      toast({
        title: "Recording resumed",
        description: "Your recording has resumed.",
      });
    }
  };
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationFrameRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioSourceNodeRef = useRef(null);

  const { toast } = useToast();

  const cleanupResources = useCallback((fullCleanup = true) => {
    clearTimer(timerRef);
    cleanupSpeechRecognition(speechRecognitionRef);
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
    
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
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
      
      initializeSpeechRecognition(
        speechRecognitionRef,
        (transcriptSegment) => {
            onTranscriptUpdate(prev => [...prev, transcriptSegment]);
        },
        () => recordingTime, 
        () => isRecording && mediaRecorderRef.current?.stream?.active && audioStreamRef.current?.active,
        toast
      );

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setWaveformData(Array(50).fill(5));
      
      startTimer(timerRef, () => setRecordingTime(prev => prev + 1));
      
      toast({
        title: "Recording started",
        description: "Your meeting is now being recorded and transcribed.",
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
      
      if (speechRecognitionRef.current) {
         speechRecognitionRef.current.stop();
      }
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      
      cleanupMediaRecorder(mediaRecorderRef, audioContextRef, analyserRef, audioSourceNodeRef, false);

      toast({
        title: "Recording stopped",
        description: `Recording of ${formatTime(recordingTime)} processing.`,
      });
    }
  };
  
  const handleDeleteRecording = () => {
    if (audioData) URL.revokeObjectURL(audioData);
    setAudioData(null);
    setRecordingTime(0);
    setWaveformData(Array(50).fill(5));
    onTranscriptUpdate([]);
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
