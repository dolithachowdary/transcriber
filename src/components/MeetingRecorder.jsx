import React, { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import AudioRecorder from "@/components/AudioRecorder";
import TranscriptView from "@/components/TranscriptView";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InfoDialog from "@/components/InfoDialog";

const MeetingRecorder = ({ meetingName: propMeetingName }) => {
  const [transcript, setTranscript] = useState([]);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [recordingStopped, setRecordingStopped] = useState(false);
  const [summary, setSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const audioDataRef = useRef(null);

  // Use meetingName from props or fallback to default
  const [meetingName, setMeetingName] = useState(propMeetingName || "Untitled Meeting");

  React.useEffect(() => {
    if (propMeetingName) {
      setMeetingName(propMeetingName);
    }
  }, [propMeetingName]);

  const handleTranscriptUpdate = useCallback((newSegmentOrCallback) => {
    if (typeof newSegmentOrCallback === 'function') {
      // If a function is passed, use it to update the state (for clearing)
      setTranscript(newSegmentOrCallback);
    } else if (Array.isArray(newSegmentOrCallback)) {
      // If an array is passed, replace the transcript (for clearing with [])
      setTranscript(newSegmentOrCallback);
    } else {
      // Otherwise, add the new segment to the transcript
      setTranscript(prevTranscript => {
        // Simple duplicate detection based on ID (should be sufficient with our improved ID generation)
        const isDuplicate = prevTranscript.some(item => item.id === newSegmentOrCallback.id);
        
        if (!isDuplicate) {
          return [...prevTranscript, newSegmentOrCallback];
        }
        return prevTranscript;
      });
    }
  }, []);
  
  const handleSummaryReceived = useCallback((summaryText) => {
    setSummary(summaryText);
  }, []);
  
  const clearSummary = useCallback(() => {
    setSummary(null);
  }, []);

  const saveMeetingToDatabase = useCallback(async () => {
    // If transcript is empty, create a default segment with "No transcription available"
    const safeTranscript = transcript.length > 0 ? transcript : [{
      id: 'no-transcription',
      speaker: 'System',
      timestamp: new Date().toISOString(),
      text: 'No transcription available',
    }];

    setSaving(true);
    setError(null);
    
    try {
      // Prepare meeting data
      const meetingData = {
        meeting_name: meetingName,
        transcript: safeTranscript,
        summary: summary || null
      };
      
      // Save meeting to database
      const response = await fetch('http://localhost:8765/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(meetingData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save meeting: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Meeting saved successfully:', result);
      
      // If we have audio data, save it as well
      if (audioDataRef.current) {
        let audioUploadSuccess = false;
        let retryCount = 0;
        const maxRetries = 1;

        while (!audioUploadSuccess && retryCount <= maxRetries) {
          try {
            const audioBlob = await fetch(audioDataRef.current).then(r => r.blob());
            const audioArrayBuffer = await audioBlob.arrayBuffer();
            
            const audioResponse = await fetch(`http://localhost:8765/meetings/${result.meeting_id}/audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
              },
              body: audioArrayBuffer,
            });
            
            if (!audioResponse.ok) {
              const audioErrorText = await audioResponse.text();
              console.error('Failed to save audio data:', audioErrorText);
              setError('Failed to save audio data');
              retryCount++;
            } else {
              console.log('Audio data saved successfully');
              audioUploadSuccess = true;
              // Fetch updated meeting details to get audio_file_id
              const updatedMeetingResponse = await fetch(`http://localhost:8765/meetings/${result.meeting_id}`);
              if (updatedMeetingResponse.ok) {
                const updatedMeeting = await updatedMeetingResponse.json();
                // Optionally update local state or notify user here
                console.log('Updated meeting with audio_file_id:', updatedMeeting.audio_file_id);
              }
            }
          } catch (audioError) {
            console.error('Error saving audio data:', audioError);
            setError('Error saving audio data');
            retryCount++;
          }
        }
      }
      
      setSaving(false);
      return result.meeting_id;
    } catch (error) {
      console.error('Error saving meeting:', error);
      setError(error.message);
      setSaving(false);
      throw error;
    }
  }, [transcript, meetingName, summary]);

  const handleRecordingStop = useCallback(async () => {
    setRecordingStopped(true);
    
    // Save meeting to database
    try {
      await saveMeetingToDatabase();
    } catch (error) {
      console.error('Failed to save meeting to database:', error);
    }
  }, [saveMeetingToDatabase]);

  const handleAudioDataUpdate = useCallback((audioData) => {
    audioDataRef.current = audioData;
  }, []);


  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <Header onInfoClick={() => setInfoDialogOpen(true)} />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-7xl mx-auto" 
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              Transform Meeting Audio into Text
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Record your meetings and get live transcriptions along with speaker identification.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="md:col-span-1">
              <AudioRecorder 
                onTranscriptUpdate={handleTranscriptUpdate} 
                onRecordingStop={handleRecordingStop}
                onRecordingStart={() => setRecordingStopped(false)}
                onSummaryReceived={handleSummaryReceived}
                onAudioDataUpdate={handleAudioDataUpdate}
              />
            </div>
            <div className="md:col-span-1">
              <TranscriptView 
                transcript={transcript} 
                recordingStopped={recordingStopped}
                summary={summary}
                clearSummary={clearSummary}
              />
            </div>
          </div>
          
          {error && (
            <div className="text-red-500 text-center mb-4">
              Error: {error}
            </div>
          )}
          
          {saving && (
            <div className="text-green-500 text-center mb-4">
              Saving meeting...
            </div>
          )}
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl p-6 border border-gray-800 mb-12"
          >
            <h2 className="text-2xl font-bold mb-4 text-center text-white">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                  <span className="text-xl font-bold text-blue-400">1</span>
                </div>
                <h3 className="text-lg font-medium mb-2 text-white">Record</h3>
                <p className="text-gray-400">Start recording your meeting with a single click.</p>
              </div>
              
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                  <span className="text-xl font-bold text-purple-400">2</span>
                </div>
                <h3 className="text-lg font-medium mb-2 text-white">Transcribe</h3>
                <p className="text-gray-400">The app transcribes audio in real-time.</p>
              </div>
              
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mb-4">
                  <span className="text-xl font-bold text-pink-400">3</span>
                </div>
                <h3 className="text-lg font-medium mb-2 text-white">Review</h3>
                <p className="text-gray-400">Download or copy the transcript for your records.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>
      
      <Footer />
      <InfoDialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen} />
      <Toaster />
    </div>
  );
};

export default MeetingRecorder;
