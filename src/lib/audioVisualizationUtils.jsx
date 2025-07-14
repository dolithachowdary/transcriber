
export const initializeAudioVisualization = (stream, audioContextRef, analyserRef, audioSourceNodeRef, visualizeFn, waveformData, setWaveformData, animationFrameRef) => {
  if (!stream) {
    console.error("No stream provided to initializeAudioVisualization");
    return;
  }
  try {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256; 
    audioSourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
    audioSourceNodeRef.current.connect(analyserRef.current);
    visualizeFn(audioContextRef, analyserRef, waveformData, setWaveformData, animationFrameRef);
  } catch (e) {
    console.error("Error initializing audio visualization: ", e);
    if(audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    audioSourceNodeRef.current = null;
  }
};

export const visualizeAudio = (audioContextRef, analyserRef, waveformData, setWaveformData, animationFrameRef) => {
  if (!analyserRef.current) {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    return;
  }
  
  const bufferLength = analyserRef.current.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  const updateWaveform = () => {
    if (!analyserRef.current || !audioContextRef.current || audioContextRef.current.state === 'closed') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }
    try {
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const newWaveform = Array(50).fill(0);
      const step = Math.floor(bufferLength / 50);
      
      for (let i = 0; i < 50; i++) {
        const index = i * step;
        newWaveform[i] = 5 + (dataArray[index] / 255) * 95;
      }
      
      setWaveformData(newWaveform);
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
    } catch (e) {
      console.error("Error during waveform update:", e);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };
  
  requestAnimationFrame(updateWaveform); 
};

export const cleanupAudioVisualization = (animationFrameRef) => {
  if (animationFrameRef.current) {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }
};
