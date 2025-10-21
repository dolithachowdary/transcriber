const express = require('express');
const WebSocket = require('ws');
const vad = require('node-vad');
const Leopard = require('@picovoice/leopard-node');

const app = express();
const server = app.listen(8765, () => {
  console.log('Server running on port 8765');
});

const wss = new WebSocket.Server({ server });

// Initialize Leopard for offline speech recognition
const leopard = new Leopard('YOUR_ACCESS_KEY');

// Initialize VAD (Voice Activity Detection)
const vadInstance = new vad(vad.Mode.NORMAL);

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', async (data) => {
    try {
      // Check if the incoming data contains voice activity
      const vadResult = await vadInstance.processAudio(data);
      
      if (vadResult === vad.Event.VOICE) {
        // Process audio with Leopard
        const result = await leopard.process(data);
        
        if (result.transcript) {
          ws.send(JSON.stringify({
            type: 'transcript',
            text: result.transcript
          }));
        }
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});