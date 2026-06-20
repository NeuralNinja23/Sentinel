export default function NoiseOverlay() {
    return (
        <div
            className="
        fixed
        inset-0
        pointer-events-none
        z-[1]
        opacity-[0.025]
        mix-blend-screen
      "
            style={{
                backgroundImage: `
          radial-gradient(circle at 20% 20%, white 0.5px, transparent 1px),
          radial-gradient(circle at 80% 40%, white 0.5px, transparent 1px),
          radial-gradient(circle at 40% 80%, white 0.5px, transparent 1px),
          radial-gradient(circle at 70% 70%, white 0.5px, transparent 1px)
        `,
                backgroundSize: `
          120px 120px,
          180px 180px,
          140px 140px,
          200px 200px
        `,
            }}
        />
    );
}