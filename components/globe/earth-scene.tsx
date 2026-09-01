"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import landTopology from "@/data/land-110m.json";
import { latLonToScenePosition, scenePositionToLatLon } from "@/lib/orbital/engine";
import type { EarthViewMode, ObserverLocation, PropagatedState, SelectedEarthLocation } from "@/types/orbital";

interface EarthSceneProps {
  state: PropagatedState | null;
  orbitPath: [number, number, number][];
  satelliteName: string;
  observer: ObserverLocation;
  selectedLocation: SelectedEarthLocation | null;
  viewMode: EarthViewMode;
  onLocationSelect: (location: SelectedEarthLocation) => void;
  onScaleChange: (scale: string) => void;
}

interface MajorCity {
  name: string;
  latitude: number;
  longitude: number;
  priority?: boolean;
}

interface NightLightCenter {
  latitude: number;
  longitude: number;
  intensity: number;
}

const MAJOR_CITIES: MajorCity[] = [
  { name: "New York", latitude: 40.7128, longitude: -74.006, priority: true },
  { name: "Los Angeles", latitude: 34.0522, longitude: -118.2437 },
  { name: "Mexico City", latitude: 19.4326, longitude: -99.1332, priority: true },
  { name: "Toronto", latitude: 43.6532, longitude: -79.3832 },
  { name: "São Paulo", latitude: -23.5505, longitude: -46.6333, priority: true },
  { name: "Buenos Aires", latitude: -34.6037, longitude: -58.3816 },
  { name: "London", latitude: 51.5074, longitude: -0.1278, priority: true },
  { name: "Paris", latitude: 48.8566, longitude: 2.3522 },
  { name: "Istanbul", latitude: 41.0082, longitude: 28.9784 },
  { name: "Moscow", latitude: 55.7558, longitude: 37.6173 },
  { name: "Cairo", latitude: 30.0444, longitude: 31.2357, priority: true },
  { name: "Lagos", latitude: 6.5244, longitude: 3.3792 },
  { name: "Johannesburg", latitude: -26.2041, longitude: 28.0473 },
  { name: "Dubai", latitude: 25.2048, longitude: 55.2708 },
  { name: "Delhi", latitude: 28.6139, longitude: 77.209, priority: true },
  { name: "Mumbai", latitude: 19.076, longitude: 72.8777 },
  { name: "Beijing", latitude: 39.9042, longitude: 116.4074 },
  { name: "Shanghai", latitude: 31.2304, longitude: 121.4737 },
  { name: "Tokyo", latitude: 35.6762, longitude: 139.6503, priority: true },
  { name: "Seoul", latitude: 37.5665, longitude: 126.978 },
  { name: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { name: "Jakarta", latitude: -6.2088, longitude: 106.8456 },
  { name: "Sydney", latitude: -33.8688, longitude: 151.2093, priority: true },
  { name: "Auckland", latitude: -36.8509, longitude: 174.7645 },
];

const NIGHT_LIGHT_CENTERS: NightLightCenter[] = [
  { latitude: 40.71, longitude: -74.01, intensity: 1 }, { latitude: 38.91, longitude: -77.04, intensity: 0.78 },
  { latitude: 42.36, longitude: -71.06, intensity: 0.68 }, { latitude: 41.88, longitude: -87.63, intensity: 0.78 },
  { latitude: 34.05, longitude: -118.24, intensity: 0.94 }, { latitude: 37.77, longitude: -122.42, intensity: 0.72 },
  { latitude: 29.76, longitude: -95.37, intensity: 0.68 }, { latitude: 19.43, longitude: -99.13, intensity: 0.92 },
  { latitude: -23.55, longitude: -46.63, intensity: 1 }, { latitude: -22.91, longitude: -43.17, intensity: 0.78 },
  { latitude: -34.60, longitude: -58.38, intensity: 0.8 }, { latitude: 51.51, longitude: -0.13, intensity: 0.96 },
  { latitude: 48.86, longitude: 2.35, intensity: 0.86 }, { latitude: 50.85, longitude: 4.35, intensity: 0.72 },
  { latitude: 51.23, longitude: 6.78, intensity: 0.82 }, { latitude: 45.46, longitude: 9.19, intensity: 0.7 },
  { latitude: 40.42, longitude: -3.70, intensity: 0.68 }, { latitude: 41.01, longitude: 28.98, intensity: 0.88 },
  { latitude: 55.76, longitude: 37.62, intensity: 0.82 }, { latitude: 30.04, longitude: 31.24, intensity: 0.82 },
  { latitude: 6.52, longitude: 3.38, intensity: 0.85 }, { latitude: -26.20, longitude: 28.05, intensity: 0.7 },
  { latitude: 25.20, longitude: 55.27, intensity: 0.84 }, { latitude: 24.71, longitude: 46.68, intensity: 0.62 },
  { latitude: 28.61, longitude: 77.21, intensity: 1 }, { latitude: 19.08, longitude: 72.88, intensity: 0.96 },
  { latitude: 22.57, longitude: 88.36, intensity: 0.86 }, { latitude: 13.08, longitude: 80.27, intensity: 0.76 },
  { latitude: 23.81, longitude: 90.41, intensity: 0.9 }, { latitude: 31.23, longitude: 121.47, intensity: 1 },
  { latitude: 39.90, longitude: 116.41, intensity: 0.96 }, { latitude: 22.54, longitude: 114.06, intensity: 0.9 },
  { latitude: 23.13, longitude: 113.26, intensity: 0.92 }, { latitude: 30.57, longitude: 104.07, intensity: 0.76 },
  { latitude: 35.68, longitude: 139.65, intensity: 1 }, { latitude: 34.69, longitude: 135.50, intensity: 0.84 },
  { latitude: 37.57, longitude: 126.98, intensity: 0.92 }, { latitude: 25.03, longitude: 121.57, intensity: 0.78 },
  { latitude: 13.76, longitude: 100.50, intensity: 0.76 }, { latitude: 10.82, longitude: 106.63, intensity: 0.72 },
  { latitude: 1.35, longitude: 103.82, intensity: 0.86 }, { latitude: -6.21, longitude: 106.85, intensity: 0.94 },
  { latitude: 14.60, longitude: 120.98, intensity: 0.82 }, { latitude: -33.87, longitude: 151.21, intensity: 0.78 },
  { latitude: -37.81, longitude: 144.96, intensity: 0.66 }, { latitude: -36.85, longitude: 174.76, intensity: 0.54 },
];

function solarDirection(date: Date) {
  const julianDate = date.getTime() / 86_400_000 + 2_440_587.5;
  const daysSinceJ2000 = julianDate - 2_451_545;
  const meanLongitude = THREE.MathUtils.degToRad((280.46 + 0.9856474 * daysSinceJ2000) % 360);
  const meanAnomaly = THREE.MathUtils.degToRad((357.528 + 0.9856003 * daysSinceJ2000) % 360);
  const eclipticLongitude = meanLongitude + THREE.MathUtils.degToRad(1.915) * Math.sin(meanAnomaly) + THREE.MathUtils.degToRad(0.02) * Math.sin(2 * meanAnomaly);
  const obliquity = THREE.MathUtils.degToRad(23.439 - 0.0000004 * daysSinceJ2000);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const siderealDegrees = (280.46061837 + 360.98564736629 * daysSinceJ2000) % 360;
  const subsolarLongitude = THREE.MathUtils.radToDeg(rightAscension) - siderealDegrees;
  return new THREE.Vector3(...latLonToScenePosition(
    THREE.MathUtils.radToDeg(declination),
    ((subsolarLongitude + 540) % 360) - 180,
    1,
  )).normalize();
}

function NightCityLights({ sunDirection }: { sunDirection: THREE.Vector3 }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const intensities: number[] = [];
    const phases: number[] = [];
    const offsets = [
      [0, 0], [0.15, 0.18], [-0.13, 0.12], [0.09, -0.17],
      [-0.18, -0.1], [0.23, 0.03], [-0.05, 0.25],
    ];

    NIGHT_LIGHT_CENTERS.forEach((center, centerIndex) => {
      const pointCount = center.intensity >= 0.85 ? offsets.length : 5;
      const longitudeScale = Math.max(0.35, Math.cos(THREE.MathUtils.degToRad(center.latitude)));
      offsets.slice(0, pointCount).forEach(([latitudeOffset, longitudeOffset], pointIndex) => {
        positions.push(...latLonToScenePosition(
          center.latitude + latitudeOffset,
          center.longitude + longitudeOffset / longitudeScale,
          2.045,
        ));
        intensities.push(center.intensity * (pointIndex === 0 ? 1 : 0.42 + (pointIndex % 3) * 0.08));
        phases.push((centerIndex * 1.618 + pointIndex * 2.37) % (Math.PI * 2));
      });
    });

    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute("aIntensity", new THREE.Float32BufferAttribute(intensities, 1));
    result.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
    return result;
  }, []);
  const uniforms = useMemo(() => ({
    uSunDirection: { value: sunDirection.clone() },
    uTime: { value: 0 },
  }), [sunDirection]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uSunDirection.value.copy(sunDirection);
    materialRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points geometry={geometry} raycast={() => undefined}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          attribute float aIntensity;
          attribute float aPhase;
          uniform vec3 uSunDirection;
          uniform float uTime;
          varying float vAlpha;
          void main() {
            float sunExposure = dot(normalize(position), normalize(uSunDirection));
            float night = 1.0 - smoothstep(-0.28, 0.06, sunExposure);
            float glisten = 0.86 + 0.14 * sin(uTime * (0.32 + aIntensity * 0.24) + aPhase);
            vAlpha = night * aIntensity * glisten;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = (1.8 + aIntensity * 3.0) * (10.0 / max(1.0, -viewPosition.z));
          }
        `}
        fragmentShader={`
          varying float vAlpha;
          void main() {
            float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
            float core = 1.0 - smoothstep(0.04, 0.48, distanceFromCenter);
            float halo = 1.0 - smoothstep(0.12, 0.5, distanceFromCenter);
            float alpha = vAlpha * (core * 0.58 + halo * 0.2);
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(1.0, 0.73, 0.36, alpha);
          }
        `}
      />
    </points>
  );
}

function Graticule() {
  const lines = useMemo(() => {
    const result: { points: [number, number, number][]; emphasized: boolean }[] = [];
    for (let latitude = -75; latitude <= 75; latitude += 15) {
      result.push({
        points: Array.from({ length: 121 }, (_, index) =>
          latLonToScenePosition(latitude, -180 + index * 3, 2.008)),
        emphasized: latitude === 0,
      });
    }
    for (let longitude = -165; longitude <= 180; longitude += 15) {
      result.push({
        points: Array.from({ length: 61 }, (_, index) =>
          latLonToScenePosition(-90 + index * 3, longitude, 2.008)),
        emphasized: longitude === 0,
      });
    }
    return result;
  }, []);

  return lines.map(({ points, emphasized }, index) => (
    <Line key={index} points={points} color={emphasized ? "#55cdd1" : "#368d96"} transparent opacity={emphasized ? 0.2 : 0.08} lineWidth={emphasized ? 0.8 : 0.45} />
  ));
}

type GeoGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

function splitAtAntimeridian(ring: number[][]): [number, number, number][][] {
  const segments: [number, number, number][][] = [];
  let segment: [number, number, number][] = [];
  let previousLongitude: number | null = null;

  for (const [longitude, latitude] of ring) {
    if (previousLongitude !== null && Math.abs(longitude - previousLongitude) > 180) {
      if (segment.length > 1) segments.push(segment);
      segment = [];
    }
    segment.push(latLonToScenePosition(latitude, longitude, 2.016));
    previousLongitude = longitude;
  }
  if (segment.length > 1) segments.push(segment);
  return segments;
}

function Coastlines() {
  const coastlines = useMemo(() => {
    // world-atlas land-110m is derived from public-domain Natural Earth data.
    const topology = landTopology as unknown as Topology;
    const collection = feature(
      topology,
      topology.objects.land as GeometryCollection,
    ) as unknown as { features: { geometry: GeoGeometry }[] };

    return collection.features.flatMap(({ geometry }) => {
      const polygons = geometry.type === "Polygon"
        ? [geometry.coordinates as number[][][]]
        : geometry.coordinates as number[][][][];
      return polygons.flatMap((polygon) => polygon.flatMap(splitAtAntimeridian));
    });
  }, []);

  return coastlines.map((points, index) => (
    <group key={index}>
      <Line points={points} color="#62e4df" transparent opacity={0.12} lineWidth={3.2} />
      <Line points={points} color="#77e8e1" transparent opacity={0.72} lineWidth={0.85} />
    </group>
  ));
}

function GroundMarker({ latitude, longitude, color }: {
  latitude: number;
  longitude: number;
  color: string;
}) {
  const position = latLonToScenePosition(latitude, longitude, 2.04);
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.027, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function CityMarker({ city, onLocationSelect }: {
  city: MajorCity;
  onLocationSelect: EarthSceneProps["onLocationSelect"];
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const labelVisible = useRef(false);
  const position = useMemo(
    () => new THREE.Vector3(...latLonToScenePosition(city.latitude, city.longitude, 2.025)),
    [city.latitude, city.longitude],
  );
  const surfaceNormal = useMemo(() => position.clone().normalize(), [position]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal),
    [surfaceNormal],
  );

  useFrame(({ camera }) => {
    const facing = position.dot(camera.position) / (position.length() * camera.position.length());
    const labelEligible = city.priority || camera.position.length() < 4.65;
    const visible = labelEligible && facing > (labelVisible.current ? 0.04 : 0.16);
    if (labelRef.current && visible !== labelVisible.current) {
      labelVisible.current = visible;
      labelRef.current.style.opacity = visible ? "1" : "0";
      labelRef.current.style.visibility = visible ? "visible" : "hidden";
    }
  });

  const selectCity = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 6) return;
    event.stopPropagation();
    onLocationSelect({
      latitude: city.latitude,
      longitude: city.longitude,
      displayName: city.name,
      source: "globe",
    });
  };

  return (
    <group position={position} quaternion={quaternion} onClick={selectCity}>
      <mesh>
        <circleGeometry args={[0.022, 18]} />
        <meshBasicMaterial color="#7ee5df" side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.035, 0.043, 24]} />
        <meshBasicMaterial color="#4ab7b7" transparent opacity={0.72} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.075, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html center distanceFactor={7.5} zIndexRange={[3, 1]} style={{ pointerEvents: "none" }}>
        <span ref={labelRef} className="city-pin-label">{city.name.toUpperCase()}</span>
      </Html>
    </group>
  );
}

function SpacecraftMarker({ position }: { position: [number, number, number] }) {
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!halo.current) return;
    const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.18;
    halo.current.scale.setScalar(scale);
  });
  return (
    <group position={position} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
      <mesh>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color="#e8fdff" />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshBasicMaterial color="#5de8e8" transparent opacity={0.19} depthWrite={false} />
      </mesh>
      <pointLight color="#67ffff" intensity={2.2} distance={1.4} />
    </group>
  );
}

function SelectedLocationMarker({ location }: { location: SelectedEarthLocation }) {
  const pulse = useRef<THREE.Mesh>(null);
  const surface = useMemo(
    () => new THREE.Vector3(...latLonToScenePosition(location.latitude, location.longitude, 2.045)),
    [location.latitude, location.longitude],
  );
  const tip = useMemo(
    () => latLonToScenePosition(location.latitude, location.longitude, 2.2),
    [location.latitude, location.longitude],
  );
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), surface.clone().normalize()),
    [surface],
  );

  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const scale = 1 + (Math.sin(clock.elapsedTime * 4) + 1) * 0.28;
    pulse.current.scale.setScalar(scale);
  });

  return (
    <group onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
      <Line points={[surface.toArray(), tip]} color="#f4c56b" transparent opacity={0.78} lineWidth={1} />
      <group position={surface} quaternion={quaternion}>
        <mesh>
          <ringGeometry args={[0.045, 0.065, 28]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={pulse}>
          <ringGeometry args={[0.08, 0.094, 32]} />
          <meshBasicMaterial color="#ffc861" transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function SubSatellitePoint({ state }: { state: PropagatedState }) {
  const ground = latLonToScenePosition(state.latitude, state.longitude, 2.025);
  return (
    <group onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
      <Line points={[ground, state.displayPosition]} color="#72dfe3" transparent opacity={0.2} lineWidth={0.65} />
      <mesh position={ground}>
        <sphereGeometry args={[0.023, 12, 12]} />
        <meshBasicMaterial color="#72dfe3" transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

function CameraController({ mode, selectedLocation, state, onScaleChange }: {
  mode: EarthViewMode;
  selectedLocation: SelectedEarthLocation | null;
  state: PropagatedState | null;
  onScaleChange: (scale: string) => void;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const transitioning = useRef(true);
  const previousMode = useRef<EarthViewMode | null>(null);
  const previousFocus = useRef("");
  const previousScale = useRef("");

  useEffect(() => {
    const focus = selectedLocation ? `${selectedLocation.latitude},${selectedLocation.longitude}` : "";
    if (previousMode.current !== mode || previousFocus.current !== focus) {
      transitioning.current = true;
    }
    previousMode.current = mode;
    previousFocus.current = focus;
  }, [mode, selectedLocation]);

  useFrame(({ camera }, delta) => {
    const distance = camera.position.length();
    const scale = distance <= 2.9 ? "CITY VIEW" : distance <= 4.45 ? "LOCAL VIEW" : distance <= 6.2 ? "REGIONAL VIEW" : "GLOBAL VIEW";
    if (scale !== previousScale.current) {
      previousScale.current = scale;
      onScaleChange(scale);
    }

    const followingSatellite = mode === "satellite" && Boolean(state);
    if (!transitioning.current && !followingSatellite) return;
    let destination = new THREE.Vector3(4.6, 2.7, 5.2);
    let desiredDistance = destination.length();
    if (mode === "location" && selectedLocation) {
      destination = new THREE.Vector3(...latLonToScenePosition(selectedLocation.latitude, selectedLocation.longitude, 1));
      desiredDistance = 3.75;
    } else if (mode === "satellite" && state) {
      destination = new THREE.Vector3(...state.displayPosition).normalize();
      desiredDistance = 6.1;
    }

    const currentDirection = camera.position.clone().normalize();
    const desiredDirection = destination.normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(currentDirection, desiredDirection);
    const stepRotation = new THREE.Quaternion().slerp(rotation, 1 - Math.exp(-delta * 4.5));
    currentDirection.applyQuaternion(stepRotation).normalize();
    const nextDistance = THREE.MathUtils.lerp(distance, desiredDistance, 1 - Math.exp(-delta * 4.5));
    camera.position.copy(currentDirection.multiplyScalar(nextDistance));
    controls.current?.target.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.exp(-delta * 5));
    controls.current?.update();

    if (!followingSatellite && camera.position.distanceTo(desiredDirection.multiplyScalar(desiredDistance)) < 0.025) {
      transitioning.current = false;
    }
  });

  const takeManualControl = () => {
    transitioning.current = false;
  };

  return <OrbitControls ref={controls} enablePan={false} enableRotate={mode !== "satellite"} enableZoom={mode !== "satellite"} enableDamping={false} minDistance={2.4} maxDistance={10} zoomSpeed={0.72} autoRotate={false} onStart={takeManualControl} />;
}

function ClickableEarth({ onLocationSelect }: { onLocationSelect: EarthSceneProps["onLocationSelect"] }) {
  useEffect(() => () => { document.body.style.cursor = ""; }, []);

  const selectPoint = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 6) return;
    event.stopPropagation();
    const { latitude, longitude } = scenePositionToLatLon(event.point);
    onLocationSelect({ latitude, longitude, source: "globe" });
  };

  return (
    <mesh
      onClick={selectPoint}
      onPointerOver={() => { document.body.style.cursor = "crosshair"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <sphereGeometry args={[2, 72, 72]} />
      <meshStandardMaterial color="#082837" roughness={0.78} metalness={0.08} />
    </mesh>
  );
}

function Scene({ state, orbitPath, observer, selectedLocation, viewMode, onLocationSelect, onScaleChange }: Omit<EarthSceneProps, "satelliteName">) {
  const stateTimestamp = state?.timestamp;
  const sunDirection = useMemo(
    () => solarDirection(stateTimestamp ? new Date(stateTimestamp) : new Date()),
    [stateTimestamp],
  );
  const sunlightPosition = sunDirection.clone().multiplyScalar(8).toArray();
  const nightFillPosition = sunDirection.clone().multiplyScalar(-6).toArray();

  return (
    <>
      <color attach="background" args={["#03070b"]} />
      <ambientLight intensity={0.16} />
      <directionalLight position={sunlightPosition} color="#e9fbff" intensity={2.9} />
      <directionalLight position={nightFillPosition} color="#064856" intensity={0.22} />
      <Stars radius={70} depth={35} count={1700} factor={2.3} saturation={0.12} fade speed={0.2} />
      <ClickableEarth onLocationSelect={onLocationSelect} />
      <mesh scale={1.035} raycast={() => undefined}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial color="#36d7df" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <mesh scale={1.09} raycast={() => undefined}>
        <sphereGeometry args={[2, 48, 48]} />
        <meshBasicMaterial color="#2a9eaa" transparent opacity={0.035} side={THREE.BackSide} />
      </mesh>
      <Graticule />
      <Coastlines />
      <NightCityLights sunDirection={sunDirection} />
      {MAJOR_CITIES.map((city) => <CityMarker key={city.name} city={city} onLocationSelect={onLocationSelect} />)}
      <GroundMarker latitude={observer.latitude} longitude={observer.longitude} color="#ffd27a" />
      {orbitPath.length > 1 && (
        <Line points={orbitPath} color="#62edf0" lineWidth={1.4} transparent opacity={0.78} />
      )}
      {selectedLocation && <SelectedLocationMarker location={selectedLocation} />}
      {state && <><SubSatellitePoint state={state} /><SpacecraftMarker position={state.displayPosition} /></>}
      <CameraController mode={viewMode} selectedLocation={selectedLocation} state={state} onScaleChange={onScaleChange} />
    </>
  );
}

export default function EarthScene(props: EarthSceneProps) {
  return (
    <div
      className="globe-canvas"
      aria-label={`Interactive orbital view of ${props.satelliteName}`}
    >
      <Canvas camera={{ position: [4.6, 2.7, 5.2], fov: 42 }} dpr={[1, 1.75]}>
        <Scene state={props.state} orbitPath={props.orbitPath} observer={props.observer} selectedLocation={props.selectedLocation} viewMode={props.viewMode} onLocationSelect={props.onLocationSelect} onScaleChange={props.onScaleChange} />
      </Canvas>
      <div className="globe-reticle" aria-hidden="true" />
      <div className="globe-caption"><span>ECF FRAME · MAJOR CITIES PINNED</span><span>{props.viewMode === "satellite" ? "SATELLITE FOLLOW LOCKED" : "DRAG TO ROTATE · SCROLL TO CITY SCALE"}</span></div>
    </div>
  );
}