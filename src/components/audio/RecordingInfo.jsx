
import React from "react";
import { motion } from "framer-motion";
import { Timer, Radio } from "lucide-react";
import { formatTime } from "@/lib/utils";

const RecordingInfo = ({ isRecording, recordingTime }) => {
  return (
    <div className="my-6 text-center">
      {isRecording ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center text-xl font-medium text-red-400"
        >
          <Radio className="mr-2 h-5 w-5 animate-pulse" />
          Recording: {formatTime(recordingTime)}
        </motion.div>
      ) : recordingTime > 0 ? (
        <div className="flex items-center justify-center text-lg text-gray-400">
          <Timer className="mr-2 h-5 w-5" />
          Last recording: {formatTime(recordingTime)}
        </div>
      ) : (
         <div className="text-lg text-gray-500">
            Click "Start Recording" to begin.
         </div>
      )}
    </div>
  );
};

export default RecordingInfo;
