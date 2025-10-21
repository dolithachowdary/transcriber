
import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import StartNewMeeting from "@/components/StartNewMeeting";
import MeetingRecorder from "@/components/MeetingRecorder";
import PreviousMeetings from "@/components/PreviousMeetings";

const App = () => {
  const navigate = useNavigate();
  const [meetingName, setMeetingName] = useState("");

  const handleStartMeeting = (name) => {
    setMeetingName(name);
    navigate('/meeting');
  };

  return (
    <Routes>
      <Route path="/" element={<StartNewMeeting onStartMeeting={handleStartMeeting} />} />
      <Route path="/meeting" element={<MeetingRecorder meetingName={meetingName} />} />
      <Route path="/previous-meetings" element={<PreviousMeetings />} />
    </Routes>
  );
};

export default App;
