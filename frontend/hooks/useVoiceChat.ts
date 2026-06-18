import { useState, useRef, useCallback, useEffect } from "react";

// Define a type for the speaking state to be clearer
type SpeakingState = "INACTIVE" | "LISTENING" | "SPEAKING" | "THINKING";

export function useVoiceChat() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  // Add speakingState to track when the user or Sentinel is active
  const [speakingState, setSpeakingState] = useState<SpeakingState>("INACTIVE");
  const [logs, setLogs] = useState<string[]>(["SENTINEL Online"]);
  
  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, msg].slice(-50)); // Keep last 50 logs
  }, []);

  const sendCommand = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "command", text }));
      addLog(`USER COMMAND: ${text}`);
      setSpeakingState("THINKING"); // Assume command input makes Sentinel think
    }
  }, [addLog]);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const isActivatingRef = useRef(false);

  // FIX #16: Properly clean up hardware locks on refresh to prevent Chrome deadlocks
  useEffect(() => {
    const cleanupHardware = () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => {
          t.stop();
          console.log("Hardware track stopped on unload");
        });
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setSpeakingState("INACTIVE");
    };
    window.addEventListener("beforeunload", cleanupHardware);
    return () => {
      window.removeEventListener("beforeunload", cleanupHardware);
      cleanupHardware();
    };
  }, []);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    if (isRecording) {
      setSpeakingState("LISTENING");
    } else {
      setSpeakingState("INACTIVE");
    }
  }, [isRecording]);

  // Playback state
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopAllAudio = useCallback(() => {
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    activeSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
  }, []);

  const playAudioChunk = useCallback((arrayBuffer: ArrayBuffer) => {
    // We are receiving audio chunks, so Sentinel is speaking
    setSpeakingState("SPEAKING");
    
    // Initialize playback context if it doesn't exist. Must be 24000Hz for Gemini Live Output
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const audioContext = playbackContextRef.current;
    
    // FIX #14: Gemini Live returns 24kHz 16-bit Mono PCM (Little Endian).
    const dataView = new DataView(arrayBuffer);
    const float32Array = new Float32Array(arrayBuffer.byteLength / 2);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Decode Little-Endian 16-bit PCM and normalize to -1.0 to 1.0 float range
      const int16 = dataView.getInt16(i * 2, true);
      float32Array[i] = int16 / 32768.0;
    }

    const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    activeSourcesRef.current.add(source);

    // Schedule playback seamlessly to avoid radio static / clicking
    if (nextPlayTimeRef.current < audioContext.currentTime) {
      nextPlayTimeRef.current = audioContext.currentTime + 0.05;
    }
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;

    // Set state back to LISTENING after playback finishes
    source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0) {
            setSpeakingState(isRecordingRef.current ? "LISTENING" : "INACTIVE");
        }
    };

  }, []);

  useEffect(() => {
    // We only initialize AudioContext on startRecording to comply with browser autoplay policies
    const ws = new WebSocket("ws://localhost:8000/ws/voice");
    // FIX #14: Receive binary frames as ArrayBuffer directly
    ws.binaryType = "arraybuffer";
    
    ws.onopen = () => {
      console.log("Connected to Sentinel Backend");
      setIsConnected(true);
      setSpeakingState("LISTENING");
    };

    ws.onmessage = (event) => {
      // FIX #14: Audio frames arrive as raw binary
      if (event.data instanceof ArrayBuffer) {
        if (!isRecordingRef.current) return; // Drop audio completely if mic is off
        playAudioChunk(event.data);
        return;
      }
      
      const msg = JSON.parse(event.data);
      if (msg.type === "system") {
        console.log("System:", msg.message);
      } else if (msg.type === "text") {
        console.log("Sentinel:", msg.data);
        addLog(`SENTINEL: ${msg.data}`);
        // If Sentinel sends text, it is thinking or preparing to speak
        setSpeakingState("THINKING");
      } else if (msg.type === "user") {
        addLog(`USER: ${msg.data}`);
      } else if (msg.type === "interrupt") {
        console.log("Sentinel playback interrupted by user barge-in.");
        addLog("SYS: Playback interrupted.");
        // FIX #12: Forcefully stop all scheduled audio buffers.
        stopAllAudio();
        setSpeakingState("SPEAKING"); // User is now speaking
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setSpeakingState("INACTIVE");
    };
    wsRef.current = ws;

    return () => {
      ws.close();
      setSpeakingState("INACTIVE");
    };
  }, [playAudioChunk]);

  // [startRecording implementation remains the same]
  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Get microphone access - explicitly request mono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      mediaStreamRef.current = stream;
      
      // IMPORTANT: Do NOT force sampleRate on the AudioContext.
      // Chrome's createMediaStreamSource passes audio at the mic's native rate
      // regardless of AudioContext.sampleRate, causing a silent mismatch.
      // The AudioWorklet will resample from native rate -> 16kHz.
      if (!recordingContextRef.current) {
        recordingContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } else if (recordingContextRef.current.state === "suspended") {
        await recordingContextRef.current.resume();
      }
      
      // Fix: Also initialize and resume playback context here to bypass Autoplay Policies
      if (!playbackContextRef.current) {
        playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (playbackContextRef.current.state === "suspended") {
        await playbackContextRef.current.resume();
      }
      
      const audioContext = recordingContextRef.current;
      console.log(`[Sentinel Audio] AudioContext actual sampleRate: ${audioContext.sampleRate}Hz — worklet will resample to 16000Hz`);
      const source = audioContext.createMediaStreamSource(stream);

      // FIX #13: Use AudioWorklet instead of deprecated createScriptProcessor
      // Load it from the public directory to bypass strict CSP restrictions in WebViews
      try {
        await audioContext.audioWorklet.addModule(`/pcm-processor.js?v=${Date.now()}`);
      } catch(e) {
        // Module might already be added
        console.warn("AudioWorklet module already added or failed:", e);
      }
      
      const workletNode = new (window as any).AudioWorkletNode(audioContext, 'pcm-processor');
      
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      // Send the sample rate to the backend so it knows how to downsample
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "config",
          sampleRate: audioContext.sampleRate
        }));
      }

      workletNode.port.onmessage = (e: MessageEvent) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // FIX #14: Send raw binary directly over the WebSocket
          wsRef.current.send(e.data);
        }
      };

      isRecordingRef.current = true;
      setIsRecording(true);
      setSpeakingState("LISTENING"); // <-- Set state when recording starts
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert(`Microphone Error: ${err}\nPlease check your browser permissions.`);
      setSpeakingState("INACTIVE");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    
    // FIX #2: Send a definitive turn_complete signal to the backend so it can
    // relay it to the Gemini Live API. Without this, Gemini never receives an
    // explicit end-of-turn cutoff and keeps generating / speaking.
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "turn_complete" }));
    }

    // FIX #2 (audio): Forcefully stop all playing/scheduled audio chunks.
    stopAllAudio();
    
    // Restart wake word listener when Vertex AI session ends
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        // State will be set to LISTENING by the useEffect watching isRecording
      } catch (e) {}
    }
  }, []);

  // Wake Word Listener using Web Speech API [Logic remains similar, updated state handling]
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    
    recognition.onresult = (event: any) => {
      // ... (transcript handling)
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      
      const isFinal = event.results[event.results.length - 1].isFinal;
      const lower = transcript.toLowerCase();
      
      // --- GOVERNANCE COMMANDS ---
      // Intercept these immediately, bypassing Gemini as requested
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        let govCmd = null;
        if (lower.includes("stop speaking")) govCmd = "stop_speaking";
        else if (lower.includes("pause all tasks")) govCmd = "pause";
        else if (lower.includes("resume all tasks")) govCmd = "resume";
        else if (lower.includes("stop all tasks")) govCmd = "stop";

        if (govCmd) {
          if (govCmd === "stop_speaking") {
             // Stop audio immediately by killing active sources
             stopAllAudio(); 
          }
          
          // Send command to backend to execute runtime action and mute Gemini
          wsRef.current.send(JSON.stringify({ type: "governance", command: govCmd }));
          
          // Prevent further processing of this interim transcript
          return;
        }
      }
      
      if (isRecordingRef.current) {
        if (isFinal && transcript.trim()) {
          addLog(`USER: ${transcript.trim()}`);
        }
        return;
      }
      
      if (isActivatingRef.current) return;
      // ... (wake word detection logic)
      if (
        lower.includes("sentinel") || 
        lower.includes("sentinal") ||
        lower.includes("daddy's home") ||
        lower.includes("daddies home") ||
        lower.includes("daddy is home")
      ) {
        console.log("WAKE WORD DETECTED!");
        isActivatingRef.current = true;
        recognition.stop();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "wake_word" }));
        }
        setTimeout(() => {
          startRecording();
          isActivatingRef.current = false;
        }, 1200);
      }
    };

    recognition.onend = () => {
      if (!isActivatingRef.current && !isRecordingRef.current) {
          try {
            recognition.start();
            setSpeakingState("LISTENING");
          } catch (e) {}
      }
    };

    try {
      recognition.start();
      setSpeakingState("LISTENING"); // Initial state
    } catch (e) {}

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      setSpeakingState("INACTIVE");
    };
  }, [startRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return { isConnected, isRecording, toggleRecording, logs, sendCommand, speakingState };
}