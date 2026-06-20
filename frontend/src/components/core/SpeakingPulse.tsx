import { COLORS } from "../constants/colors";

export default function SpeakingPulse() {
    return (
        <>
            <style>
                {`
          @keyframes speakingPulse {
            0% {
              transform: scale(1);
              opacity: 0.3;
            }

            50% {
              transform: scale(1.25);
              opacity: 1;
            }

            100% {
              transform: scale(1);
              opacity: 0.3;
            }
          }

          @keyframes speakingRing {
            0% {
              transform: scale(0.8);
              opacity: 1;
            }

            100% {
              transform: scale(1.6);
              opacity: 0;
            }
          }
        `}
            </style>

            {/* Core Pulse */}
            <div
                className="absolute rounded-full"
                style={{
                    width: "160px",
                    height: "160px",

                    border: `2px solid ${COLORS.cyanBright}`,

                    animation:
                        "speakingPulse 0.8s ease-in-out infinite",

                    boxShadow: `
            0 0 25px rgba(0,229,255,0.4),
            inset 0 0 25px rgba(0,229,255,0.15)
          `,
                }}
            />

            {/* Expanding Ring */}
            <div
                className="absolute rounded-full"
                style={{
                    width: "160px",
                    height: "160px",

                    border: `2px solid ${COLORS.cyanBright}`,

                    animation:
                        "speakingRing 1.5s linear infinite",

                    boxShadow:
                        "0 0 12px rgba(0,229,255,0.3)",
                }}
            />
        </>
    );
}