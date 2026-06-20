import { COLORS } from "../constants/colors";

export default function DashboardBackdrop() {
    return (
        <>
            {/* Main Center Glow */}
            <div
                className="
          fixed
          inset-0
          pointer-events-none
          overflow-hidden
        "
            >
                <div
                    className="
            absolute
            left-1/2
            top-1/2
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
          "
                    style={{
                        width: "1400px",
                        height: "1400px",

                        background: `
              radial-gradient(
                circle,
                rgba(0,229,255,0.03) 0%,
                rgba(0,229,255,0.01) 25%,
                transparent 60%
              )
            `,
                    }}
                />

                {/* Reactor Glow */}
                <div
                    className="
            absolute
            left-1/2
            top-1/2
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
          "
                    style={{
                        width: "700px",
                        height: "700px",

                        background: `
              radial-gradient(
                circle,
                rgba(0,229,255,0.04) 0%,
                rgba(0,229,255,0.01) 35%,
                transparent 70%
              )
            `,
                    }}
                />

                {/* Top Accent Glow */}
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2"
                    style={{
                        width: "900px",
                        height: "250px",

                        background: `
              radial-gradient(
                ellipse,
                rgba(0,229,255,0.02),
                transparent 70%
              )
            `,
                    }}
                />

                {/* Bottom Vignette */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: `
              radial-gradient(
                circle at center,
                transparent 30%,
                rgba(0,0,0,0.65) 100%
              )
            `,
                    }}
                />
            </div>
        </>
    );
}