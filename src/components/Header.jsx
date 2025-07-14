
import React from "react";
import { motion } from "framer-motion";
import { Headphones, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = ({ onInfoClick }) => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full py-4 px-6 flex justify-between items-center border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800"
    >
      <div className="flex items-center">
        <motion.div
          initial={{ rotate: -10, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
        >
          <Headphones className="h-8 w-8 text-blue-500 mr-3" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-bold text-white">Meeting Transcriber</h1>
          <p className="text-sm text-gray-400">Speech to Text with Speaker Recognition</p>
        </div>
      </div>
      
      <Button variant="ghost" size="sm" onClick={onInfoClick}>
        <Info className="h-5 w-5 mr-2" />
        How it works
      </Button>
    </motion.header>
  );
};

export default Header;
