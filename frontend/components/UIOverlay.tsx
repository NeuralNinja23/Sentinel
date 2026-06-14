"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useVoiceChat } from "@/hooks/useVoiceChat";

export default function UIOverlay() {
  const [time, setTime] = useState("");
  const { isConnected, isRecording, toggleRecording } = useVoiceChat();

  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full relative text-white font-space selection:bg-primary/30">

      {/* TOP STATUS BAR */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute top-0 left-0 w-full h-16 flex items-center justify-between px-8 bg-gradient-to-b from-black/80 to-transparent border-b border-primary/20 backdrop-blur-sm"
      >
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="font-orbitron text-sm tracking-widest text-primary">Something Extremely Neural and Terrifyingly Intelligent</span>
          </div>
          <div className="font-exo text-xs text-white/50"></div>
        </div>

        <div className="font-orbitron text-2xl tracking-widest text-primary font-bold text-glow-primary">
          S.E.N.T.I.N.E.L
        </div>
      </motion.div>







      {/* BOTTOM: VOICE COMMAND DOCK */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[400px]"
      >
        <div className="relative group cursor-pointer" onClick={toggleRecording}>
          <div className={`absolute -inset-1 rounded-full blur opacity-40 transition duration-1000 group-hover:duration-200 animate-tilt ${isRecording ? 'bg-red-500 opacity-100 animate-pulse' : 'bg-gradient-to-r from-primary via-accent to-secondary'}`}></div>
          <div className={`relative px-6 py-4 bg-black rounded-full border flex items-center justify-between ${isRecording ? 'border-red-500/50' : 'border-white/10'}`}>
            <div className="flex space-x-1 items-center">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1 rounded-full ${isRecording ? 'bg-red-500' : 'bg-primary'}`}
                  animate={{ height: isRecording ? ["8px", "24px", "8px"] : ["4px", "16px", "4px"] }}
                  transition={{ repeat: Infinity, duration: isRecording ? 0.8 : 1.5, delay: i * 0.1 }}
                />
              ))}
            </div>
            <span className={`font-orbitron text-xs tracking-[0.2em] transition-colors duration-300 ${isRecording ? 'text-red-500' : 'text-white/50 group-hover:text-primary'}`}>
              {isRecording ? "LISTENING..." : (isConnected ? "AWAITING DIRECTIVE" : "CONNECTING...")}
            </span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 border ${isRecording ? 'bg-red-500/20 border-red-500/50' : 'bg-white/5 group-hover:bg-primary/20 border-white/10'}`}>
              <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_#00E5FF] animate-pulse ${isRecording ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-primary'}`} />
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
