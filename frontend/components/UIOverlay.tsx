"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import HudCanvas from "./HudCanvas";

export default function UIOverlay() {
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");
  const { isConnected, isRecording, toggleRecording, logs, sendCommand } = useVoiceChat();
  const [cpu, setCpu] = useState(18);
  const [mem, setMem] = useState(45);
  const [cmdText, setCmdText] = useState("");

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour12: false }));
      setDateStr(now.toLocaleDateString("en-GB", { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }));
    };
    updateTime();
    
    // FIX #42: Removed fake system telemetry generator that was lying to the user
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="w-full h-full absolute inset-0 pointer-events-none text-white font-space selection:bg-primary/30 z-10 flex flex-col">
      {/* Radial glow background effect behind everything but the 3D core */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,30,50,0.4)_0%,_rgba(0,0,0,0.8)_100%)] -z-10 pointer-events-none mix-blend-screen" />

      {/* CENTER HUD CANVAS (Absolute Center of Window) */}
      <div 
        className="absolute top-1/2 left-1/2 w-[600px] h-[600px] pointer-events-auto opacity-80 mix-blend-screen z-0"
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <HudCanvas state={isRecording ? "LISTENING" : "IDLE"} muted={!isRecording} />
      </div>

      {/* TOP STATUS BAR */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="w-full flex items-center justify-between p-6 pointer-events-auto shrink-0"
      >
        <div className="font-orbitron text-primary tracking-[0.2em] text-sm opacity-80 w-1/3">
        </div>

        <div className="flex flex-col items-center justify-center w-1/3">
          <div className="font-orbitron text-2xl tracking-[0.4em] text-primary font-black text-glow-primary whitespace-nowrap">
            S.E.N.T.I.N.E.L
          </div>
          <div className="font-exo text-[10px] text-primary/60 tracking-widest uppercase whitespace-nowrap">
            Something Extremely Neural and Terrifyingly Intelligent
          </div>
        </div>

        <div className="font-orbitron text-primary text-right w-1/3 flex flex-col items-end">
          <div className="text-xl tracking-widest font-bold">{timeStr}</div>
          <div className="text-[10px] tracking-widest opacity-60">
            {dateStr}
          </div>
        </div>
      </motion.div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-h-0 w-full flex justify-between px-6 pb-6 pt-2 pointer-events-none relative">

        {/* LEFT PANEL */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="w-64 h-full flex flex-col gap-6 pointer-events-auto z-20"
        >
          {/* SYS MONITOR */}
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <div className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-primary border-b-4 border-b-transparent" />
              <span className="font-orbitron text-[10px] tracking-widest text-primary font-bold uppercase">SYS MONITOR</span>
            </div>

            {/* Bars Box */}
            <div className="flex flex-col gap-4 p-4 border border-primary/20 rounded-sm">
              <div className="flex flex-col gap-1 text-[10px] font-orbitron tracking-widest">
                <div className="flex justify-between"><span className="text-primary/70">CPU</span><span className="text-primary">{cpu.toFixed(0)}%</span></div>
                <div className="w-full h-1 bg-white/5"><div className="h-full bg-primary transition-all duration-1000" style={{ width: `${cpu}%` }} /></div>
              </div>
              <div className="flex flex-col gap-1 text-[10px] font-orbitron tracking-widest">
                <div className="flex justify-between"><span className="text-warning/70">MEM</span><span className="text-warning">{mem.toFixed(0)}%</span></div>
                <div className="w-full h-1 bg-white/5"><div className="h-full bg-warning transition-all duration-1000" style={{ width: `${mem}%` }} /></div>
              </div>
              <div className="flex flex-col gap-1 text-[10px] font-orbitron tracking-widest">
                <div className="flex justify-between"><span className="text-success/70">NET</span><span className="text-success">0.5M</span></div>
                <div className="w-full h-1 bg-white/5"><div className="h-full bg-success w-[10%]" /></div>
              </div>
              <div className="flex flex-col gap-1 text-[10px] font-orbitron tracking-widest">
                <div className="flex justify-between"><span className="text-danger/70">GPU</span><span className="text-danger">1%</span></div>
                <div className="w-full h-1 bg-white/5"><div className="h-full bg-danger w-[1%]" /></div>
              </div>
              <div className="flex flex-col gap-1 text-[10px] font-orbitron tracking-widest">
                <div className="flex justify-between"><span className="text-pink-400/70">TMP</span><span className="text-pink-400">45°C</span></div>
                <div className="w-full h-1 bg-white/5"><div className="h-full bg-pink-400 w-[45%]" /></div>
              </div>

              <div className="mt-4 flex flex-col gap-1 border-t border-primary/20 pt-4 font-orbitron text-[10px] tracking-widest">
                <div className="flex justify-between text-success/80"><span>UP</span><span>00:00:00</span></div>
                <div className="flex justify-between text-primary/80"><span>PROC</span><span>214</span></div>
                <div className="flex justify-between text-warning/80"><span>OS</span><span>WEB</span></div>
              </div>
            </div>
          </div>

          {/* Bottom Left Buttons */}
          <div className="flex flex-col gap-2 shrink-0">
            <button className="border border-success/30 hover:border-success text-success text-[10px] font-orbitron tracking-widest py-2 rounded-sm transition-colors">
              AI CORE ACTIVE
            </button>
            <button className="border border-primary/30 hover:border-primary text-primary text-[10px] font-orbitron tracking-widest py-2 rounded-sm transition-colors">
              SEC CLEARED
            </button>
          </div>
        </motion.div>

        {/* RIGHT PANEL */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="w-80 h-full flex flex-col gap-6 pointer-events-auto"
        >
          {/* ACTIVITY LOG */}
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <div className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-primary border-b-4 border-b-transparent" />
              <span className="font-orbitron text-[10px] tracking-widest text-primary font-bold uppercase">ACTIVITY LOG</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto invisible-scrollbar font-mono text-[10px] text-warning flex flex-col gap-1 p-3 border border-primary/20 rounded-sm">
              {logs.map((log, i) => (
                <p key={i}>{log}</p>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* FILE UPLOAD */}
          <div className="flex flex-col h-24 shrink-0">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <div className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-primary border-b-4 border-b-transparent" />
              <span className="font-orbitron text-[10px] tracking-widest text-primary font-bold uppercase">FILE UPLOAD</span>
            </div>
            <div className="flex-1 border border-dashed border-primary/30 rounded-sm flex items-center justify-center text-primary/50 text-[10px] font-orbitron cursor-pointer hover:bg-primary/5 transition-colors">
              DRAG & DROP / CLICK
            </div>
          </div>

          {/* COMMAND INPUT */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-primary border-b-4 border-b-transparent" />
              <span className="font-orbitron text-[10px] tracking-widest text-primary font-bold uppercase">COMMAND INPUT</span>
            </div>

            {/* FIX #43: Wire up the Command Input form to send via WebSocket */}
            <form onSubmit={(e) => { 
                e.preventDefault(); 
                if (cmdText.trim()) {
                  sendCommand(cmdText.trim());
                  setCmdText(''); 
                }
              }} className="flex gap-2">
              <input
                type="text"
                value={cmdText}
                onChange={e => setCmdText(e.target.value)}
                placeholder="Type a command..."
                className="flex-1 bg-transparent border border-primary/30 rounded-sm p-2 text-xs font-mono outline-none focus:border-primary text-white transition-colors"
              />
              <button type="submit" className="border border-warning rounded-sm text-warning p-2 hover:bg-warning/10 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>

            <button 
              onClick={toggleRecording}
              className={`w-full p-2 border rounded-sm font-orbitron text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2
                ${isRecording 
                  ? 'border-success text-success bg-success/10' 
                  : 'border-red-500 text-red-500 hover:bg-red-500/10'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              {isRecording ? "MICROPHONE ACTIVE" : "MICROPHONE STANDBY"}
            </button>

            <button onClick={handleFullscreen} className="w-full p-2 border rounded-sm border-primary/30 text-primary hover:border-primary text-[10px] font-orbitron tracking-widest flex items-center justify-center gap-2 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
              FULLSCREEN [F11]
            </button>
          </div>
        </motion.div>
      </div>

      {/* FIX #41: Use CSS animation for waveform instead of Framer Motion Math.random() React thrashing */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8 opacity-50 pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className={`w-2 ${isRecording ? 'bg-primary animate-pulse' : 'bg-white/20'}`}
            style={{ 
              height: isRecording ? '24px' : '4px',
              animationDelay: `${i * 0.05}s`,
              animationDuration: '0.5s'
            }}
          />
        ))}
      </div>

    </div>
  );
}
