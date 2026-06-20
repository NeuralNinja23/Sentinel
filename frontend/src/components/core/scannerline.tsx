import { COLORS } from "../constants/colors";

export default function ScannerLine() {
    return (
        <>
            <style>
                {`
          @keyframes scannerSweep {
            0% {
              top: 15%;
              opacity: 0;
            }

            10% {
              opacity: 1;
            }

            90% {
              opacity: 1;
            }

            100% {
              top: 85%;
              opacity: 0;
            }
          }
        `}
            </style>

            <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                    width: "420px",
                    height: "2px",

                    background: `
            linear-gradient(
              90deg,
              transparent,
              ${COLORS.cyanBright},
              transparent
            )
          `,

                    boxShadow: `
            0 0 8px ${COLORS.cyanBright},
            0 0 16px ${COLORS.cyanBright}
          `,

                    animation:
                        "scannerSweep 4s linear infinite",
                }}
            />
        </>
    );
}