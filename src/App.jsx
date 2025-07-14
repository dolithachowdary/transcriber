
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import AudioRecorder from "@/components/AudioRecorder";
import TranscriptView from "@/components/TranscriptView";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InfoDialog from "@/components/InfoDialog";

const App = () => {
  const [transcript, setTranscript] = useState([]);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  const handleTranscriptUpdate = useCallback((newSegmentOrCallback) => {
    if (typeof newSegmentOrCallback === 'function') {
      setTranscript(newSegmentOrCallback);
    } else {
      setTranscript(prevTranscript => {
        const isDuplicate = prevTranscript.some(
          item => item.text === newSegmentOrCallback.text && 
                  Math.abs(parseTimestamp(item.timestamp) - parseTimestamp(newSegmentOrCallback.timestamp)) < 2
        );
        if (!isDuplicate) {
          return [...prevTranscript, newSegmentOrCallback];
        }
        return prevTranscript;
      });
    }
  }, []);

  const parseTimestamp = (timestampStr) => {
    if (!timestampStr || typeof timestampStr !== 'string') return 0;
    const parts = timestampStr.split(':');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };


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
              <AudioRecorder onTranscriptUpdate={handleTranscriptUpdate} />
            </div>
            <div className="md:col-span-1">
              <TranscriptView transcript={transcript} />
            </div>
          </div>
          
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

export default App;
