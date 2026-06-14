"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import UIOverlay from "@/components/UIOverlay";
import { Leva } from "leva";

// Dynamically import the 3D scene to avoid SSR issues with Three.js
const Scene = dynamic(() => import("@/core/Scene"), { ssr: false });

export default function Home() {
  return (
    <main className="relative w-full h-full bg-black overflow-hidden">
      {/* 3D WebGL Background / Core */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="flex items-center justify-center w-full h-full text-primary font-orbitron text-2xl animate-pulse">INITIALIZING CORE...</div>}>
          <Scene />
        </Suspense>
      </div>

      {/* 2D UI Overlay */}
      <div className="absolute inset-0 z-10">
        <UIOverlay />
      </div>

      {/* Developer Controls (hidden in prod) */}
      <div className="absolute top-0 right-0 z-50">
        <Leva collapsed />
      </div>
    </main>
  );
}
