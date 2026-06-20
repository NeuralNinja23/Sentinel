import { voiceStore } from "../store/voice.store";
import { websocketService } from "./websocket.service";
import { audioService } from "./audio.service";
import { speechService } from "./speech.service";

class VoiceService {
  private isRecordingRef = { current: false };

  init() {
    if (typeof window === "undefined") return;

    // Connect WebSocket
    websocketService.connect(
      () => {
        voiceStore.setState({ isConnected: true, speakingState: "INACTIVE" });
      },
      (event) => {
        // ws message handler
        if (event.data instanceof ArrayBuffer) {
          if (!this.isRecordingRef.current) return;
          audioService.playAudioChunk(
            event.data,
            () => voiceStore.setState({ speakingState: "SPEAKING" }),
            () => voiceStore.setState({ speakingState: this.isRecordingRef.current ? "LISTENING" : "INACTIVE" })
          );
          return;
        }

        const msg = JSON.parse(event.data);
        if (msg.type === "pong") return;

        if (msg.type === "system") {
          voiceStore.addLog(`SYS: ${msg.message}`);
        } else if (msg.type === "text") {
          voiceStore.addLog(`SENTINEL: ${msg.data}`);
          voiceStore.setState({ speakingState: "THINKING" });
        } else if (msg.type === "user") {
          voiceStore.addLog(`USER: ${msg.data}`);
        } else if (msg.type === "interrupt") {
          voiceStore.addLog("SYS: Playback interrupted.");
          audioService.stopAllAudio();
          voiceStore.setState({ speakingState: "SPEAKING" });
        }
      },
      () => {
        // ws close handler
        voiceStore.setState({ isConnected: false, speakingState: "INACTIVE" });
        if (this.isRecordingRef.current) {
          this.stopRecording();
        }
      },
      (err) => {
        console.warn("WebSocket error:", err);
      }
    );

    // Start Web Speech API Recognition
    speechService.start(
      () => {
        // On Wake Word
        websocketService.send(JSON.stringify({ type: "wake_word" }));
        setTimeout(() => {
          this.startRecording();
        }, 1200);
      },
      (govCmd) => {
        // On Governance Command
        if (govCmd === "stop_speaking") {
          audioService.stopAllAudio();
        }
        websocketService.send(JSON.stringify({ type: "governance", command: govCmd }));
      },
      (userSpeech) => {
        // On User Speech
        voiceStore.addLog(`USER: ${userSpeech}`);
      },
      this.isRecordingRef,
      () => {
        // Trigger listening state
        voiceStore.setState({ speakingState: "INACTIVE" });
      }
    );

    // Add window listener for refresh cleanup
    window.addEventListener("beforeunload", this.cleanup);
  }

  sendCommand(text: string) {
    if (websocketService.isOpen()) {
      websocketService.send(JSON.stringify({ type: "command", text }));
      voiceStore.addLog(`USER COMMAND: ${text}`);
      voiceStore.setState({ speakingState: "THINKING" });
    }
  }

  async startRecording() {
    try {
      this.isRecordingRef.current = true;
      voiceStore.setState({ isRecording: true, speakingState: "LISTENING" });

      await audioService.startRecording(
        (pcmData) => {
          // Send raw mic PCM stream over WebSocket
          websocketService.send(pcmData);
        },
        (sampleRate) => {
          // Send rate config to backend
          websocketService.send(JSON.stringify({
            type: "config",
            sampleRate
          }));
        }
      );
    } catch (e) {
      this.isRecordingRef.current = false;
      voiceStore.setState({ isRecording: false, speakingState: "INACTIVE" });
    }
  }

  stopRecording() {
    this.isRecordingRef.current = false;
    voiceStore.setState({ isRecording: false, speakingState: "INACTIVE" });
    audioService.stopRecording();

    // Send definitive end-of-turn
    websocketService.send(JSON.stringify({ type: "turn_complete" }));

    // Re-trigger speech service to start listening for wake words
    speechService.start(
      () => {
        websocketService.send(JSON.stringify({ type: "wake_word" }));
        setTimeout(() => {
          this.startRecording();
        }, 1200);
      },
      (govCmd) => {
        if (govCmd === "stop_speaking") {
          audioService.stopAllAudio();
        }
        websocketService.send(JSON.stringify({ type: "governance", command: govCmd }));
      },
      (userSpeech) => {
        voiceStore.addLog(`USER: ${userSpeech}`);
      },
      this.isRecordingRef,
      () => {
        voiceStore.setState({ speakingState: "INACTIVE" });
      }
    );
  }

  toggleRecording() {
    const { isRecording } = voiceStore.getState();
    if (isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  cleanup = () => {
    audioService.cleanupHardware();
    speechService.stop();
    websocketService.disconnect();
    window.removeEventListener("beforeunload", this.cleanup);
  };
}

export const voiceService = new VoiceService();
