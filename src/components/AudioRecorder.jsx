
import React, { useRef } from "react";
import { motion } from "framer-motion";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import WaveformDisplay from "@/components/audio/WaveformDisplay";
import RecordingInfo from "@/components/audio/RecordingInfo";
import AudioControls from "@/components/audio/AudioControls";
import AudioPlayer from "@/components/audio/AudioPlayer";

const AudioRecorder = ({ onTranscriptUpdate }) => {
  const {
    isRecording,
    isPaused,
    audioData,
    recordingTime,
    waveformData,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    deleteRecording,
    saveRecording,
  } = useAudioRecorder(onTranscriptUpdate);

  const audioPlayerRef = useRef(null);

  // Handler to start a new meeting (reset everything)
  const handleStartNewMeeting = () => {
    deleteRecording();
    startRecording();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex flex-col p-6 rounded-xl gradient-bg shadow-2xl border border-gray-700/50"
    >
      <h2 className="text-3xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
        Audio Recorder
      </h2>
      
      <div className="flex-grow flex flex-col justify-center">
        <WaveformDisplay waveformData={waveformData} />
        <RecordingInfo 
          isRecording={isRecording} 
          recordingTime={recordingTime} 
        />
        {audioData && !isRecording && (
          <>
            <AudioPlayer ref={audioPlayerRef} audioData={audioData} />
            <div className="flex justify-center mt-6">
              <button
                onClick={handleStartNewMeeting}
                className="bg-gradient-to-r from-cyan-700 to-blue-800 hover:from-cyan-800 hover:to-blue-900 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all duration-300 ease-in-out ml-2"
              >
                Start New Meeting
              </button>
            </div>
          </>
        )}
      </div>
      <AudioControls
        isRecording={isRecording}
        isPaused={isPaused}
        audioData={audioData}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onSaveRecording={saveRecording}
        onDeleteRecording={deleteRecording}
        audioPlayerRef={audioPlayerRef}
      />
    </motion.div>
  );
};

export default AudioRecorder;
