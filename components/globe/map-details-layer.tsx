"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latLonToScenePosition } from "@/lib/orbital/engine";
import type { MapLayerId, MapLayerLoadState, MapLayerStateById } from "@/lib/layers/map-layers";

interface BoundaryAsset {
  lines: number[][][];
}

const ASSET_LOADERS = {
  "country-boundaries": () => import("@/data/map-details/admin0-boundaries-110m.json"),
  "admin1-boundaries": () => import("@/data/map-details/admin1-boundaries-110m.json"),
} satisfies Record<"country-boundaries" | "admin1-boundaries", () => Promise<{ default: BoundaryAsset }>>;

interface BoundaryLayerProps {
  id: "country-boundaries" | "admin1-boundaries";
  enabled: boolean;
  maxCameraDistance: number;
  color: string;
  opacity: number;
  radius: number;
  onLoadStateChange: (id: MapLayerId, loadState: MapLayerLoadState, error?: string) => void;
}

function BoundaryLayer({
  id, enabled, maxCameraDistance, color, opacity, radius, onLoadStateChange,
}: BoundaryLayerProps) {
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const [asset, setAsset] = useState<BoundaryAsset | null>(null);
  const [inUsefulRange, setInUsefulRange] = useState(false);
  const usefulRangeRef = useRef(false);

  useFrame(({ camera }) => {
    const distance = camera.position.length();
    const nextUsefulRange = distance <= maxCameraDistance;
    if (nextUsefulRange !== usefulRangeRef.current) {
      usefulRangeRef.current = nextUsefulRange;
      setInUsefulRange(nextUsefulRange);
    }
    if (materialRef.current) {
      const fadeStart = maxCameraDistance - 0.7;
      const targetOpacity = enabled && nextUsefulRange
        ? opacity * (1 - THREE.MathUtils.smoothstep(distance, fadeStart, maxCameraDistance))
        : 0;
      materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, targetOpacity, 0.12);
      materialRef.current.visible = materialRef.current.opacity > 0.005;
    }
  });

  useEffect(() => {
    if (!enabled || !inUsefulRange || asset) return;
    let active = true;
    onLoadStateChange(id, "loading");
    ASSET_LOADERS[id]()
      .then((module) => {
        if (!active) return;
        setAsset(module.default);
        onLoadStateChange(id, "ready");
      })
      .catch(() => {
        if (!active) return;
        onLoadStateChange(id, "error", "Boundary data could not be loaded.");
      });
    return () => { active = false; };
  }, [asset, enabled, id, inUsefulRange, onLoadStateChange]);

  const geometry = useMemo(() => {
    if (!asset) return null;
    const positions: number[] = [];
    for (const line of asset.lines) {
      for (let index = 1; index < line.length; index += 1) {
        const [previousLongitude, previousLatitude] = line[index - 1];
        const [longitude, latitude] = line[index];
        positions.push(
          ...latLonToScenePosition(previousLatitude, previousLongitude, radius),
          ...latLonToScenePosition(latitude, longitude, radius),
        );
      }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return result;
  }, [asset, radius]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  return (
    <lineSegments geometry={geometry} raycast={() => undefined}>
      <lineBasicMaterial ref={materialRef} color={color} transparent opacity={0} depthWrite={false} />
    </lineSegments>
  );
}

export default function MapDetailsLayer({ layers, onLoadStateChange }: {
  layers: MapLayerStateById;
  onLoadStateChange: (id: MapLayerId, loadState: MapLayerLoadState, error?: string) => void;
}) {
  const countries = layers["country-boundaries"];
  const admin1 = layers["admin1-boundaries"];

  return <>
    {countries.visible && <BoundaryLayer
      id="country-boundaries"
      enabled
      maxCameraDistance={countries.maxCameraDistance}
      color={countries.legend?.color ?? "#69d9d5"}
      opacity={0.48}
      radius={2.018}
      onLoadStateChange={onLoadStateChange}
    />}
    {admin1.visible && <BoundaryLayer
      id="admin1-boundaries"
      enabled
      maxCameraDistance={admin1.maxCameraDistance}
      color={admin1.legend?.color ?? "#559e9d"}
      opacity={0.28}
      radius={2.021}
      onLoadStateChange={onLoadStateChange}
    />}
  </>;
}