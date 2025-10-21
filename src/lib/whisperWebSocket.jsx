import { formatTime } from '@/lib/utils';

export class WhisperWebSocketClient {
  constructor(onTranscriptSegment, onError, onConnectionChange, onSummaryReceived) {
    this.ws = null;
    this.onTranscriptSegment = onTranscriptSegment;
    this.onError = onError;
    this.onConnectionChange = onConnectionChange;
    this.onSummaryReceived = onSummaryReceived; // New callback for summary
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.audioQueue = [];
    this.isProcessing = false;
  }

  connect() {
    try {
      // Connect to Python Whisper server using transcribe endpoint
      this.ws = new WebSocket('ws://localhost:8765/ws/transcribe');
      
      this.ws.onopen = () => {
        console.log('Connected to Whisper server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnectionChange?.(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'transcription' && data.segments) {
            // Process each segment from Whisper
            data.segments.forEach(segment => {
              // Create a unique identifier based on text content and timing to prevent duplicates
              const segmentId = `whisper-${segment.start}-${segment.end}-${segment.text.substring(0, 20)}`;
              const transcriptSegment = {
                id: segmentId,
                speaker: segment.speaker,
                text: segment.text,
                timestamp: segment.timestamp,
                start: segment.start,
                end: segment.end
              };
              
              this.onTranscriptSegment(transcriptSegment);
            });
          } else if (data.type === 'summary' && this.onSummaryReceived) {
            // Handle summary message
            this.onSummaryReceived(data.text);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.onError?.('Error parsing server response');
        }
      };

      this.ws.onclose = (event) => {
        console.log('Whisper WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.onConnectionChange?.(false);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('Whisper WebSocket error:', error);
        this.onError?.('Connection error to transcription server');
      };

    } catch (error) {
      console.error('Error connecting to Whisper server:', error);
      this.onError?.('Failed to connect to transcription server');
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  sendAudioData(audioData) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        // Send raw audio data to Whisper server
        this.ws.send(audioData);
      } catch (error) {
        console.error('Error sending audio data:', error);
        this.onError?.('Error sending audio to server');
      }
    } else {
      console.warn('WebSocket not connected, queuing audio data');
      // Queue audio data if not connected
      this.audioQueue.push(audioData);
    }
  }

  processQueuedAudio() {
    if (this.isConnected && this.audioQueue.length > 0) {
      console.log(`Processing ${this.audioQueue.length} queued audio chunks`);
      
      while (this.audioQueue.length > 0) {
        const audioData = this.audioQueue.shift();
        this.sendAudioData(audioData);
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.isConnected = false;
    this.audioQueue = [];
    this.onConnectionChange?.(false);
  }

  sendStopCommand() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send("stop");
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Audio processing utilities for real-time streaming
export class AudioProcessor {
  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate;
    this.audioContext = null;
    this.processor = null;
    this.stream = null;
  }

  async initialize(stream) {
    try {
      this.stream = stream;
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate
      });

      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Create a script processor for real-time audio processing
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      return true;
    } catch (error) {
      console.error('Error initializing audio processor:', error);
      return false;
    }
  }

  onAudioProcess(callback) {
    if (this.processor) {
      this.processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert float32 to int16 for Whisper
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        callback(int16Array.buffer);
      };
    }
  }

  cleanup() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.stream = null;
  }
}

// Initialize Whisper WebSocket connection
export const initializeWhisperConnection = (onTranscriptSegment, onError, onConnectionChange, onSummaryReceived) => {
  const client = new WhisperWebSocketClient(onTranscriptSegment, onError, onConnectionChange, onSummaryReceived);
  client.connect();
  return client;
};

// Setup real-time audio streaming to Whisper
export const setupWhisperAudioStreaming = async (stream, whisperClient) => {
  const audioProcessor = new AudioProcessor();
  
  const initialized = await audioProcessor.initialize(stream);
  if (!initialized) {
    throw new Error('Failed to initialize audio processor');
  }

  audioProcessor.onAudioProcess((audioBuffer) => {
    whisperClient.sendAudioData(audioBuffer);
  });

  return audioProcessor;
};
