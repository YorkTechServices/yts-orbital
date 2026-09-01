"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const LAND_POINTS = [
  [48, -105], [39, -98], [30, -90], [19, -99], [5, -74], [-15, -60], [-33, -58],
  [52, -3], [48, 12], [41, 29], [30, 31], [8, 8], [-2, 22], [-27, 28],
  [55, 55], [35, 72], [22, 78], [35, 105], [31, 121], [36, 139], [13, 101],
  [-6, 107], [-25, 134], [-37, 145],
] as const;

function pointFromLatLon(latitude: number, longitude: number, radius: number) {
  const latitudeRad = THREE.MathUtils.degToRad(latitude);
  const longitudeRad = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    radius * Math.cos(latitudeRad) * Math.sin(longitudeRad),
    radius * Math.sin(latitudeRad),
    radius * Math.cos(latitudeRad) * Math.cos(longitudeRad),
  );
}

function GlobeMesh({ reduceMotion }: { reduceMotion: boolean }) {
  const globe = useRef<THREE.Group>(null);
  const landPoints = useMemo(
    () => LAND_POINTS.map(([latitude, longitude]) => pointFromLatLon(latitude, longitude, 1.025)),
    [],
  );

  useFrame((_, delta) => {
    if (globe.current && !reduceMotion) globe.current.rotation.y += delta * 0.48;
  });

  return (
    <group ref={globe} rotation={[0.12, -0.45, -0.14]}>
      <mesh>
        <sphereGeometry args={[1, 28, 18]} />
        <meshStandardMaterial color="#06181d" emissive="#073037" emissiveIntensity={0.75} roughness={0.62} metalness={0.12} />
      </mesh>
      <mesh scale={1.008}>
        <sphereGeometry args={[1, 18, 12]} />
        <meshBasicMaterial color="#67eee7" wireframe transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {landPoints.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.065, 5, 5]} />
          <meshBasicMaterial color="#b7fff5" />
        </mesh>
      ))}
    </group>
  );
}

export default function BrandGlobe({ loading = false }: { loading?: boolean }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  return (
    <span className={`brand-globe${loading ? " brand-globe--loading" : ""}`} aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 3.15], fov: 40 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[2.5, 2, 3]} color="#9cfff7" intensity={2.2} />
        <pointLight position={[-2, -1, 2]} color="#1baeb4" intensity={1.3} />
        <GlobeMesh reduceMotion={reduceMotion} />
      </Canvas>
    </span>
  );
}