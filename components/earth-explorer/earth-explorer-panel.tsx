"use client";

import { FormEvent, useState } from "react";
import { Crosshair, Globe2, LoaderCircle, MapPin, Radar, Search, Trash2 } from "lucide-react";
import type { EarthViewMode, GeocodeResponse, GeocodeResult, SelectedEarthLocation } from "@/types/orbital";
import { formatCoordinate } from "@/lib/utils/format";

interface EarthExplorerPanelProps {
  mode: EarthViewMode;
  selectedLocation: SelectedEarthLocation | null;
  scaleLabel: string;
  satelliteAvailable?: boolean;
  onModeChange: (mode: EarthViewMode) => void;
  onLocationSelect: (location: SelectedEarthLocation) => void;
  onClear: () => void;
  onSetObserver: () => void;
}

const MODES: { value: EarthViewMode; label: string; icon: typeof Globe2 }[] = [
  { value: "earth", label: "EARTH", icon: Globe2 },
  { value: "location", label: "LOCATION", icon: MapPin },
  { value: "satellite", label: "SATELLITE", icon: Radar },
];

export default function EarthExplorerPanel({
  mode, selectedLocation, scaleLabel, satelliteAvailable = true,
  onModeChange, onLocationSelect, onClear, onSetObserver,
}: EarthExplorerPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || searching) return;
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      const payload = await response.json() as GeocodeResponse | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Location search unavailable.");
      setResults(payload.results);
      if (!payload.results.length) setSearchError("No matching location was found.");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Location search unavailable.");
    } finally {
      setSearching(false);
    }
  };

  const chooseResult = (result: GeocodeResult) => {
    onLocationSelect({
      latitude: result.latitude,
      longitude: result.longitude,
      displayName: result.displayName,
      source: "search",
    });
    setResults([]);
  };

  const clear = () => {
    setQuery("");
    setResults([]);
    setSearchError(null);
    onClear();
  };

  return (
    <section className="panel earth-explorer-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">GEOSPATIAL SURFACE</p><h2>EARTH EXPLORER</h2></div>
        <Crosshair size={18} />
      </div>

      <div className="view-mode-control" aria-label="Earth view mode">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={mode === value ? "active" : ""}
            onClick={() => onModeChange(value)}
            disabled={(value === "location" && !selectedLocation) || (value === "satellite" && !satelliteAvailable)}
            aria-pressed={mode === value}
          ><Icon size={13} />{label}</button>
        ))}
      </div>

      <form className="location-search" onSubmit={search}>
        <label htmlFor="earth-location-search">SEARCH LOCATION</label>
        <div><input id="earth-location-search" maxLength={120} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City, region, country..." /><button type="submit" disabled={!query.trim() || searching} aria-label="Search geographic locations">{searching ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />}</button></div>
      </form>

      {searching && <p className="explorer-status">SEARCHING EARTH...</p>}
      {searchError && <p className="explorer-error">{searchError}</p>}
      {results.length > 0 && <div className="location-results">{results.map((result) => (
        <button key={result.id} onClick={() => chooseResult(result)}>
          <span><strong>{result.primaryName}</strong><small>{result.secondaryName}</small></span>
          <b>{result.latitude.toFixed(3)}, {result.longitude.toFixed(3)}</b>
        </button>
      ))}</div>}

      <div className="selected-location">
        {selectedLocation ? <>
          <p className="eyebrow">SELECTED {selectedLocation.source === "globe" ? "COORDINATE" : "LOCATION"}</p>
          <h3>{selectedLocation.details?.primaryName ?? selectedLocation.displayName ?? "Globe selection"}</h3>
          <div className="location-coordinates"><span>{formatCoordinate(selectedLocation.latitude, "N", "S")}</span><span>{formatCoordinate(selectedLocation.longitude, "E", "W")}</span></div>
          {selectedLocation.lookupStatus === "loading" && <p className="location-lookup-status"><LoaderCircle className="spin" size={11} /> RESOLVING GEOGRAPHIC CONTEXT...</p>}
          {selectedLocation.lookupStatus === "unavailable" && <p className="location-lookup-status unavailable">GEOGRAPHIC CONTEXT UNAVAILABLE</p>}
          {selectedLocation.details && <div className="location-intelligence">
            <div><span>PLACE</span><strong>{[selectedLocation.details.locality, selectedLocation.details.region, selectedLocation.details.country].filter(Boolean).join(" · ") || "No named land area"}</strong></div>
            <div><span>POPULATION{selectedLocation.details.populationScope ? ` · ${selectedLocation.details.populationScope.toUpperCase()}` : ""}</span><strong>{selectedLocation.details.population ? `~${selectedLocation.details.population.toLocaleString()}${selectedLocation.details.populationYear ? ` (${selectedLocation.details.populationYear})` : ""}` : "No sourced estimate"}</strong></div>
            <div><span>CITY / MUNICIPALITY CONTEXT</span><strong>{selectedLocation.details.nearestCity ?? (selectedLocation.details.isRemote ? "None identified · remote" : "Not identified")}</strong></div>
            {(selectedLocation.details.bodyOfWater || selectedLocation.details.geographicFeature) && <div><span>GEOGRAPHIC FEATURE</span><strong>{selectedLocation.details.bodyOfWater ?? selectedLocation.details.geographicFeature}</strong></div>}
            <div className={selectedLocation.details.isRemote ? "remote" : "populated"}><span>AREA CLASSIFICATION</span><strong>{selectedLocation.details.contextLabel}</strong></div>
          </div>}
          <p className="selection-source">SOURCE · {selectedLocation.source === "search" ? "LOCATION SEARCH" : "GLOBE SELECTION"}</p>
          <div className="explorer-actions"><button className="set-observer" onClick={onSetObserver}><MapPin size={13} /> SET AS OBSERVER</button><button onClick={clear} aria-label="Clear selected Earth location"><Trash2 size={13} /> CLEAR</button></div>
        </> : <div className="explorer-empty"><Globe2 size={20} /><p>Click the globe or search for a location.</p></div>}
      </div>

      <div className="scale-readout"><span>VIEW SCALE</span><strong>{scaleLabel}</strong></div>
      <div className="geocode-attribution">Location data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · context by <a href="https://www.bigdatacloud.com/" target="_blank" rel="noreferrer">BigDataCloud</a></div>
    </section>
  );
}