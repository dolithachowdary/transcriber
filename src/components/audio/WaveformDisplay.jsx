
import React from "react";
import { motion } from "framer-motion";

const WaveformDisplay = ({ waveformData }) => {
  return (
    <div className="waveform-container mb-4">
      <div className="waveform">
        {waveformData.map((height, index) => (
          <motion.div
            key={index}
            className="waveform-bar"
            style={{ height: `${height}%` }}
            initial={{ height: "5%" }}
            animate={{ height: `${height}%` }}
            transition={{ type: "tween", duration: 0.1 }}
          />
        ))}
      </div>
    </div>
  );
};

export default WaveformDisplay;
