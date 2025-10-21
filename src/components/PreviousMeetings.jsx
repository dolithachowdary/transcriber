import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileText, Calendar, Headphones, Download, Play, Trash2 } from "lucide-react";

const PreviousMeetings = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [deletingMeetingId, setDeletingMeetingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8765/meetings');
      if (response.ok) {
        let meetingsData = await response.json();
        // Sort meetings by created_at descending (latest first)
        meetingsData = meetingsData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setMeetings(meetingsData);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingDetails = async (meetingId) => {
    try {
      const response = await fetch(`http://localhost:8765/meetings/${meetingId}`);
      if (response.ok) {
        const meetingData = await response.json();
        setSelectedMeeting(meetingData);
      }
    } catch (error) {
      console.error('Error fetching meeting details:', error);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' };
    return new Date(dateString).toLocaleString(undefined, options);
  };

  const handleBackToNewMeeting = () => {
    navigate('/');
  };

  const handleViewTranscript = (meetingId) => {
    fetchMeetingDetails(meetingId);
  };

  const handleDownloadTranscript = (meeting) => {
    const transcriptText = meeting.transcript
      .map(segment => `[${segment.timestamp}] ${segment.speaker || 'Speaker'}: ${segment.text}`)
      .join('\n\n');

    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.meeting_name}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAudio = async (meetingId) => {
    try {
      const response = await fetch(`http://localhost:8765/meetings/${meetingId}/audio`);
      if (response.ok) {
        const data = await response.json();
        // In a real implementation, you would handle the audio data here
        console.log('Audio download functionality would be implemented here');
      }
    } catch (error) {
      console.error('Error downloading audio:', error);
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    if (!window.confirm("Are you sure you want to delete this meeting?")) {
      return;
    }
    setDeletingMeetingId(meetingId);
    try {
      const response = await fetch(`http://localhost:8765/meetings/${meetingId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        // Refresh meetings list after deletion
        await fetchMeetings();
        if (selectedMeeting && selectedMeeting.meeting_id === meetingId) {
          setSelectedMeeting(null);
        }
      } else {
        console.error('Failed to delete meeting');
      }
    } catch (error) {
      console.error('Error deleting meeting:', error);
    } finally {
      setDeletingMeetingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-950">
        <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center">
          <div className="text-2xl text-white">Loading previous meetings...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <main className="flex-1 container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              Previous Meetings
            </h1>
            <div className="space-x-2">
              <Button
                onClick={() => window.history.back()}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-800 rounded-full shadow-lg shadow-gray-700/20 hover:shadow-gray-700/40 transition-all duration-300"
              >
                Back
              </Button>
              <Button
                onClick={handleBackToNewMeeting}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300"
              >
                Start New Meeting
              </Button>
            </div>
          </div>

          {selectedMeeting ? (
            // Detailed view of selected meeting
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-gray-900/50 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedMeeting.meeting_name}</h2>
                  <p className="text-gray-400 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(selectedMeeting.created_at)}
                  </p>
                </div>
                <Button
                  onClick={() => setSelectedMeeting(null)}
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Back to List
                </Button>
              </div>

              <div className="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-400" />
                  Meeting Summary
                </h3>
                <p className="text-gray-300 whitespace-pre-wrap">{selectedMeeting.summary || "No summary available"}</p>
              </div>
              {selectedMeeting.audio_file_id && (
                <div className="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h3 className="text-xl font-semibold text-white mb-3 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-purple-400" />
                    Audio
                  </h3>
                  <audio controls className="w-full">
                    <source src={`http://localhost:8765/meetings/${selectedMeeting.meeting_id}/audio`} type="audio/wav" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Headphones className="w-5 h-5 mr-2 text-purple-400" />
                  Transcript
                </h3>
                <div className="max-h-96 overflow-y-auto pr-2 transcript-container space-y-4">
                  {selectedMeeting.transcript.map((segment, index) => (
                    <div key={index} className="p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-blue-400">{segment.speaker || 'Speaker'}</span>
                        <span className="text-xs text-gray-500">{segment.timestamp}</span>
                      </div>
                      <p className="text-gray-300">{segment.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={() => handleDownloadTranscript(selectedMeeting)}
                  className="flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Transcript
                </Button>
                {selectedMeeting.audio_file_id && (
                  <Button
                    onClick={() => handleDownloadAudio(selectedMeeting.meeting_id)}
                    className="flex items-center px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Download Audio
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            // List view of all meetings as horizontal rows
            <div className="flex flex-col space-y-4">
              {meetings.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-400 mb-2">No previous meetings</h3>
                  <p className="text-gray-500">Start a new meeting to see it appear here</p>
                </div>
              ) : (
                meetings.map((meeting) => (
                  <motion.div
                    key={meeting.meeting_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between bg-gray-900/50 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-all duration-300"
                  >
                    <div className="flex flex-col flex-grow mr-4">
                      <h3 className="text-lg font-semibold text-white truncate">{meeting.meeting_name}</h3>
                <p className="text-gray-400 text-sm flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {console.log("Raw created_at:", meeting.created_at, "Formatted:", formatDate(meeting.created_at))}
                  {formatDate(meeting.created_at)}
                </p>
                      <p className="text-gray-500 text-sm line-clamp-2">
                        {meeting.summary || 'No summary available'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleViewTranscript(meeting.meeting_id)}
                        variant="outline"
                        size="sm"
                        className="text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        View Details
                      </Button>
                      <Button
                        onClick={() => handleDownloadTranscript(meeting)}
                        variant="outline"
                        size="sm"
                        className="text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Transcript
                      </Button>
                      <Button
                        onClick={() => handleDeleteMeeting(meeting.meeting_id)}
                        variant="outline"
                        size="sm"
                        className="text-xs border-gray-700 text-red-500 hover:bg-gray-800"
                        disabled={deletingMeetingId === meeting.meeting_id}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {deletingMeetingId === meeting.meeting_id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default PreviousMeetings;
