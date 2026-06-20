import { COLORS } from "../constants/colors";

export default function ThinkingPulse() {
    return (
        <>
            <style>
                {`
          @keyframes thinkingRotate {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @keyframes thinkingGlow {
            0% {
              opacity: 0.3;
            }

            50% {
              opacity: 1;
            }

            100% {
              opacity: 0.3;
            }
          }
        `}
            </style>

            <div
                className="
          absolute
          rounded-full
        "
                style={{
                    width: "220px",
                    height: "220px",

                    borderTop: `3px solid ${COLORS.orange}`,
                    borderRight: `3px solid transparent`,
                    borderBottom: `3px solid transparent`,
                    borderLeft: `3px solid transparent`,

                    animation: `
            thinkingRotate 1.5s linear infinite,
            thinkingGlow 2s ease-in-out infinite
          `,

                    boxShadow:
                        "0 0 20px rgba(255,138,0,0.3)",
                }}
            />

            <div
                className="
          absolute
          rounded-full
        "
                style={{
                    width: "280px",
                    height: "280px",

                    borderTop: `2px solid ${COLORS.orange}`,
                    borderRight: `2px solid transparent`,
                    borderBottom: `2px solid transparent`,
                    borderLeft: `2px solid transparent`,

                    animation: `
            thinkingRotate 3s linear infinite reverse,
            thinkingGlow 2s ease-in-out infinite
          `,
                }}
            />
        </>
    );
}