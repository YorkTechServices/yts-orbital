"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";

type ImageryState = { texture: THREE.Texture | null; label: string };
type SeasonalState = ImageryState & { month: number };

function configureTexture(texture: THREE.Texture) {
  // Equirectangular maps align with the app's Earth-fixed ECEF convention:
  // map center (u=.5) is 0° longitude, and increasing u points eastward.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function useSeasonalEarthTexture(month: number): ImageryState {
  const [state, setState] = useState<SeasonalState>({ texture: null, label: "SURFACE LOADING", month: 0 });
  useEffect(() => {
    let cancelled = false;
    let texture: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.load(`/api/earth/surface?month=${month}`, (result) => {
      if (cancelled) { result.dispose(); return; }
      texture = configureTexture(result);
      setState({ texture, label: "NASA SEASONAL SURFACE · 2004 COMPOSITE", month });
    }, undefined, () => {
      if (!cancelled) setState({ texture: null, label: "NASA SURFACE UNAVAILABLE · BASE GLOBE", month });
    });
    return () => { cancelled = true; texture?.dispose(); };
  }, [month]);
  return state.month === month ? state : { texture: null, label: "SURFACE LOADING" };
}

export function useObservedClouds(enabled: boolean): ImageryState {
  const [state, setState] = useState<ImageryState>({ texture: null, label: "CLOUDS LOADING" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let currentTexture: THREE.Texture | null = null;
    let currentRequest: AbortController | null = null;

    const refresh = async () => {
      currentRequest?.abort();
      const request = new AbortController();
      currentRequest = request;
      let objectUrl: string | null = null;
      try {
        const response = await fetch(`/api/earth/clouds?refresh=${Math.floor(Date.now() / 900_000)}`, {
          signal: request.signal,
          cache: "no-store",
        });
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("no verified cloud imagery");
        const sourceTime = response.headers.get("x-cloud-updated");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        const result = await new THREE.TextureLoader().loadAsync(objectUrl);
        if (cancelled || request.signal.aborted) { result.dispose(); return; }
        const previous = currentTexture;
        currentTexture = configureTexture(result);
        const timeMs = sourceTime && sourceTime !== "unknown" ? Date.parse(sourceTime) : NaN;
        const label = Number.isFinite(timeMs)
          ? `OBSERVED CLOUDS · ${new Date(timeMs).toISOString().slice(0, 16).replace("T", " ")} UTC`
          : "LATEST CLOUD COMPOSITE · AGE UNVERIFIED";
        setState({ texture: currentTexture, label });
        previous?.dispose();
      } catch {
        if (cancelled || request.signal.aborted) return;
        currentTexture?.dispose();
        currentTexture = null;
        setState({ texture: null, label: "CLOUD FEED UNAVAILABLE · NO SYNTHETIC CLOUDS" });
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30 * 60_000);
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      currentRequest?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      currentTexture?.dispose();
    };
  }, [enabled]);
  return enabled ? state : { texture: null, label: "LIVE CLOUDS HIDDEN · SIMULATION MODE" };
}
