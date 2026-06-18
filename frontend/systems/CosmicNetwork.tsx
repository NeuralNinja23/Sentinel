/// <reference types="@react-three/fiber" />
import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const CosmicNetwork = ({ count = 150, radius = 20, connectionDistance = 5 }) => {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Distribute points in a sphere
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      pos[i3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i3 + 2] = radius * Math.cos(phi);
    }
    return pos;
  }, [count, radius]);

  // Create lines based on distance (pairs of indices)
  const indices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const xi = positions[i3];
      const yi = positions[i3 + 1];
      const zi = positions[i3 + 2];
      for (let j = i + 1; j < count; j++) {
        const j3 = j * 3;
        const xj = positions[j3];
        const yj = positions[j3 + 1];
        const zj = positions[j3 + 2];
        const dx = xi - xj;
        const dy = yi - yj;
        const dz = zi - zj;
        
        // FIX #38: Optimize distance calculation to avoid slow Math.sqrt
        const distSq = dx * dx + dy * dy + dz * dz;
        const connectSq = connectionDistance * connectionDistance;
        
        if (distSq < connectSq) {
          indices.push(i, j);
        }
      }
    }
    return indices;
  }, [count, positions, connectionDistance]);

  // LineSegments geometry
  const linesGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(indices.length * 3);
    for (let i = 0; i < indices.length; i += 2) {
      const idx1 = indices[i];
      const idx2 = indices[i + 1];
      const i3 = idx1 * 3;
      const j3 = idx2 * 3;
      const k = (i / 2) * 6;
      linePositions[k] = positions[i3];
      linePositions[k + 1] = positions[i3 + 1];
      linePositions[k + 2] = positions[i3 + 2];
      linePositions[k + 3] = positions[j3];
      linePositions[k + 4] = positions[j3 + 1];
      linePositions[k + 5] = positions[j3 + 2];
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    return geometry;
  }, [indices, positions]);

  // Points geometry
  const pointsGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [positions]);

  // Animate points slightly
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const positionAttribute = pointsGeometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const offset = 0.005 * Math.sin(time + i * 0.1);
      positionAttribute.setX(i3, positions[i3] + offset * Math.cos(time + i * 0.2));
      positionAttribute.setY(i3, positions[i3 + 1] + offset * Math.sin(time + i * 0.3));
      positionAttribute.setZ(i3, positions[i3 + 2] + offset * Math.cos(time + i * 0.4));
    }
    positionAttribute.needsUpdate = true;
  });

  return (
    <group>
      {/* Points */}
      <points geometry={pointsGeometry}>
        {/* FIX #39: Use R3F declarative materials to auto-dispose and prevent WebGL Context Leaks */}
        <pointsMaterial color="#00e5ff" size={0.1} transparent opacity={0.8} />
      </points>
      
      {/* Lines */}
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial color="#0066ff" transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
};

export default CosmicNetwork;