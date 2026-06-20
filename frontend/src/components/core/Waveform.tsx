import { COLORS } from "../constants/colors";

// Pattern of heights to create that varied, detailed look
const pattern = [
    2, 4, 12, 24, 6, 2, 8, 16, 4, 2,
    20, 8, 2, 4, 28, 12, 4, 2, 16, 32,
    10, 4, 2, 6, 18, 8, 2, 4, 22, 14,
    6, 2, 8, 26, 12, 4, 2, 10, 20, 6
];
const bars = Array.from({ length: 40 });

export default function Waveform() {
    return (
        <div className="relative w-full h-12 flex items-center justify-center overflow-hidden">
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex justify-between items-center px-2">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={`grid-${i}`} className="w-px h-full bg-cyan-900/40" />
                ))}
            </div>

            {/* Center Horizontal Line */}
            <div className="absolute left-0 right-0 h-px bg-cyan-900/60 top-1/2 -translate-y-1/2" />

            <style>
                {`
          @keyframes waveformPulseCenter {
            0%, 100% { transform: scaleY(0.2); }
            50% { transform: scaleY(1); }
          }
        `}
            </style>

            <div className="relative flex items-center justify-center gap-[4px] h-full w-full z-5">
                {bars.map((_, index) => {
                    const baseHeight = pattern[index % pattern.length];
                    return (
                        <div
                            key={index}
                            className="w-[2px] rounded-sm"
                            style={{
                                height: `${Math.max(2, baseHeight)}px`,
                                background: COLORS.cyanBright,
                                boxShadow: `0 0 6px ${COLORS.cyanBright}40`,
                                animation: "waveformPulseCenter 2s ease-in-out infinite",
                                animationDelay: `${index * 0.08}s`,
                                transformOrigin: "center",
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}