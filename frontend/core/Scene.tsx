"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import SentinelCore from "./SentinelCore";

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 24], fov: 60 }} 
      gl={{ antialias: true, powerPreference: "high-performance" }} // Enabled AA for clean straight lines
    >
      <color attach="background" args={["#000000"]} />

      <ambientLight intensity={0.5} />

      <SentinelCore />

      <EffectComposer>
        <Bloom 
          intensity={1.5} // Lower bloom for a cleaner, crisp aesthetic
          luminanceThreshold={0.2} 
          luminanceSmoothing={0.9} 
          mipmapBlur 
        />
        <Vignette 
          eskil={false} 
          offset={0.1} 
          darkness={0.7} 
          blendFunction={BlendFunction.NORMAL} 
        />
      </EffectComposer>
    </Canvas>
  );
}
