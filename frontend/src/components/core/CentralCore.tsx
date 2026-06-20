import Panel from "../ui/Panel";
import SentinelOrb from "./SentinelOrb";
import Waveform from "./Waveform";
import CoreGrid from "./Coregrid";
import ScannerLine from "./scannerline";
import DataArcs from "./DataArcs";
import ParticleField from "./ParticleField";
import CoreMarkers from "./CoreMarkers";
import ListeningPulse from "./ListeningPulse";
import ThinkingPulse from "./ThinkingPulse";
import SpeakingPulse from "./SpeakingPulse";
import ExecutingPulse from "./ExecutingPulse";
import { COLORS } from "../constants/colors";
import { Cpu, HardDrive, Share2, Wrench, Mic, Eye, List, Shield } from "lucide-react";
import { useState, useEffect } from "react";

export type SentinelState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING" | "EXECUTING" | "PAUSED" | "ERROR";

interface CentralCoreProps {
    state?: SentinelState;
}

export default function CentralCore({ state = "IDLE" }: CentralCoreProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);



    return (
        <Panel className="relative overflow-hidden w-full h-full">
            <div className="absolute inset-0">
                <ParticleField />
            </div>

            {/* Main Central Container */}
            <div className="relative w-full h-full z-10 max-w-4xl mx-auto">

                {/* Core - Absolutely Centered */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] flex flex-col items-center justify-center w-full h-[400px] gap-8">



                    {/* Central Orb Ring System */}
                    <div className="relative flex items-center justify-center w-[800px] h-[400px] shrink-0 scale-90 md:scale-100">
                        {/* Background HUD Elements anchored exactly to orb center */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] pointer-events-none">
                            <CoreGrid />
                            <CoreMarkers />
                            <ScannerLine />
                            <DataArcs />
                        </div>

                        <SentinelOrb state={state} />

                        {/* Dynamic State Pulses */}
                        {state === "LISTENING" && <ListeningPulse />}
                        {state === "THINKING" && <ThinkingPulse />}
                        {state === "SPEAKING" && <SpeakingPulse />}
                        {state === "EXECUTING" && <ExecutingPulse />}
                    </div>

                    {/* Waveform directly under Orb */}
                    <div className="w-64 opacity-80 scale-125 mt-14">
                        <Waveform />
                    </div>

                </div>

            </div>
        </Panel>
    );
}