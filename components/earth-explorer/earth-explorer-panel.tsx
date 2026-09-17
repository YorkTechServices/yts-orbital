"use client";

import { FormEvent, useState } from "react";
import { Crosshair, Globe2, Layers3, LoaderCircle, MapPin, Radar, Search, Trash2 } from "lucide-react";
import type { EarthViewMode, GeocodeResponse, GeocodeResult, SelectedEarthLocation } from "@/types/orbital";
import type { MapLayerId, MapLayerStateById } from "@/lib/layers/map-layers";
import { formatCoordinate } from "@/lib/utils/format";

export function LocationDetailsCard({ selectedLocation, onSetObserver, onClear, placement = "panel" }: {
  selectedLocation: SelectedEarthLocation;
  onSetObserver: () => void;
  onClear: () => void;
  placement?: "panel" | "globe-header";
}) {
  const details = selectedLocation.details;
  const administrativeLine = [details?.country, details?.region].filter(Boolean).join(" · ");

  return (
    <div className={`selected-location selected-location--active ${placement === "globe-header" ? "selected-location--globe-header" : ""}`}>
      <p className="eyebrow">SELECTED {selectedLocation.source === "globe" ? "COORDINATE" : "LOCATION"}</p>
      <h3>{details?.primaryName ?? selectedLocation.displayName ?? "Globe selection"}</h3>
      {administrativeLine && <p className="location-administrative">{administrativeLine}</p>}
      <div className="location-coordinates"><span>{formatCoordinate(selectedLocation.latitude, "N", "S")}</span><span>{formatCoordinate(selectedLocation.longitude, "E", "W")}</span></div>
      {selectedLocation.lookupStatus === "loading" && <p className="location-lookup-status"><LoaderCircle className="spin" size={11} /> RESOLVING GEOGRAPHIC CONTEXT...</p>}
      {selectedLocation.lookupStatus === "unavailable" && <p className="location-lookup-status unavailable">GEOGRAPHIC CONTEXT UNAVAILABLE</p>}
      {details && <div className="location-intelligence">
        {details.population && <div><span>{details.populationSource === "settlement" ? "CITY POPULATION" : "POPULATION"}{details.populationScope ? ` · ${details.populationScope.toUpperCase()}` : ""}</span><strong>{details.population.toLocaleString()}{details.populationYear ? ` (${details.populationYear})` : ""}</strong></div>}
        {typeof details.elevationMeters === "number" && <div><span>ELEVATION</span><strong>{details.elevationMeters.toLocaleString()} m</strong></div>}
        {details.nearestCity && <div><span>CITY / MUNICIPALITY CONTEXT</span><strong>{details.nearestCity}</strong></div>}
        {(details.bodyOfWater || details.geographicFeature) && <div><span>GEOGRAPHIC FEATURE</span><strong>{details.bodyOfWater ?? details.geographicFeature}</strong></div>}
        {details.addressType && <div><span>GEOGRAPHIC METADATA</span><strong>{details.addressType}</strong></div>}
        <div className={details.isRemote ? "remote" : "populated"}><span>AREA CLASSIFICATION</span><strong>{details.contextLabel}</strong></div>
      </div>}
      <p className="selection-source">SOURCE · {selectedLocation.source === "search" ? "LOCATION SEARCH" : "GLOBE SELECTION"}</p>
      <div className="explorer-actions"><button type="button" className="set-observer" onClick={onSetObserver}><MapPin size={13} /> SET AS OBSERVER</button><button type="button" onClick={onClear} aria-label="Clear selected Earth location"><Trash2 size={13} /> CLEAR</button></div>
    </div>
  );
}

interface EarthExplorerPanelProps {
  mode: EarthViewMode;
  selectedLocation: SelectedEarthLocation | null;
  scaleLabel: string;
  satelliteAvailable?: boolean;
  onModeChange: (mode: EarthViewMode) => void;
  onLocationSelect: (location: SelectedEarthLocation) => void;
  onClear: () => void;
  onSetObserver: () => void;
  mapLayers: MapLayerStateById;
  onToggleMapLayer: (id: MapLayerId) => void;
  showSelectedLocationDetails?: boolean;
}

const MODES: { value: EarthViewMode; label: string; icon: typeof Globe2 }[] = [
  { value: "earth", label: "EARTH", icon: Globe2 },
  { value: "location", label: "LOCATION", icon: MapPin },
  { value: "satellite", label: "SATELLITE", icon: Radar },
];

export default function EarthExplorerPanel({
  mode, selectedLocation, scaleLabel, satelliteAvailable = true,
  onModeChange, onLocationSelect, onClear, onSetObserver, mapLayers, onToggleMapLayer,
  showSelectedLocationDetails = true,
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

  const locationIsPrimary = Boolean(selectedLocation) && mode !== "satellite";

  return (
    <section className="panel earth-explorer-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">GEOSPATIAL SURFACE</p><h2>EARTH EXPLORER</h2></div>
        <Crosshair size={18} />
      </div>

      {showSelectedLocationDetails && locationIsPrimary && selectedLocation && <LocationDetailsCard selectedLocation={selectedLocation} onSetObserver={onSetObserver} onClear={clear} />}

      <div className="view-mode-control" aria-label="Earth view mode">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={mode === value ? "active" : ""}
            onClick={() => onModeChange(value)}
            disabled={(value === "location" && !selectedLocation) || (value === "satellite" && !satelliteAvailable)}
            aria-pressed={mode === value}
          ><Icon size={13} />{label}</button>
        ))}
      </div>

      <div className="map-details-control">
        <div><span><Layers3 size={13} /> MAP DETAILS</span><small>Natural Earth 1:110m</small></div>
        {(["country-boundaries", "admin1-boundaries", "city-labels"] as const).map((id) => {
          const layer = mapLayers[id];
          return <button
            key={id}
            type="button"
            className={layer.visible ? "active" : ""}
            aria-pressed={layer.visible}
            onClick={() => onToggleMapLayer(id)}
          ><i aria-hidden="true" /><span>{layer.displayName}</span>{layer.loadState === "loading" && <LoaderCircle className="spin" size={11} />}{layer.loadState === "error" && <b>ERROR</b>}</button>;
        })}
      </div>

      <form className="location-search" onSubmit={search}>
        <label htmlFor="earth-location-search">SEARCH LOCATION</label>
        <div><input id="earth-location-search" maxLength={120} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City, region, country..." /><button type="submit" disabled={!query.trim() || searching} aria-label="Search geographic locations">{searching ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />}</button></div>
      </form>

      {searching && <p className="explorer-status">SEARCHING EARTH...</p>}
      {searchError && <p className="explorer-error">{searchError}</p>}
      {results.length > 0 && <div className="location-results">{results.map((result) => (
        <button key={result.id} type="button" onClick={() => chooseResult(result)}>
          <span><strong>{result.primaryName}</strong><small>{result.secondaryName}</small></span>
          <b>{result.latitude.toFixed(3)}, {result.longitude.toFixed(3)}</b>
        </button>
      ))}</div>}

      {showSelectedLocationDetails && !locationIsPrimary && (selectedLocation
        ? <LocationDetailsCard selectedLocation={selectedLocation} onSetObserver={onSetObserver} onClear={clear} />
        : <div className="selected-location"><div className="explorer-empty"><Globe2 size={20} /><p>Click the globe or search for a location.</p></div></div>)}

      <div className="scale-readout"><span>VIEW SCALE</span><strong>{scaleLabel}</strong></div>
      <div className="geocode-attribution">Location data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · context by <a href="https://www.bigdatacloud.com/" target="_blank" rel="noreferrer">BigDataCloud</a></div>
    </section>
  );
}