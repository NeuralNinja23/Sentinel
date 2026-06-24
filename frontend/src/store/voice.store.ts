export type SpeakingState = "INACTIVE" | "LISTENING" | "THINKING" | "SPEAKING" | "STANDBY" | "WAKING";

export interface VoiceState {
  isConnected: boolean;
  isRecording: boolean;
  speakingState: SpeakingState;
  logs: string[];
}

type Subscriber = (state: VoiceState) => void;

class VoiceStore {
  private state: VoiceState = {
    isConnected: false,
    isRecording: false,
    speakingState: "INACTIVE",
    logs: [],
  };
  private subscribers = new Set<Subscriber>();

  constructor() {
    // Initialize logs empty to prevent server-client hydration mismatch
    this.state.logs = [];
  }

  getState() {
    return this.state;
  }

  setState(updates: Partial<VoiceState>) {
    this.state = { ...this.state, ...updates };
    this.subscribers.forEach((sub) => sub(this.state));
  }

  addLog(msg: string) {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newLogs = [...this.state.logs, `[${timeStr}] ${msg}`].slice(-50);
    this.setState({ logs: newLogs });
  }

  subscribe(sub: Subscriber) {
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }
}

export const voiceStore = new VoiceStore();
