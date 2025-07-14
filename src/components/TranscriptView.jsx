
import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Clock, Download, Copy, MessageSquare as MessageSquareText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const TranscriptView = ({ transcript }) => {
  const transcriptRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (transcriptRef.current && transcript.length > 0) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const getSpeakerClass = (speaker) => {
    if (speaker === "Speaker 1" || speaker === "Speaker") return "speaker-1";
    if (speaker === "Speaker 2") return "speaker-2";
    if (speaker === "Speaker 3") return "speaker-3";
    if (speaker === "Speaker 4") return "speaker-4";
    return "unknown";
  };

  const copyTranscript = () => {
    if (transcript.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to copy",
        description: "There is no transcript available to copy.",
      });
      return;
    }

    const formattedTranscript = transcript
      .map((item) => `[${item.timestamp}] ${item.speaker || 'Transcript'}: ${item.text}`)
      .join("\n\n");

    navigator.clipboard.writeText(formattedTranscript).then(
      () => {
        toast({
          title: "Copied to clipboard",
          description: "The transcript has been copied to your clipboard.",
        });
      },
      (err) => {
        console.error("Could not copy text: ", err);
        toast({
          variant: "destructive",
          title: "Copy failed",
          description: "Failed to copy the transcript to clipboard.",
        });
      }
    );
  };

  const downloadTranscript = () => {
    if (transcript.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to download",
        description: "There is no transcript available to download.",
      });
      return;
    }

    const formattedTranscript = transcript
      .map((item) => `[${item.timestamp}] ${item.speaker || 'Transcript'}: ${item.text}`)
      .join("\n\n");

    const blob = new Blob([formattedTranscript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Transcript downloaded",
      description: "Your transcript has been downloaded as a text file.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-full h-full flex flex-col p-6 rounded-xl gradient-bg shadow-2xl border border-gray-700/50"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
          Live Transcript
        </h2>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyTranscript}
            disabled={transcript.length === 0}
            className="shadow-sm border-gray-600 hover:bg-gray-700 hover:border-gray-500 transition-colors text-gray-300"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTranscript}
            disabled={transcript.length === 0}
            className="shadow-sm border-gray-600 hover:bg-gray-700 hover:border-gray-500 transition-colors text-gray-300"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="flex-grow transcript-container pr-2 space-y-4 overflow-y-auto">
        {transcript.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <MessageSquareText className="w-24 h-24 text-gray-600" />
            </motion.div>
            <h3 className="text-xl font-medium mb-2 text-gray-300">No transcript yet</h3>
            <p className="max-w-md text-gray-500">
              Start recording to generate a live transcript.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {transcript.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col"
              >
                <div className={`speaker-bubble ${getSpeakerClass(item.speaker)} text-white`}>
                  <p className="text-sm leading-relaxed">{item.text}</p>
                </div>
                <div className={`flex items-center text-xs text-gray-500 mt-1 ${getSpeakerClass(item.speaker) === 'speaker-1' || getSpeakerClass(item.speaker) === 'unknown' ? 'self-start' : 'self-end'}`}>
                  <User className="h-3 w-3 mr-1" />
                  <span className="font-medium mr-2">{item.speaker || 'Speaker'}</span>
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{item.timestamp}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
      <div ref={transcriptRef} />
    </motion.div>
  );
};

export default TranscriptView;
