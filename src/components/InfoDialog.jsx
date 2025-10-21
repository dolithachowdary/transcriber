
import React from "react";
import { motion } from "framer-motion";
import { X, Mic, Users, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const InfoDialog = ({ open, onOpenChange }) => {
  const features = [
    {
      icon: <Mic className="h-8 w-8 text-blue-500" />,
      title: "Audio Recording",
      description: "Record your meetings with high-quality audio capture.",
    },
    // {
    //   icon: <Users className="h-8 w-8 text-purple-500" />,
    //   title: "Speaker Identification",
    //   description: "Basic speaker labeling for transcribed segments.",
    // },
    {
      icon: <FileText className="h-8 w-8 text-pink-500" />,
      title: "Text Transcription",
      description: "Convert speech to text transcripts in real-time using whisper.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl">How Meeting Transcriber Works</DialogTitle>
          <DialogDescription className="text-gray-400">
            This tool helps you capture, identify speakers in, and transcribe meeting conversations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6 py-4">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex-1 flex flex-col items-center text-center p-4 rounded-lg bg-gray-800 border border-gray-700 min-w-0"
              style={{ minWidth: 0 }}
            >
              <div className="mb-3">{feature.icon}</div>
              <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InfoDialog;
