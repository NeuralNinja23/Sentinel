"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

// Reusable Ring Component for building the HUD
function HudRing({ 
  radius, 
  thickness, 
  color, 
  opacity, 
  speed, 
  direction, 
  type, 
  dashSize, 
  gapSize, 
  segments = 128 
}: any) {
  const ringRef = useRef<THREE.Group>(null);
  
  // FIX #21: Track created Three.js objects to dispose them and prevent WebGL memory leaks
  const cleanupRef = useRef<any[]>([]);
  
  const geometryObj = useMemo(() => {
    cleanupRef.current.forEach(obj => obj?.dispose?.());
    cleanupRef.current = [];

    if (type === "tick") {
      // Generate individual hash marks around the perimeter
      const points = [];
      const tickCount = segments; // Number of ticks
      for (let i = 0; i < tickCount; i++) {
        const theta = (i / tickCount) * Math.PI * 2;
        const innerR = radius - thickness/2;
        const outerR = radius + thickness/2;
        points.push(
          new THREE.Vector3(Math.cos(theta) * innerR, Math.sin(theta) * innerR, 0),
          new THREE.Vector3(Math.cos(theta) * outerR, Math.sin(theta) * outerR, 0)
        );
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      cleanupRef.current.push(geo, mat);
      return <lineSegments geometry={geo} material={mat} />;
    } else if (type === "dashed") {
      // Standard dashed line
      const points = [];
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineDashedMaterial({ color, dashSize, gapSize, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      cleanupRef.current.push(geo, mat);
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      return <primitive object={line} />;
    } else if (type === "solid-thick") {
      // Using RingGeometry for thick solid rings (Lines are max 1px wide in WebGL)
      return (
        <mesh>
          <ringGeometry args={[radius - thickness/2, radius + thickness/2, segments]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      );
    } else {
      // Thin solid line
      const points = [];
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      cleanupRef.current.push(geo, mat);
      const lineObj = new THREE.Line(geo, mat);
      return <primitive object={lineObj} />;
    }
  }, [radius, thickness, color, opacity, type, dashSize, gapSize, segments]);

  useEffect(() => {
    return () => {
      cleanupRef.current.forEach(obj => obj?.dispose?.());
    };
  }, []);

  useFrame((state) => {
    if (ringRef.current) {
      // Apply independent rotation based on speed and direction
      ringRef.current.rotation.z += speed * direction;
    }
  });

  return (
    <group ref={ringRef}>
      {geometryObj}
    </group>
  );
}

export default function SentinelCore() {
  const COLOR = "#00E5FF"; // Bright Cyan / Teal
  
  // Fade in the text slightly after mount to hide the Drei font-loading layout jump
  const [textOpacity, setTextOpacity] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setTextOpacity(0.9), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <group rotation={[0, 0, 0]}>
      {/* Central Holographic Text */}
      <Text
        position={[0, 0, 0]}
        fontSize={1.2}
        color={COLOR}
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false} // Prevent tone mapping to allow pure bloom glow
        material-transparent={true}
        material-opacity={textOpacity}
        letterSpacing={0.2}
      >
        S.E.N.T.I.N.E.L
      </Text>

      {/* Ring 1: Inner Solid Thick Ring */}
      <HudRing radius={3.8} thickness={0.15} color={COLOR} opacity={0.6} speed={0.005} direction={1} type="solid-thick" />
      
      {/* Ring 2: Very close thin dashed ring rotating opposite direction */}
      <HudRing radius={4.1} thickness={0} color={COLOR} opacity={0.8} speed={0.015} direction={-1} type="dashed" dashSize={0.1} gapSize={0.1} />

      {/* Ring 3: Density Tick Marks */}
      <HudRing radius={5.2} thickness={0.4} color={COLOR} opacity={0.5} speed={0.002} direction={1} type="tick" segments={120} />

      {/* Inner and Outer constraints for tick marks */}
      <HudRing radius={4.9} thickness={0} color={COLOR} opacity={0.3} speed={0} direction={0} type="solid" />
      <HudRing radius={5.5} thickness={0} color={COLOR} opacity={0.3} speed={0} direction={0} type="solid" />

      {/* Ring 4: Thick Block Dashes (Simulated with ticks) */}
      <HudRing radius={6.5} thickness={0.3} color={COLOR} opacity={0.6} speed={0.008} direction={-1} type="tick" segments={40} />

      {/* Ring 5: Large Thin Solid Ring */}
      <HudRing radius={7.5} thickness={0} color={COLOR} opacity={0.4} speed={0.004} direction={1} type="solid" />

      {/* Ring 6: Outer Large Dashed Ring */}
      <HudRing radius={8.2} thickness={0} color={COLOR} opacity={0.3} speed={0.01} direction={1} type="dashed" dashSize={0.6} gapSize={0.3} />

    </group>
  );
}
