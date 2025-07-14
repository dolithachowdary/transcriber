
import React, { forwardRef } from "react";

const AudioPlayer = forwardRef(({ audioData }, ref) => {
  if (!audioData) return null;

  return (
    <div className="my-4 flex justify-center">
      <audio ref={ref} src={audioData} controls className="w-full max-w-md rounded-lg shadow-md" />
    </div>
  );
});

AudioPlayer.displayName = "AudioPlayer";
export default AudioPlayer;
