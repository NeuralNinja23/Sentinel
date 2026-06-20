import { pcm16ToFloat32 } from "./audio";

class AudioService {
  private recordingContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private nextPlayTime = 0;
  private workletNode: any = null;

  playAudioChunk(arrayBuffer: ArrayBuffer, onStart: () => void, onEnded: () => void) {
    onStart();

    if (!this.playbackContext) {
      this.playbackContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const audioContext = this.playbackContext;

    const float32Array = pcm16ToFloat32(arrayBuffer);

    const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    this.activeSources.add(source);

    if (this.nextPlayTime < audioContext.currentTime) {
      this.nextPlayTime = audioContext.currentTime + 0.05;
    }
    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        onEnded();
      }
    };
  }

  stopAllAudio() {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeSources.clear();
    this.nextPlayTime = 0;
  }

  async startRecording(onAudioChunk: (data: ArrayBuffer) => void, onSampleRateReady: (rate: number) => void) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.mediaStream = stream;

      if (!this.recordingContext) {
        this.recordingContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } else if (this.recordingContext.state === "suspended") {
        await this.recordingContext.resume();
      }

      if (!this.playbackContext) {
        this.playbackContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (this.playbackContext.state === "suspended") {
        await this.playbackContext.resume();
      }

      const audioContext = this.recordingContext;
      console.log(`[Sentinel Audio] AudioContext actual sampleRate: ${audioContext.sampleRate}Hz — worklet will resample to 16000Hz`);
      const source = audioContext.createMediaStreamSource(stream);

      try {
        await audioContext.audioWorklet.addModule(`/pcm-processor.js?v=${Date.now()}`);
      } catch (e) {
        console.warn("AudioWorklet module already added or failed:", e);
      }

      this.workletNode = new (window as any).AudioWorkletNode(audioContext, "pcm-processor");

      source.connect(this.workletNode);
      this.workletNode.connect(audioContext.destination);

      onSampleRateReady(audioContext.sampleRate);

      this.workletNode.port.onmessage = (e: MessageEvent) => {
        onAudioChunk(e.data);
      };
    } catch (err) {
      console.warn("Error accessing microphone:", err);
      alert(`Microphone Error: ${err}\nPlease check your browser permissions.`);
      throw err;
    }
  }

  stopRecording() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.stopAllAudio();
  }

  cleanupHardware() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => {
        t.stop();
        console.log("Hardware track stopped on unload");
      });
      this.mediaStream = null;
    }
    this.stopAllAudio();
  }
}

export const audioService = new AudioService();
