import { Volume2, Eye, List, Shield } from "lucide-react";
import { useEffect, useState } from "react";

interface SentinelOrbProps {
    state?: string;
}



export default function SentinelOrb({ state = "IDLE" }: SentinelOrbProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-[800px] h-[400px]" />;
    }

    const isStandby = state === "STANDBY";
    const isWaking = state === "WAKING";
    const isLowPower = isStandby || isWaking;

    // Theme values
    const cyanStroke = isStandby ? "#4b5563" : "#00e5ff";
    const orangeStroke = isStandby ? "#4b5563" : (isWaking ? "#00e5ff" : "#ff9e00");
    const cyanText = isStandby ? "#4b5563" : "#00e5ff";
    const subText = isStandby ? "#ef4444" : (isWaking ? "#00e5ff" : "#71ebff");

    // Animation classes
    const cwClass = isLowPower ? "" : "rotate-cw";
    const ccwClass = isLowPower ? "" : "rotate-ccw";
    const pulseClass = isLowPower ? "" : "pulse-slow";

    return (
        <div className="relative w-[800px] h-[400px] flex items-center justify-center select-none">
            <style>
                {`
                @keyframes rotateCw {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes rotateCcw {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(-360deg); }
                }
                @keyframes pulseSlow {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                @keyframes waveformPulseMini {
                    0%, 100% { transform: scaleY(0.3); }
                    50% { transform: scaleY(1); }
                }
                .rotate-cw {
                    transform-origin: 400px 200px;
                    animation: rotateCw 25s linear infinite;
                }
                .rotate-ccw {
                    transform-origin: 400px 200px;
                    animation: rotateCcw 20s linear infinite;
                }
                .pulse-slow {
                    animation: pulseSlow 3s ease-in-out infinite;
                }
                `}
            </style>

            <svg
                width="100%"
                height="100%"
                viewBox="0 0 800 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible"
            >
                {/* Defs for gradients & filters */}
                <defs>
                    <filter id="glow-orange" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* ================= BACKGROUND HUD OVERLAYS ================= */}
                {/* Angled Left Framing Boundary */}
                <path
                    d="M 180 40 L 140 40 L 110 70 L 110 330 L 140 360 L 180 360"
                    stroke={cyanStroke}
                    strokeWidth="1"
                    strokeOpacity="0.15"
                    fill="none"
                />

                {/* Angled Right Framing Boundary */}
                <path
                    d="M 620 40 L 660 40 L 690 70 L 690 330 L 660 360 L 620 360"
                    stroke={cyanStroke}
                    strokeWidth="1"
                    strokeOpacity="0.15"
                    fill="none"
                />


                {/* ================= CENTRAL ORB RING SYSTEM ================= */}
                {/* 1. Center Circle Body & Text */}
                <g>
                    <circle cx="400" cy="200" r="72" fill="#000000" fillOpacity="0.8" stroke={cyanStroke} strokeWidth="1.5" strokeOpacity="0.9" />

                    {/* Inward Ticks / Crosshairs */}
                    <line x1="400" y1="128" x2="400" y2="136" stroke={cyanStroke} strokeWidth="1.5" strokeOpacity="0.8" />
                    <line x1="400" y1="272" x2="400" y2="264" stroke={cyanStroke} strokeWidth="1.5" strokeOpacity="0.8" />
                    <line x1="328" y1="200" x2="336" y2="200" stroke={cyanStroke} strokeWidth="1.5" strokeOpacity="0.8" />
                    <line x1="472" y1="200" x2="464" y2="200" stroke={cyanStroke} strokeWidth="1.5" strokeOpacity="0.8" />

                    {/* Content text */}
                    <text x="400" y="193" textAnchor="middle" fill={cyanText} className="font-bold tracking-[0.25em] text-[18px]">SENTINEL</text>
                    <text x="400" y="211" textAnchor="middle" fill={subText} className="font-bold tracking-[0.2em] text-[10px] uppercase opacity-95">{state}</text>


                </g>

                {/* 2. Inner Dial with Fine Compass Ticks (Rotates Clockwise) */}
                <circle
                    cx="400"
                    cy="200"
                    r="82"
                    fill="none"
                    stroke={cyanStroke}
                    strokeWidth="3.5"
                    strokeOpacity="0.35"
                    strokeDasharray="1.5 2.5"
                    className={cwClass}
                />

                {/* 3. Text Path Arc with Scrolling Systems Stats */}
                <g>
                    <path id="hud-text-path-1" d="M 312 182 A 92 92 0 0 1 488 182" fill="none" />
                    <text fill={cyanText} fontSize="7.5" fontFamily="monospace" letterSpacing="2px" opacity="0.75" className="font-bold">
                        <textPath href="#hud-text-path-1" startOffset="5%">
                        {isStandby ? "// STANDBY_MODE // POWER_SAVING" : "// SYSTEM_OK // SENTINEL_ACTIVE"}
                        </textPath>
                    </text>
                </g>

                {/* 4. Concentric Ticked Ring 2 */}
                <circle
                    cx="400"
                    cy="200"
                    r="98"
                    fill="none"
                    stroke={cyanStroke}
                    strokeWidth="2"
                    strokeOpacity="0.2"
                    strokeDasharray="1 4.5"
                    className={ccwClass}
                />

                {/* 5. Concentric Double Orange/Amber Boundaries */}
                <circle cx="400" cy="200" r="106" fill="none" stroke={orangeStroke} strokeWidth="0.5" strokeOpacity="0.2" />
                <circle cx="400" cy="200" r="118" fill="none" stroke={orangeStroke} strokeWidth="0.5" strokeOpacity="0.2" />

                {/* 6. Four Glowing Orange Brackets (Angled corners visual mockup) */}
                <g className={pulseClass}>
                    {/* Top-Left Bracket */}
                    <path
                        d="M 294.8 161.7 A 112 112 0 0 1 361.7 94.8"
                        stroke={orangeStroke}
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        filter={isStandby ? "" : "url(#glow-orange)"}
                    />
                    {/* Top-Right Bracket */}
                    <path
                        d="M 438.3 94.8 A 112 112 0 0 1 505.2 161.7"
                        stroke={orangeStroke}
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        filter={isStandby ? "" : "url(#glow-orange)"}
                    />
                    {/* Bottom-Right Bracket */}
                    <path
                        d="M 505.2 238.3 A 112 112 0 0 1 438.3 305.2"
                        stroke={orangeStroke}
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        filter={isStandby ? "" : "url(#glow-orange)"}
                    />
                    {/* Bottom-Left Bracket */}
                    <path
                        d="M 361.7 305.2 A 112 112 0 0 1 294.8 238.3"
                        stroke={orangeStroke}
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        filter={isStandby ? "" : "url(#glow-orange)"}
                    />
                </g>

                {/* 7. Outer Concentric Cyan Rings */}
                {/* Thin Solid Cyan Inner boundary */}
                <circle cx="400" cy="200" r="128" fill="none" stroke={cyanStroke} strokeWidth="1" strokeOpacity="0.35" />

                {/* Segmented Thick Cyan HUD Ring (Rotates Counter-Clockwise) */}
                <circle
                    cx="400"
                    cy="200"
                    r="136"
                    fill="none"
                    stroke={cyanStroke}
                    strokeWidth="3.5"
                    strokeOpacity={isStandby ? 0.2 : 0.8}
                    strokeDasharray="90 50 140 60 70 40"
                    filter={isStandby ? "" : "url(#glow-cyan)"}
                    className={ccwClass}
                />

                {/* Outer Ticked Dial Ring */}
                <circle cx="400" cy="200" r="146" fill="none" stroke={cyanStroke} strokeWidth="1" strokeOpacity="0.4" />
                <circle
                    cx="400"
                    cy="200"
                    r="149"
                    fill="none"
                    stroke={cyanStroke}
                    strokeWidth="6"
                    strokeOpacity="0.3"
                    strokeDasharray="1.5 5.5"
                    className={cwClass}
                />

            </svg>
        </div>
    );
}

