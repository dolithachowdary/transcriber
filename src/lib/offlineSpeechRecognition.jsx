import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export const initializeOfflineSpeechRecognition = (onTranscriptSegment, getRecordingTime, toast) => {
  try {
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
      new URL('wss://localhost:8765')
    );
    speechConfig.speechRecognitionLanguage = 'en-US';

    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    let segmentIndex = 0;

    recognizer.recognized = (_, event) => {
      if (event.result.text) {
        const newSegment = {
          id: `segment-${Date.now()}-${segmentIndex++}`,
          speaker: "Speaker",
          text: event.result.text.trim(),
          timestamp: formatTime(getRecordingTime()),
        };
        onTranscriptSegment(newSegment);
      }
    };

    recognizer.canceled = (_, event) => {
      if (event.errorCode !== 0) {
        toast({
          variant: "destructive",
          title: "Speech Recognition Error",
          description: `Error occurred: ${event.errorDetails}`,
        });
      }
    };

    return recognizer;
  } catch (error) {
    console.error('Error initializing offline speech recognition:', error);
    toast({
      variant: "destructive",
      title: "Initialization Error",
      description: "Failed to initialize offline speech recognition.",
    });
    return null;
  }
};

export const startOfflineRecognition = (recognizer) => {
  if (recognizer) {
    recognizer.startContinuousRecognitionAsync();
  }
};

export const stopOfflineRecognition = (recognizer) => {
  if (recognizer) {
    recognizer.stopContinuousRecognitionAsync();
  }
};