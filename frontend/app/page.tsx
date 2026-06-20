"use client";

import DashboardBackdrop from "../src/components/core/DashboardBackdrop";
import BackgroundGrid from "../src/components/core/BackgroundGrid";
import NoiseOverlay from "../src/components/core/NoiseOverlay";


import CentralCore from "../src/components/core/CentralCore";

import StatusPanel from "../src/components/panels/StatusPanel";
import EventStream from "../src/components/panels/EventStream";



import CommandInput from "../src/components/panels/CommandInput";
import { useVoice as useVoiceChat } from "../src/hooks/useVoice";
import { COLORS } from "../src/components/constants/colors";

export default function Dashboard() {
    const { isConnected, isRecording, toggleRecording, logs, sendCommand, speakingState } = useVoiceChat();
    return (
        <div
            className="
        relative
        h-screen
        overflow-hidden
      "
            style={{
                background: COLORS.background,
            }}
        >
            {/* Background Layers */}

            <DashboardBackdrop />

            <BackgroundGrid />

            <NoiseOverlay />

            {/* Main Content */}

            <div className="relative z-10 h-full flex flex-col">


                {/* Main Dashboard */}

                <div
                    className="
            flex-1
            px-6
            py-6
            overflow-hidden
          "
                >
                    <div
                        className="
              grid
              h-full
              gap-4
            "
                        style={{
                            gridTemplateColumns:
                                "480px 1fr 340px",

                            gridTemplateRows:
                                "1fr",
                        }}
                    >
                        {/* LEFT COLUMN */}
                        <div className="col-start-1 row-start-1">
                            <StatusPanel />
                        </div>

                        {/* CENTER CORE */}
                        <div className="col-start-2 row-start-1">
                            <CentralCore state={speakingState === "INACTIVE" ? "IDLE" : speakingState} />
                        </div>

                        {/* RIGHT COLUMN (EventStream + CommandInput) */}
                        <div className="col-start-3 row-start-1 flex flex-col gap-6 h-full">
                            {/* Make EventStream stretch to fill space */}
                            <div className="flex h-130">
                                <EventStream logs={logs} />
                            </div>

                            <div>
                                <CommandInput
                                    isRecording={isRecording}
                                    onToggleRecording={toggleRecording}
                                    onSendCommand={sendCommand}
                                />
                            </div>
                        </div>
                    </div>
                </div>


            </div>

            {/* Decorative logo in bottom left */}
            <div className="absolute bottom-4 left-6 z-50 flex items-center justify-center w-6 h-6 rounded-full border border-cyan-500/30 bg-black/50 text-[10px] font-bold text-cyan-400 select-none">
                N
            </div>
        </div>
    );
}
