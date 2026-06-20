import { useState, useEffect, useCallback } from "react";
import { voiceStore, VoiceState } from "../store/voice.store";
import { voiceService } from "../services/voice.service";

export function useVoice() {
  const [state, setState] = useState<VoiceState>(voiceStore.getState());

  useEffect(() => {
    // Initialize VoiceService on mount
    voiceService.init();

    // Subscribe to store updates
    const unsubscribe = voiceStore.subscribe((newState: VoiceState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
      voiceService.cleanup();
    };
  }, []);

  const toggleRecording = useCallback(() => {
    voiceService.toggleRecording();
  }, []);

  const sendCommand = useCallback((text: string) => {
    voiceService.sendCommand(text);
  }, []);

  return {
    isConnected: state.isConnected,
    isRecording: state.isRecording,
    toggleRecording,
    logs: state.logs,
    sendCommand,
    speakingState: state.speakingState,
  };
}
