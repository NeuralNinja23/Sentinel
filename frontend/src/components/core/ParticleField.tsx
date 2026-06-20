import { useEffect, useState } from "react";
import { COLORS } from "../constants/colors";

interface Particle {
    id: number;
    size: number;
    top: number;
    left: number;
    delay: number;
    duration: number;
}

export default function ParticleField() {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        setParticles(
            Array.from({ length: 32 }).map((_, index) => ({
                id: index,
                size: Math.random() * 4 + 2,
                top: Math.random() * 100,
                left: Math.random() * 100,
                delay: Math.random() * 6,
                duration: 4 + Math.random() * 6,
            }))
        );
    }, []);

    if (particles.length === 0) return null;

    return (
        <>
            <style>
                {`
          @keyframes particleFloat {
            0% {
              transform: translateY(0px);
              opacity: 0.2;
            }

            50% {
              transform: translateY(-12px);
              opacity: 1;
            }

            100% {
              transform: translateY(0px);
              opacity: 0.2;
            }
          }
        `}
            </style>

            <div className="absolute inset-0 pointer-events-none overflow-hidden">

                {particles.map((particle) => (
                    <div
                        key={particle.id}
                        className="absolute rounded-full"
                        style={{
                            width: particle.size,
                            height: particle.size,

                            top: `${particle.top}%`,
                            left: `${particle.left}%`,

                            background: COLORS.cyanBright,

                            boxShadow: `
                0 0 8px ${COLORS.cyanBright},
                0 0 16px ${COLORS.cyanBright}
              `,

                            animation: `
                particleFloat
                ${particle.duration}s
                ease-in-out
                infinite
              `,

                            animationDelay: `${particle.delay}s`,
                        }}
                    />
                ))}

            </div>
        </>
    );
}