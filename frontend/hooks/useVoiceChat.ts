import { useState, useRef, useCallback, useEffect } from "react";

export function useVoiceChat() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<string[]>(["SENTINEL Online"]);
  
  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, msg].slice(-50)); // Keep last 50 logs
  }, []);

  const sendCommand = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "command", text }));
      addLog(`USER COMMAND: ${text}`);
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

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Playback state
  const nextPlayTimeRef = useRef<number>(0);

  const playAudioChunk = useCallback((arrayBuffer: ArrayBuffer) => {
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

    // Schedule playback seamlessly to avoid radio static / clicking
    if (nextPlayTimeRef.current < audioContext.currentTime) {
      nextPlayTimeRef.current = audioContext.currentTime + 0.05;
    }
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
  }, []);

  useEffect(() => {
    // We only initialize AudioContext on startRecording to comply with browser autoplay policies
    const ws = new WebSocket("ws://localhost:8000/ws/voice");
    // FIX #14: Receive binary frames as ArrayBuffer directly
    ws.binaryType = "arraybuffer";
    
    ws.onopen = () => {
      console.log("Connected to Sentinel Backend");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      // FIX #14: Audio frames arrive as raw binary
      if (event.data instanceof ArrayBuffer) {
        playAudioChunk(event.data);
        return;
      }
      
      const msg = JSON.parse(event.data);
      if (msg.type === "system") {
        console.log("System:", msg.message);
      } else if (msg.type === "text") {
        console.log("Sentinel:", msg.data);
        addLog(`SENTINEL: ${msg.data}`);
      } else if (msg.type === "user") {
        addLog(`USER: ${msg.data}`);
      } else if (msg.type === "interrupt") {
        console.log("Sentinel playback interrupted by user barge-in.");
        addLog("SYS: Playback interrupted.");
        // FIX #12: Reuse existing AudioContext instead of close() + new AudioContext().
        // Browsers hard-limit AudioContexts to 6 per page — creating new ones on every
        // interrupt caused a crash after 6 barge-ins.
        // Instead: just reset the playback clock so queued audio is dropped immediately.
        nextPlayTimeRef.current = 0;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [playAudioChunk]);

  // Removed int16ToBase64 and floatTo16BitPCM as they are moved to AudioWorklet


  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      mediaStreamRef.current = stream;
      
      if (!recordingContextRef.current) {
        recordingContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
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
      const source = audioContext.createMediaStreamSource(stream);

      // FIX #13: Use AudioWorklet instead of deprecated createScriptProcessor
      // to avoid blocking the main UI thread with audio processing.
      const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.buffer = new Int16Array(2048);
          this.offset = 0;
        }
        process(inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            const float32Array = input[0];
            for (let i = 0; i < float32Array.length; i++) {
              const s = Math.max(-1, Math.min(1, float32Array[i]));
              this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              if (this.offset >= this.buffer.length) {
                this.port.postMessage(this.buffer.buffer.slice(0));
                this.offset = 0;
              }
            }
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
      `;
      
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      try {
        await audioContext.audioWorklet.addModule(workletUrl);
      } catch(e) {
        // Module might already be added
      }
      
      const workletNode = new (window as any).AudioWorkletNode(audioContext, 'pcm-processor');
      processorRef.current = workletNode as any;

      workletNode.port.onmessage = (e: MessageEvent) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // FIX #14: Send raw binary directly over the WebSocket
          wsRef.current.send(e.data);
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
      
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
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

    // FIX #2 (audio): Reset playback clock so any buffered audio stops immediately.
    nextPlayTimeRef.current = 0;
    
    // Restart wake word listener when Vertex AI session ends
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  }, []);

  // Wake Word Listener using Web Speech API
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
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }

      const isFinal = event.results[event.results.length - 1].isFinal;

      if (isRecordingRef.current) {
        if (isFinal && transcript.trim()) {
          addLog(`USER: ${transcript.trim()}`);
        }
        return;
      }

      if (isActivatingRef.current) return;

      const lower = transcript.toLowerCase();
      // Broad matching to catch misspellings and alternate phrases
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
        
        // Delay opening the mic so Vertex AI has an empty audio channel.
        // This forces it to generate the greeting instantly instead of waiting 
        // for you to finish speaking into the newly opened mic!
        setTimeout(() => {
          startRecording();
          isActivatingRef.current = false;
        }, 1200);
      }
    };

    recognition.onend = () => {
      try {
        recognition.start();
      } catch (e) {}
    };

    try {
      recognition.start();
    } catch (e) {}

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [startRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return { isConnected, isRecording, toggleRecording, logs, sendCommand };
}
