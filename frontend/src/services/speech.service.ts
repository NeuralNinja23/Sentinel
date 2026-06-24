class SpeechService {
  private recognition: any = null;
  private isActivating = false;

  start(
    onWakeWord: () => void,
    onGovernanceCommand: (cmd: string) => void,
    onUserSpeech: (transcript: string) => void,
    isRecordingRef: { current: boolean },
    onListeningStateTrigger: () => void
  ) {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }

      const isFinal = event.results[event.results.length - 1].isFinal;
      const lower = transcript.toLowerCase();

      // Intercept governance commands immediately
      let govCmd: string | null = null;
      if (lower.includes("stop speaking")) govCmd = "stop_speaking";
      else if (lower.includes("pause all tasks")) govCmd = "pause";
      else if (lower.includes("resume all tasks")) govCmd = "resume";
      else if (lower.includes("stop all tasks")) govCmd = "stop";
      else if (lower.includes("standby mode") || lower.includes("standy mode") || lower.includes("enter standby")) govCmd = "enter_standby";
      else if (lower.includes("wake up") || lower.includes("exit standby") || lower.includes("wake sentinel")) govCmd = "exit_standby";

      if (govCmd) {
        onGovernanceCommand(govCmd);
        return;
      }

      if (isRecordingRef.current) {
        if (isFinal && transcript.trim()) {
          onUserSpeech(transcript.trim());
        }
        return;
      }

      if (this.isActivating) return;

      if (
        lower.includes("sentinel") ||
        lower.includes("sentinal") ||
        lower.includes("daddy's home") ||
        lower.includes("daddies home") ||
        lower.includes("daddy is home")
      ) {
        console.log("WAKE WORD DETECTED!");
        this.isActivating = true;
        rec.stop();
        onWakeWord();
        setTimeout(() => {
          this.isActivating = false;
        }, 1200);
      }
    };

    rec.onend = () => {
      if (!this.isActivating && !isRecordingRef.current) {
        try {
          rec.start();
          onListeningStateTrigger();
        } catch (e) {}
      }
    };

    try {
      rec.start();
      onListeningStateTrigger();
    } catch (e) {}

    this.recognition = rec;
  }

  stop() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
  }
}

export const speechService = new SpeechService();
