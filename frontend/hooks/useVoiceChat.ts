import { useState, useRef, useCallback, useEffect } from "react";

export function useVoiceChat() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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

  // Base64 to ArrayBuffer
  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const playAudioChunk = useCallback((base64Audio: string) => {
    // Initialize playback context if it doesn't exist. Must be 24000Hz for Gemini Live Output
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const audioContext = playbackContextRef.current;
    
    // Gemini Live returns 24kHz 16-bit Mono PCM (Little Endian).
    const arrayBuffer = base64ToArrayBuffer(base64Audio);
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
    
    ws.onopen = () => {
      console.log("Connected to Sentinel Backend");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "system") {
        console.log("System:", msg.message);
      } else if (msg.type === "audio") {
        playAudioChunk(msg.data);
      } else if (msg.type === "text") {
        console.log("Sentinel:", msg.data);
      } else if (msg.type === "interrupt") {
        console.log("Sentinel playback interrupted by user barge-in.");
        if (playbackContextRef.current) {
          playbackContextRef.current.close();
          playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          nextPlayTimeRef.current = 0;
        }
      }
    };

    ws.onclose = () => setIsConnected(false);
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [playAudioChunk]);

  // Float32 to Int16 conversion for PCM
  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  };

  // Convert Int16Array to Base64 to send via WebSocket
  const int16ToBase64 = (int16Array: Int16Array) => {
    const buffer = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return window.btoa(binary);
  };



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
      // Deprecated but universally supported way to intercept raw PCM data fast
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = floatTo16BitPCM(inputData);
        const base64Audio = int16ToBase64(pcm16);
        
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "audio",
            data: base64Audio
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    
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
      if (isRecordingRef.current || isActivatingRef.current) return;

      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }

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
      // Auto-restart listener if we are NOT currently talking to Gemini
      if (!isRecordingRef.current) {
        try {
          recognition.start();
        } catch (e) {}
      }
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

  return { isConnected, isRecording, toggleRecording };
}
