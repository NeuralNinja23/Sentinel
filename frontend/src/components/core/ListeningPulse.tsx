import { COLORS } from "../constants/colors";

export default function ListeningPulse() {
    return (
        <>
            <style>
                {`
          @keyframes listeningPulse {
            0% {
              transform: scale(1);
              opacity: 0.3;
            }

            50% {
              transform: scale(1.15);
              opacity: 1;
            }

            100% {
              transform: scale(1);
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
                    width: "140px",
                    height: "140px",

                    border: `2px solid ${COLORS.green}`,

                    animation:
                        "listeningPulse 1.2s ease-in-out infinite",

                    boxShadow: `
            0 0 20px rgba(0,255,136,0.3),
            inset 0 0 20px rgba(0,255,136,0.15)
          `,
                }}
            />
        </>
    );
}