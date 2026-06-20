import { COLORS } from "../constants/colors";

export default function ExecutingPulse() {
    return (
        <>
            <style>
                {`
          @keyframes executeRotate {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @keyframes executeGlow {
            0% {
              opacity: 0.4;
            }

            50% {
              opacity: 1;
            }

            100% {
              opacity: 0.4;
            }
          }
        `}
            </style>

            {/* Ring 1 */}
            <div
                className="absolute rounded-full"
                style={{
                    width: "260px",
                    height: "260px",

                    borderTop: `3px solid ${COLORS.green}`,
                    borderRight: `3px solid transparent`,
                    borderBottom: `3px solid ${COLORS.green}`,
                    borderLeft: `3px solid transparent`,

                    animation: `
            executeRotate 1s linear infinite,
            executeGlow 1.2s ease-in-out infinite
          `,

                    boxShadow:
                        "0 0 20px rgba(0,255,136,0.35)",
                }}
            />

            {/* Ring 2 */}
            <div
                className="absolute rounded-full"
                style={{
                    width: "320px",
                    height: "320px",

                    borderTop: `2px solid transparent`,
                    borderRight: `2px solid ${COLORS.green}`,
                    borderBottom: `2px solid transparent`,
                    borderLeft: `2px solid ${COLORS.green}`,

                    animation: `
            executeRotate 2s linear infinite reverse,
            executeGlow 1.5s ease-in-out infinite
          `,
                }}
            />

            {/* Node Indicators */}
            {[0, 90, 180, 270].map((rotation) => (
                <div
                    key={rotation}
                    className="absolute"
                    style={{
                        width: "340px",
                        height: "340px",
                        transform: `rotate(${rotation}deg)`,
                    }}
                >
                    <div
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{
                            top: "-4px",
                            width: "8px",
                            height: "8px",
                            borderRadius: "9999px",

                            background: COLORS.green,

                            boxShadow: `
                0 0 10px ${COLORS.green},
                0 0 20px ${COLORS.green}
              `,
                        }}
                    />
                </div>
            ))}
        </>
    );
}