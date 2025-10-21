import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Headphones, Mic, FileText, Zap } from "lucide-react";

const StartNewMeeting = ({ onStartMeeting }) => {
  const [meetingName, setMeetingName] = useState("");
  const [previousMeetings, setPreviousMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPreviousMeetings();
  }, []);

  const fetchPreviousMeetings = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8765/meetings');
      if (response.ok) {
        const meetings = await response.json();
        setPreviousMeetings(meetings);
      }
    } catch (error) {
      console.error('Error fetching previous meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (meetingName.trim()) {
      setError("");
      onStartMeeting(meetingName);
    } else {
      setError("Meeting name is required.");
    }
  };

  const handleViewPreviousMeetings = () => {
    // Navigate to previous meetings page
    window.location.href = '/previous-meetings';
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mb-6">
              <Headphones className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              Start New Meeting
            </h1>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
              Record your meetings and get live transcriptions
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-12 w-full max-w-md mx-auto"
          >
            <div className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="meetingName" className="text-gray-300">
                  Meeting Name
                </Label>
                <Input
                  id="meetingName"
                  placeholder="Enter meeting name"
                  value={meetingName}
                  onChange={(e) => setMeetingName(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500"
                />
                {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
              </div>
              
              <Button
                onClick={handleStart}
                className="w-full px-8 py-6 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-105"
              >
                <Mic className="mr-2 h-6 w-6" />
                Start Recording
              </Button>
              
              <Button
                onClick={handleViewPreviousMeetings}
                disabled={loading}
                className="w-full px-8 py-6 text-lg bg-gradient-to-r from-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-900 rounded-full shadow-lg shadow-gray-500/20 hover:shadow-gray-500/40 transition-all duration-300 transform hover:scale-105"
              >
                <FileText className="mr-2 h-6 w-6" />
                Previous Meetings {loading ? 'Loading...' : `(${previousMeetings.length})`}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16"
          >
            <div className="flex flex-col items-center p-6 bg-gray-900/50 rounded-xl border border-gray-800">
              <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">Live Transcription</h3>
              <p className="text-gray-400 text-center">
                Get real-time transcription as you speak
              </p>
            </div>
            
            <div className="flex flex-col items-center p-6 bg-gray-900/50 rounded-xl border border-gray-800">
              <div className="w-14 h-14 rounded-full bg-pink-500/20 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">Export Options</h3>
              <p className="text-gray-400 text-center">
                Save and export your transcripts in multiple formats
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl p-8 border border-gray-800"
          >
            <h2 className="text-2xl font-bold mb-4 text-white">How to Get Started</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                  <span className="font-bold text-blue-400">1</span>
                </div>
                <p className="text-gray-300 text-sm">Enter meeting name</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                  <span className="font-bold text-purple-400">2</span>
                </div>
                <p className="text-gray-300 text-sm">Click Start Recording</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center mb-2">
                  <span className="font-bold text-pink-400">3</span>
                </div>
                <p className="text-gray-300 text-sm">Allow microphone access</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
                  <span className="font-bold text-green-400">4</span>
                </div>
                <p className="text-gray-300 text-sm">View and export transcript</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default StartNewMeeting;
