
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Play, Square, Save, Trash2 } from "lucide-react";

const AudioControls = ({
  isRecording,
  isPaused,
  audioData,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onSaveRecording,
  onDeleteRecording,
  audioPlayerRef 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = () => {
    if (audioPlayerRef.current && audioData) {
      if (isPlaying) {
        audioPlayerRef.current.pause();
      } else {
        audioPlayerRef.current.play();
      }
    }
  };

  useEffect(() => {
    const player = audioPlayerRef.current;
    if (player) {
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);

      player.addEventListener('play', handlePlay);
      player.addEventListener('pause', handlePause);
      player.addEventListener('ended', handleEnded);

      return () => {
        player.removeEventListener('play', handlePlay);
        player.removeEventListener('pause', handlePause);
        player.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioPlayerRef, audioData]);


  return (
    <div className="flex flex-wrap gap-3 justify-center mt-6">
      {!isRecording && !audioData && (
        <Button
          onClick={onStartRecording}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
          size="lg"
        >
          <Mic className="mr-2 h-5 w-5" />
          Start Recording
        </Button>
      )}
      
      {isRecording && !isPaused && (
        <>
          <Button
            onClick={onPauseRecording}
            variant="secondary"
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
            size="lg"
          >
            <Square className="mr-2 h-5 w-5" />
            Pause
          </Button>
          <Button
            onClick={onStopRecording}
            variant="destructive"
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
            size="lg"
          >
            <MicOff className="mr-2 h-5 w-5" />
            Stop Recording
          </Button>
        </>
      )}
      {isRecording && isPaused && (
        <>
          <Button
            onClick={onResumeRecording}
            variant="secondary"
            className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
            size="lg"
          >
            <Play className="mr-2 h-5 w-5" />
            Resume
          </Button>
          <Button
            onClick={onStopRecording}
            variant="destructive"
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
            size="lg"
          >
            <MicOff className="mr-2 h-5 w-5" />
            Stop Recording
          </Button>
        </>
      )}
      
      {audioData && !isRecording && (
        <>
          <Button onClick={playAudio} variant="secondary" className="shadow-sm hover:bg-gray-700 transition-colors">
            {isPlaying ? (
              <>
                <Square className="mr-2 h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Play
              </>
            )}
          </Button>
          
          <Button onClick={onSaveRecording} variant="outline" className="shadow-sm border-gray-600 hover:bg-gray-700 hover:border-gray-500 transition-colors">
            <Save className="mr-2 h-4 w-4" />
            Save Audio
          </Button>
          
          <Button onClick={onDeleteRecording} variant="destructive" className="shadow-sm hover:bg-red-700 transition-colors">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </>
      )}
    </div>
  );
};

export default AudioControls;
