"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Check, ChevronRight, CircleHelp, Crosshair,
  Database, Gauge, LocateFixed, Pause, Play, RotateCcw, Search, Satellite, X,
} from "lucide-react";
import type { SatRec } from "satellite.js";
import type {
  CatalogResponse, EarthViewMode, ObserverLocation, OmmRecord, OrbitalCharacteristics,
  PredictedPass, PropagatedState, ReverseGeocodeResponse, SatelliteCatalogEntry, SelectedEarthLocation,
} from "@/types/orbital";
import {
  calculatePasses, createSatRecFromOmm, generateOrbitPath,
  getOrbitalCharacteristics, propagateSatellite,
} from "@/lib/orbital/engine";
import { formatCoordinate, formatDuration, formatSimulationDelta, formatUtc } from "@/lib/utils/format";
import BrandGlobe from "@/components/dashboard/brand-globe";
import EarthExplorerPanel from "@/components/earth-explorer/earth-explorer-panel";
import GlossaryTerm from "@/components/ui/glossary-term";

const EarthScene = dynamic(() => import("@/components/globe/earth-scene"), {
  ssr: false,
  loading: () => <div className="globe-loading">INITIALIZING VISUALIZATION</div>,
});

const DEFAULT_OBSERVER: ObserverLocation = {
  label: "York, Pennsylvania",
  latitude: 39.9626,
  longitude: -76.7277,
  altitudeKm: 0.1,
};

type MobileInfoTab = "location" | "satellites" | "layers";

const HEALTHY_FEED_CHECK_MS = 5 * 60_000;
const DEGRADED_FEED_RETRY_MS = 60_000;

const GLOSSARY = {
  activeCatalog: "How many active space objects are in the list currently loaded by the dashboard. It is not a count of everything ever launched.",
  leo: "Low Earth orbit: satellites circling fairly close to Earth. This dashboard calls an orbit LEO when its highest point is 2,000 km or lower. The ISS is in LEO.",
  meo: "Medium Earth orbit: the region above low orbits but below the roughly 35,786 km geostationary region. Many GPS and navigation satellites fly here.",
  geo: "Satellites that take about one day to circle Earth, making them appear to stay over or near the same part of the planet. The dashboard allows a small range around that ideal orbit.",
  derived: "Numbers the dashboard works out from the satellite's published orbit data. They are calculations, not direct measurements from the spacecraft.",
  inclination: "How tilted the orbit is compared with Earth's equator. 0° follows the equator; 90° passes over the poles.",
  eccentricity: "How round or stretched the orbit is. A value near 0 means almost circular; a larger value means a more oval-shaped path.",
  meanMotion: "How many full trips the satellite makes around Earth each day. For example, 15.5 means about fifteen and a half orbits per day.",
  period: "How long the satellite takes to complete one full lap around Earth.",
  perigee: "The point in the orbit where the satellite comes closest to Earth.",
  apogee: "The point in the orbit where the satellite is farthest from Earth.",
} as const;

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <div className="metric"><span>{label}</span><strong>{value} {unit && <small>{unit}</small>}</strong></div>;
}

function LoadingScreen({ ready = false, onStart }: { ready?: boolean; onStart?: () => void }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  const startupSteps = [
    { text: "Initializing SGP4 engine", startMs: 820, durationMs: 620 },
    { text: "Fetching current GP elements", startMs: 1540, durationMs: 860 },
    { text: "Preparing visualization", startMs: 2560, durationMs: 760 },
  ] as const;

  const totalSequenceMs = 4200;
  const progress = Math.min(100, Math.round((elapsedMs / totalSequenceMs) * 100));
  const sequenceStep = elapsedMs >= 320 ? 1 : 0;
  const typedSteps = startupSteps.map((step) => {
    if (elapsedMs < step.startMs) {
      return 0;
    }

    const typedRatio = Math.min(1, (elapsedMs - step.startMs) / step.durationMs);
    return Math.min(step.text.length, Math.ceil(typedRatio * step.text.length));
  });
  const sequenceComplete = typedSteps.every((typedLength, index) => typedLength >= startupSteps[index].text.length) && progress >= 100;
  const viewerReady = ready && sequenceComplete;

  useEffect(() => {
    const startTime = performance.now();
    const timer = window.setInterval(() => {
      const nextElapsed = Math.min(totalSequenceMs, performance.now() - startTime);
      setElapsedMs(nextElapsed);

      if (nextElapsed >= totalSequenceMs) {
        window.clearInterval(timer);
      }
    }, 50);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main className="loading-screen">
      <div className={`loader-orbit startup-reveal ${sequenceStep >= 1 ? "is-visible" : ""}`}><BrandGlobe loading /></div>
      <p className={`eyebrow startup-reveal ${elapsedMs >= 540 ? "is-visible" : ""}`}>YTS ORBITAL / STARTUP SEQUENCE</p>
      <h1 className={`startup-reveal startup-headline ${elapsedMs >= 720 ? "is-visible" : ""}`}>{ready ? "ORBITAL CATALOG READY" : "INITIALIZING ORBITAL CATALOG"}</h1>
      <div className="loading-steps">
        {startupSteps.map((step, index) => {
          const typedLength = typedSteps[index];
          const isVisible = typedLength > 0;
          const isComplete = typedLength >= step.text.length;

          return (
            <span key={step.text} className={`startup-step ${isVisible ? "is-visible" : ""} ${isComplete ? "is-complete" : ""}`}>
              <Check size={14} />
              <span className="startup-step__text">
                {step.text.slice(0, typedLength)}
                {isVisible && !isComplete && <i className="startup-cursor" aria-hidden="true" />}
              </span>
            </span>
          );
        })}
      </div>
      {ready && <>
        <p className={`loading-copy startup-reveal ${elapsedMs >= 3320 ? "is-visible" : ""}`}>The catalog is loaded. Start the viewer when you are ready.</p>
        <button className={`loading-start-button ${viewerReady ? "is-ready" : ""}`} onClick={onStart} aria-label="Start viewer" disabled={!viewerReady}>
          <span className="loading-start-button__prompt" aria-hidden="true">
            <span>MISSION CONTROL</span>
            <span className="loading-start-button__status">{viewerReady ? "LAUNCH AUTHORIZATION READY" : `SYSTEM LOAD ${progress}%`}</span>
          </span>
          <span className="loading-start-button__core">
            <span className="loading-start-button__label">ENTER VIEWER</span>
            <ChevronRight size={16} />
          </span>
          <span className="loading-start-button__bar" aria-hidden="true"><b style={{ width: `${progress}%` }} /></span>
        </button>
      </>}
    </main>
  );
}

function GuideDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="about-drawer guide-drawer" aria-label="How to use YTS Orbital" onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Close guide"><X /></button>
        <p className="eyebrow">HOW TO / LEARN / METHODOLOGY</p>
        <h2>YTS ORBITAL GUIDE</h2>
        <p className="guide-intro">Use the dashboard to follow active satellites, explore Earth, move through simulation time, and learn how an orbit behaves.</p>

        <nav className="guide-jump-links" aria-label="Guide sections">
          <a href="#guide-start">START HERE</a><a href="#guide-globe">GLOBE</a><a href="#guide-readouts">READOUTS</a><a href="#guide-method">METHOD</a>
        </nav>

        <section id="guide-start" className="guide-section">
          <p className="eyebrow">START HERE</p><h3>Four useful first steps</h3>
          <ol className="guide-steps">
            <li><strong>Choose a satellite</strong><span>Use Featured or search by name or NORAD catalog number.</span></li>
            <li><strong>Move around Earth</strong><span>Choose Earth, drag the globe, scroll to zoom, or select a city pin.</span></li>
            <li><strong>Follow the spacecraft</strong><span>Choose Satellite to lock the camera to the selected object as Earth moves below it.</span></li>
            <li><strong>Change time</strong><span>Use the Time Machine to preview where the satellite was or will be. NOW returns to live time.</span></li>
          </ol>
        </section>

        <section id="guide-globe" className="guide-section">
          <p className="eyebrow">GLOBE MODES</p><h3>What each view does</h3>
          <dl className="guide-definitions">
            <div><dt>Earth</dt><dd>Free globe exploration. Drag and zoom without following a spacecraft.</dd></div>
            <div><dt>Location</dt><dd>Focuses the camera on a searched or clicked place and shows local geographic information.</dd></div>
            <div><dt>Satellite</dt><dd>Keeps the selected spacecraft in view while its position changes.</dd></div>
          </dl>
        </section>

        <section id="guide-readouts" className="guide-section">
          <p className="eyebrow">READING THE DASHBOARD</p><h3>Plain-language orientation</h3>
          <dl className="guide-definitions">
            <div><dt>Orbit characteristics</dt><dd>Describe the path: its height, tilt, roundness, and how long one lap takes.</dd></div>
            <div><dt>Upcoming passes</dt><dd>Times when the satellite rises above and later drops below the observer&apos;s horizon. A higher maximum elevation means a higher pass across the sky.</dd></div>
            <div><dt>Element age</dt><dd>How old the published orbit information is. Newer information usually gives a better short-term estimate.</dd></div>
            <div><dt>Question marks</dt><dd>Hover, focus, or tap any marked term for a short explanation. Use the X to close it.</dd></div>
          </dl>
        </section>

        <section id="guide-method" className="guide-section">
          <p className="eyebrow">METHOD / LIMITS</p><h3>Where the positions come from</h3>
          <p>YTS Orbital loads public CelesTrak orbital elements and uses the SGP4 model to estimate a satellite&apos;s position at the selected time.</p>
          <div className="method-stack"><span>CelesTrak GP</span><ChevronRight /><span>OMM elements</span><ChevronRight /><span>SGP4</span><ChevronRight /><span>Earth position</span></div>
          <h3>What the app does not know</h3>
          <p>This is calculated orbital position, not live spacecraft telemetry. The app does not know payload, communications, propulsion, or hardware health and is not intended for collision avoidance, navigation, launch, or flight safety.</p>
        </section>

        <div className="guide-actions"><a className="primary-button" href="https://celestrak.org" target="_blank" rel="noreferrer">CelesTrak data source <ChevronRight size={15} /></a><a href="https://yorktechservices.com" target="_blank" rel="noreferrer">York Tech Services <ChevronRight size={14} /></a></div>
      </aside>
    </div>
  );
}

function GlobeSelectionSummary({ location }: { location: SelectedEarthLocation | null }) {
  if (!location) return null;
  return (
    <div className="globe-selection-summary" title={location.displayName}>
      <Crosshair size={15} />
      <div><span>EARTH EXPLORER · {location.lookupStatus === "loading" ? "IDENTIFYING LOCATION" : location.details?.contextLabel ?? (location.source === "search" ? "SEARCH RESULT" : "GLOBE SELECTION")}</span><strong>{location.details?.primaryName ?? location.displayName ?? "Selected coordinate"}{location.details?.region ? ` · ${location.details.region}` : ""}{location.details?.country ? ` · ${location.details.country}` : ""}</strong></div>
      <b>{formatCoordinate(location.latitude, "N", "S")} · {formatCoordinate(location.longitude, "E", "W")}</b>
    </div>
  );
}

function SearchPanel({
  query,
  results,
  onQueryChange,
  onClear,
  onSelectSatellite,
}: {
  query: string;
  results: SatelliteCatalogEntry[];
  onQueryChange: (value: string) => void;
  onClear: () => void;
  onSelectSatellite: (entry: SatelliteCatalogEntry) => void;
}) {
  return (
    <section className="panel search-panel">
      <p className="eyebrow">ACTIVE OBJECT CATALOG</p><h2>SPACECRAFT SELECT</h2>
      <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Name, NORAD ID, designator..." aria-label="Search spacecraft" />{query && <button type="button" onClick={onClear} aria-label="Clear search"><X size={14} /></button>}</div>
      {query && <div className="search-results">{results.map((entry) => <button type="button" key={entry.noradId} onClick={() => onSelectSatellite(entry)}><span>{entry.name}<small>{entry.objectId || "NO DESIGNATOR"}</small></span><b>{entry.noradId}</b></button>)}{!results.length && <p>No matching active objects.</p>}</div>}
    </section>
  );
}

function FeaturedPanel({ featured, selectedId, onSelectSatellite }: {
  featured: SatelliteCatalogEntry[];
  selectedId: number | null;
  onSelectSatellite: (entry: SatelliteCatalogEntry) => void;
}) {
  return (
    <section className="panel featured-panel">
      <div className="panel-heading"><div><p className="eyebrow">QUICK ACCESS</p><h2>FEATURED</h2></div><Satellite size={18} /></div>
      {featured.map((entry) => <button type="button" className={entry.noradId === selectedId ? "active" : ""} key={entry.noradId} onClick={() => onSelectSatellite(entry)}><span><i />{entry.name}<small>NORAD {entry.noradId}</small></span><ChevronRight size={15} /></button>)}
    </section>
  );
}

function IdentityPanel({ selected }: { selected: OmmRecord }) {
  return (
    <section className="panel identity-panel">
      <p className="eyebrow">SELECTED OBJECT</p><h1>{selected.OBJECT_NAME}</h1><div className="norad-chip">NORAD {selected.NORAD_CAT_ID}</div>
      <dl><div><dt>International designator</dt><dd>{selected.OBJECT_ID || "UNAVAILABLE"}</dd></div><div><dt>Object type</dt><dd>{selected.OBJECT_TYPE || "UNSPECIFIED"}</dd></div><div><dt>Epoch</dt><dd>{formatUtc(selected.EPOCH, true)} UTC</dd></div><div><dt>Origin</dt><dd>{selected.COUNTRY_CODE || "UNSPECIFIED"}</dd></div></dl>
    </section>
  );
}

function SatelliteStatePanels({ state, characteristics, selected }: {
  state: PropagatedState | null;
  characteristics: OrbitalCharacteristics;
  selected: OmmRecord;
}) {
  return <>
    <section className="panel state-panel">
      <div className="panel-heading"><div><p className="eyebrow">CURRENT SOLUTION</p><h2>ORBITAL STATE</h2></div><Gauge size={18} /></div>
      {state ? <div className="metric-grid"><Metric label="LATITUDE" value={formatCoordinate(state.latitude, "N", "S")} /><Metric label="LONGITUDE" value={formatCoordinate(state.longitude, "E", "W")} /><Metric label="ALTITUDE" value={state.altitudeKm.toFixed(2)} unit="km" /><Metric label="VELOCITY" value={state.velocityKmS.toFixed(3)} unit="km/s" /></div> : <p className="propagation-error">A valid state could not be propagated from these elements.</p>}
    </section>
    <section className="panel characteristics-panel">
      <div className="panel-heading"><div><p className="eyebrow"><GlossaryTerm label="DERIVED PARAMETERS" definition={GLOSSARY.derived} /></p><h2>ORBIT CHARACTERISTICS</h2></div><GlossaryTerm className="orbit-class" label={characteristics.orbitClass} definition={GLOSSARY[characteristics.orbitClass.toLowerCase() as "leo" | "meo" | "geo"] ?? "A highly stretched orbit. The satellite comes much closer to Earth on one part of its path and travels much farther away on another."} /></div>
      <dl><div><dt><GlossaryTerm label="Inclination" definition={GLOSSARY.inclination} /></dt><dd>{selected.INCLINATION.toFixed(4)}°</dd></div><div><dt><GlossaryTerm label="Eccentricity" definition={GLOSSARY.eccentricity} /></dt><dd>{selected.ECCENTRICITY.toFixed(7)}</dd></div><div><dt><GlossaryTerm label="Mean motion" definition={GLOSSARY.meanMotion} /></dt><dd>{selected.MEAN_MOTION.toFixed(6)} rev/day</dd></div><div><dt><GlossaryTerm label="Period" definition={GLOSSARY.period} /></dt><dd>{characteristics.periodMinutes.toFixed(2)} min</dd></div><div><dt><GlossaryTerm label="Perigee altitude" definition={GLOSSARY.perigee} /></dt><dd>{characteristics.perigeeAltitudeKm.toFixed(1)} km</dd></div><div><dt><GlossaryTerm label="Apogee altitude" definition={GLOSSARY.apogee} /></dt><dd>{characteristics.apogeeAltitudeKm.toFixed(1)} km</dd></div></dl>
    </section>
    <QualityPanel characteristics={characteristics} eccentricity={selected.ECCENTRICITY} />
  </>;
}

function MethodologyPanel({ onOpenGuide }: { onOpenGuide: () => void }) {
  return <section className="panel methodology-card"><div><p className="eyebrow">METHOD / SOURCE</p><h2>PUBLIC ELEMENTS → ORBITAL STATE</h2></div><p>Positions are computed from cached CelesTrak GP orbital elements using SGP4. ECI output is transformed into Earth-fixed and geodetic coordinates locally in your browser.</p><button type="button" onClick={onOpenGuide}>View methodology <ChevronRight size={14} /></button></section>;
}

function EarthOnlyScreen({
  message, retry, clock, observer, selectedLocation, mode, scaleLabel,
  showBanner, onDismissBanner, onModeChange, onLocationSelect, onClear, onSetObserver, onScaleChange,
}: {
  message: string;
  retry: () => void;
  clock: Date;
  observer: ObserverLocation;
  selectedLocation: SelectedEarthLocation | null;
  mode: EarthViewMode;
  scaleLabel: string;
  showBanner: boolean;
  onDismissBanner: () => void;
  onModeChange: (mode: EarthViewMode) => void;
  onLocationSelect: (location: SelectedEarthLocation) => void;
  onClear: () => void;
  onSetObserver: () => void;
  onScaleChange: (scale: string) => void;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <div className="app-shell earth-only-mode">
      <header className="topbar">
        <div className="brand-mark"><BrandGlobe /><div><strong>YTS ORBITAL</strong><span>Satellite Operations & Orbital Intelligence</span></div></div>
        <div className="header-status"><span className="data-status offline"><i /> SATELLITE FEED OFFLINE</span><span className="utc-clock">{formatUtc(clock)} <small>UTC</small></span><button className="icon-button" onClick={() => setGuideOpen(true)} aria-label="Open how-to and learning guide"><CircleHelp size={18} /></button></div>
      </header>

      {showBanner && <section className="degraded-banner" role="status">
        <div><AlertTriangle size={18} /><span><strong>EARTH EXPLORER AVAILABLE</strong>{message} Retrying automatically every minute.</span></div>
        <div className="feed-banner-actions"><button onClick={retry}><RotateCcw size={13} /> RETRY NOW</button><button onClick={onDismissBanner}><Check size={13} /> ACKNOWLEDGE</button></div>
      </section>}

      <main className="earth-only-grid">
        <aside className="left-rail">
          <EarthExplorerPanel
            mode={mode}
            selectedLocation={selectedLocation}
            scaleLabel={scaleLabel}
            satelliteAvailable={false}
            onModeChange={onModeChange}
            onLocationSelect={onLocationSelect}
            onClear={onClear}
            onSetObserver={onSetObserver}
          />
        </aside>
        <section className="center-stage">
          <div className="globe-header">
            <div><p className="eyebrow">GEOSPATIAL VISUALIZATION / EARTH FIXED</p><h2>EARTH EXPLORER</h2></div>
            <GlobeSelectionSummary location={selectedLocation} />
            <span className="solution-error"><i /> SATELLITE DATA OFFLINE</span>
          </div>
          <div className="globe-wrap earth-only-globe">
            <EarthScene state={null} orbitPath={[]} satelliteName="Earth Explorer" observer={observer} selectedLocation={selectedLocation} viewMode={mode} onLocationSelect={onLocationSelect} onScaleChange={onScaleChange} />
            {selectedLocation && <button className="target-exit-button" onClick={onClear}><RotateCcw size={14} /> RETURN TO EARTH</button>}
          </div>
        </section>
      </main>

      <footer><span>YTS Orbital v0.1</span><span>Earth Explorer operating independently</span><a href="https://yorktechservices.com" target="_blank" rel="noreferrer">York Tech Services</a><span>Satellite data temporarily unavailable</span></footer>
      {guideOpen && <GuideDrawer onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

function ObserverPanel({ observer, setObserver, passes }: {
  observer: ObserverLocation;
  setObserver: (value: ObserverLocation) => void;
  passes: PredictedPass[];
}) {
  const updateNumber = (key: "latitude" | "longitude" | "altitudeKm", value: string) => {
    const number = Number(value);
    if (Number.isFinite(number)) setObserver({ ...observer, [key]: number });
  };
  return (
    <section className="panel observer-panel">
      <div className="panel-heading"><div><p className="eyebrow">GROUND SEGMENT</p><h2>UPCOMING GEOMETRIC PASSES</h2></div><LocateFixed size={18} /></div>
      <div className="observer-fields">
        <label className="wide">Observer<input value={observer.label} onChange={(event) => setObserver({ ...observer, label: event.target.value })} /></label>
        <label>Latitude<input type="number" step="0.0001" value={observer.latitude} onChange={(event) => updateNumber("latitude", event.target.value)} /></label>
        <label>Longitude<input type="number" step="0.0001" value={observer.longitude} onChange={(event) => updateNumber("longitude", event.target.value)} /></label>
        <label>Altitude km<input type="number" step="0.1" value={observer.altitudeKm} onChange={(event) => updateNumber("altitudeKm", event.target.value)} /></label>
      </div>
      <div className="pass-list">
        <div className="pass-row pass-header"><span>AOS UTC</span><span>MAX EL</span><span>LOS UTC</span><span>DURATION</span></div>
        {passes.length ? passes.slice(0, 4).map((pass) => (
          <div className="pass-row" key={pass.aos}>
            <span>{formatUtc(pass.aos)}</span><strong>{pass.maxElevationDeg.toFixed(1)}°</strong><span>{formatUtc(pass.los)}</span><span>{formatDuration(pass.durationSeconds)}</span>
          </div>
        )) : <p className="empty-state">No passes above 10° in the next 24 hours.</p>}
      </div>
      <p className="fine-print">Geometric prediction only. Weather, lighting, terrain, brightness, and optical visibility are not considered.</p>
    </section>
  );
}

function QualityPanel({ characteristics, eccentricity }: { characteristics: OrbitalCharacteristics; eccentricity: number }) {
  const age = characteristics.elementAgeHours;
  return (
    <section className="panel quality-panel">
      <div className="panel-heading"><div><p className="eyebrow">ANALYSIS</p><h2>ORBITAL DATA QUALITY</h2></div><Activity size={18} /></div>
      <div className="quality-item pass"><span>PASS</span><p>Propagation successful</p></div>
      <div className="quality-item info"><span>INFO</span><p>{characteristics.orbitClass} · {eccentricity < 0.01 ? "Near-circular orbit" : "Elliptical orbit"}</p></div>
      <div className={`quality-item ${age > 72 ? "high" : age > 24 ? "warning" : "pass"}`}>
        <span>{age > 72 ? "HIGH" : age > 24 ? "WARNING" : "PASS"}</span>
        <p>Elements updated {age < 1 ? "less than 1h" : `${Math.round(age)}h`} ago</p>
      </div>
      <p className="telemetry-notice">Orbital state derived from public orbital elements — not spacecraft telemetry.</p>
    </section>
  );
}

export default function OrbitalDashboard() {
  const [catalogData, setCatalogData] = useState<CatalogResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<OmmRecord | null>(null);
  const [query, setQuery] = useState("");
  const [simulationTime, setSimulationTime] = useState(() => new Date());
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLive, setIsLive] = useState(true);
  const [observer, setObserverState] = useState<ObserverLocation>(DEFAULT_OBSERVER);
  const [clock, setClock] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [outageAcknowledged, setOutageAcknowledged] = useState(false);
  const [feedRestoredNotice, setFeedRestoredNotice] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [viewerStarted, setViewerStarted] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [earthViewMode, setEarthViewMode] = useState<EarthViewMode>("satellite");
  const [selectedEarthLocation, setSelectedEarthLocation] = useState<SelectedEarthLocation | null>(null);
  const [returnViewMode, setReturnViewMode] = useState<EarthViewMode>("satellite");
  const [earthScale, setEarthScale] = useState("GLOBAL VIEW");
  const [mobileInfoTab, setMobileInfoTab] = useState<MobileInfoTab>("satellites");
  const locationRequestId = useRef(0);
  const feedWasUnavailable = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("yts-orbital-observer");
    if (!saved) return;
    const frame = window.requestAnimationFrame(() => {
      try { setObserverState(JSON.parse(saved) as ObserverLocation); } catch { localStorage.removeItem("yts-orbital-observer"); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setObserver = (value: ObserverLocation) => {
    setObserverState(value);
    localStorage.setItem("yts-orbital-observer", JSON.stringify(value));
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as CatalogResponse | { error: string };
        if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "Catalog request failed");
        setCatalogData(data);
        setSelectedId((current) => current ?? data.featured.find((item) => item.noradId === 25544)?.noradId ?? data.catalog[0]?.noradId ?? null);
        if (feedWasUnavailable.current) {
          feedWasUnavailable.current = false;
          setFeedRestoredNotice(true);
        }
        setError(null);
      })
      .catch((reason: Error) => {
        if (reason.name === "AbortError") return;
        if (!feedWasUnavailable.current) setOutageAcknowledged(false);
        feedWasUnavailable.current = true;
        setFeedRestoredNotice(false);
        setError(reason.message);
      });
    return () => controller.abort();
  }, [requestKey]);

  useEffect(() => {
    const interval = window.setInterval(
      () => setRequestKey((key) => key + 1),
      error ? DEGRADED_FEED_RETRY_MS : HEALTHY_FEED_CHECK_MS,
    );
    return () => window.clearInterval(interval);
  }, [error]);

  useEffect(() => {
    const retryWhenOnline = () => setRequestKey((key) => key + 1);
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible" && feedWasUnavailable.current) retryWhenOnline();
    };
    window.addEventListener("online", retryWhenOnline);
    document.addEventListener("visibilitychange", retryWhenVisible);
    return () => {
      window.removeEventListener("online", retryWhenOnline);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/satellites/${selectedId}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as OmmRecord | { error: string };
        if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "Satellite request failed");
        setSelected(data);
      })
      .catch((reason: Error) => {
        if (reason.name === "AbortError") return;
        if (!feedWasUnavailable.current) setOutageAcknowledged(false);
        feedWasUnavailable.current = true;
        setFeedRestoredNotice(false);
        setError(reason.message);
      });
    return () => controller.abort();
  }, [selectedId, requestKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setClock(now);
      if (isLive) setSimulationTime(now);
      else if (playbackSpeed > 0) setSimulationTime((time) => new Date(time.getTime() + playbackSpeed * 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLive, playbackSpeed]);

  const satrec = useMemo<SatRec | null>(() => selected ? createSatRecFromOmm(selected) : null, [selected]);
  const state = useMemo<PropagatedState | null>(() => satrec ? propagateSatellite(satrec, simulationTime) : null, [satrec, simulationTime]);
  const characteristics = useMemo(() => selected ? getOrbitalCharacteristics(selected, clock) : null, [selected, clock]);
  const orbitAnchor = Math.floor(simulationTime.getTime() / 900_000);
  const orbitPath = useMemo(() => satrec && characteristics
    ? generateOrbitPath(satrec, new Date(orbitAnchor * 900_000), characteristics.periodMinutes)
    : [], [satrec, characteristics, orbitAnchor]);
  const passes = useMemo(() => satrec ? calculatePasses(satrec, observer) : [], [satrec, observer]);

  const results = useMemo(() => {
    if (!catalogData || !query.trim()) return [];
    const normalized = query.trim().toLowerCase();
    return catalogData.catalog.filter((item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.objectId.toLowerCase().includes(normalized) ||
      item.noradId.toString().includes(normalized)
    ).slice(0, 24);
  }, [catalogData, query]);

  const selectEarthLocation = async (location: SelectedEarthLocation) => {
    const requestId = ++locationRequestId.current;
    if (!selectedEarthLocation) setReturnViewMode(earthViewMode === "location" ? "satellite" : earthViewMode);
    setSelectedEarthLocation({ ...location, lookupStatus: "loading", details: undefined });
    setEarthViewMode("location");
    setMobileInfoTab("location");
    try {
      const hint = location.labelHint ?? location.displayName;
      const response = await fetch(`/api/reverse-geocode?lat=${location.latitude}&lon=${location.longitude}${hint ? `&hint=${encodeURIComponent(hint)}` : ""}`);
      const payload = await response.json() as ReverseGeocodeResponse | { error: string };
      if (!response.ok || "error" in payload) throw new Error("Geographic context unavailable");
      if (locationRequestId.current !== requestId) return;
      setSelectedEarthLocation({
        ...location,
        displayName: payload.displayName,
        lookupStatus: "resolved",
        details: payload.details,
      });
    } catch {
      if (locationRequestId.current !== requestId) return;
      setSelectedEarthLocation({ ...location, lookupStatus: "unavailable" });
    }
  };
  const clearEarthLocation = () => {
    locationRequestId.current += 1;
    setSelectedEarthLocation(null);
    setEarthViewMode(error ? "earth" : returnViewMode);
  };
  const setSelectedAsObserver = () => {
    if (!selectedEarthLocation) return;
    setObserver({
      label: selectedEarthLocation.displayName ?? "Earth Explorer selection",
      latitude: selectedEarthLocation.latitude,
      longitude: selectedEarthLocation.longitude,
      altitudeKm: observer.altitudeKm,
    });
  };

  if (error) return <EarthOnlyScreen
    message={error}
    retry={() => { setSelected(null); setRequestKey((key) => key + 1); }}
    clock={clock}
    observer={observer}
    selectedLocation={selectedEarthLocation}
    mode={earthViewMode === "satellite" ? "earth" : earthViewMode}
    scaleLabel={earthScale}
    showBanner={!outageAcknowledged}
    onDismissBanner={() => setOutageAcknowledged(true)}
    onModeChange={setEarthViewMode}
    onLocationSelect={selectEarthLocation}
    onClear={clearEarthLocation}
    onSetObserver={setSelectedAsObserver}
    onScaleChange={setEarthScale}
  />;
  if (!catalogData || !selected || !characteristics) return <LoadingScreen />;
  if (!viewerStarted) return <LoadingScreen ready onStart={() => setViewerStarted(true)} />;

  const deltaMs = simulationTime.getTime() - clock.getTime();
  const isSatelliteView = earthViewMode === "satellite";
  const selectSatellite = (entry: SatelliteCatalogEntry) => {
    setSelected(null);
    setSelectedId(entry.noradId);
    setQuery("");
    setEarthViewMode("satellite");
    setMobileInfoTab("satellites");
  };
  const changeEarthViewMode = (mode: EarthViewMode) => {
    setEarthViewMode(mode);
    setMobileInfoTab(mode === "satellite" ? "satellites" : "location");
  };
  const jump = (hours: number) => { setSimulationTime((time) => new Date(time.getTime() + hours * 3_600_000)); setIsLive(false); setPlaybackSpeed(0); };
  const returnLive = () => { setSimulationTime(new Date()); setIsLive(true); setPlaybackSpeed(1); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><BrandGlobe /><div><strong>YTS ORBITAL</strong><span>Satellite Operations & Orbital Intelligence</span></div></div>
        <div className="header-status"><span className="version">v0.1 R&D</span><span className="data-status"><i /> CELESTRAK GP · SGP4</span><span className="utc-clock">{formatUtc(clock)} <small>UTC</small></span><button className="icon-button" onClick={() => setAboutOpen(true)} aria-label="Open how-to and learning guide"><CircleHelp size={18} /></button></div>
      </header>

      {feedRestoredNotice && <section className="degraded-banner restored" role="status">
        <div><Check size={18} /><span><strong>SATELLITE FEED RESTORED</strong>Current orbital data is online and available.</span></div>
        <button onClick={() => setFeedRestoredNotice(false)}><Check size={13} /> ACKNOWLEDGE</button>
      </section>}

      <div className="stats-strip">
        <div><GlossaryTerm label="ACTIVE CATALOG" definition={GLOSSARY.activeCatalog} /><strong>{catalogData.statistics.total.toLocaleString()}</strong></div>
        <div><GlossaryTerm label="LEO" definition={GLOSSARY.leo} /><strong>{catalogData.statistics.leo.toLocaleString()}</strong></div>
        <div><GlossaryTerm label="MEO" definition={GLOSSARY.meo} /><strong>{catalogData.statistics.meo.toLocaleString()}</strong></div>
        <div><GlossaryTerm label="GEO / LIKE" definition={GLOSSARY.geo} /><strong>{catalogData.statistics.geo.toLocaleString()}</strong></div>
        <div className="source-age"><Database size={14} /><span>SERVER CACHED · 2H REVALIDATION</span></div>
      </div>

      <main className="console-grid">
        <aside className="left-rail">
          <SearchPanel query={query} results={results} onQueryChange={setQuery} onClear={() => setQuery("")} onSelectSatellite={selectSatellite} />
          <EarthExplorerPanel
            mode={earthViewMode}
            selectedLocation={selectedEarthLocation}
            scaleLabel={earthScale}
            onModeChange={changeEarthViewMode}
            onLocationSelect={selectEarthLocation}
            onClear={clearEarthLocation}
            onSetObserver={setSelectedAsObserver}
          />
          <FeaturedPanel featured={catalogData.featured} selectedId={selectedId} onSelectSatellite={selectSatellite} />
          <IdentityPanel selected={selected} />
        </aside>

        <section className="center-stage">
          <div className="globe-header">
            <div>
              <p className="eyebrow">{isSatelliteView ? "ORBITAL VISUALIZATION / EARTH FIXED" : "GEOSPATIAL VISUALIZATION / EARTH FIXED"}</p>
              <h2>{isSatelliteView ? selected.OBJECT_NAME : "EARTH EXPLORER"}</h2>
            </div>
            <GlobeSelectionSummary location={selectedEarthLocation} />
            {isSatelliteView && <span className={state ? "solution-good" : "solution-error"}><i /> {state ? "SGP4 SOLUTION NOMINAL" : "PROPAGATION ERROR"}</span>}
          </div>
          <div className="globe-wrap"><EarthScene state={state} orbitPath={orbitPath} satelliteName={selected.OBJECT_NAME} observer={observer} selectedLocation={selectedEarthLocation} viewMode={earthViewMode} onLocationSelect={selectEarthLocation} onScaleChange={setEarthScale} />{selectedEarthLocation && <button className="target-exit-button" onClick={clearEarthLocation}><RotateCcw size={14} /> RETURN TO {returnViewMode === "satellite" ? "ORBIT" : "EARTH VIEW"}</button>}{isSatelliteView && state && <div className="position-tag"><span>ALTITUDE</span><strong>{state.altitudeKm.toFixed(1)} km</strong></div>}</div>
          <section className="time-machine">
            <div className="time-title"><div><p className="eyebrow">TIME MACHINE</p><h2>SIMULATION TIME</h2></div><div className="sim-readout"><span className={isLive ? "live" : "sim"}>{isLive ? "LIVE" : `SIMULATION ${formatSimulationDelta(deltaMs)}`}</span><strong>{simulationTime.toISOString().replace("T", " ").slice(0, 19)} UTC</strong></div></div>
            <div className="time-controls"><button onClick={() => jump(-1)}>−1 HR</button><button className={isLive ? "active" : ""} onClick={returnLive}><Crosshair size={14} /> NOW</button><button onClick={() => jump(1)}>+1 HR</button><div className="playback"><button aria-label="Pause simulation" className={!playbackSpeed ? "active" : ""} onClick={() => { setPlaybackSpeed(0); setIsLive(false); }}><Pause size={14} /></button>{[1, 60, 300].map((speed) => <button key={speed} className={!isLive && playbackSpeed === speed ? "active" : ""} onClick={() => { setPlaybackSpeed(speed); setIsLive(false); }}><Play size={11} />{speed}x</button>)}</div></div>
            <div className="slider-wrap"><span>−6h</span><input aria-label="Simulation time offset" type="range" min="-6" max="6" step="0.05" value={Math.max(-6, Math.min(6, deltaMs / 3_600_000))} onChange={(event) => { setSimulationTime(new Date(Date.now() + Number(event.target.value) * 3_600_000)); setIsLive(false); setPlaybackSpeed(0); }} /><span>+6h</span></div>
          </section>
          <section className="panel mobile-info-panel" aria-label="Mobile information panel">
            <div className="mobile-info-tabs" role="tablist" aria-label="Mobile information sections">
              <button type="button" role="tab" className={mobileInfoTab === "location" ? "active" : ""} aria-selected={mobileInfoTab === "location"} onClick={() => setMobileInfoTab("location")}>LOCATION</button>
              <button type="button" role="tab" className={mobileInfoTab === "satellites" ? "active" : ""} aria-selected={mobileInfoTab === "satellites"} onClick={() => setMobileInfoTab("satellites")}>SATELLITES</button>
              <button type="button" role="tab" className={mobileInfoTab === "layers" ? "active" : ""} aria-selected={mobileInfoTab === "layers"} onClick={() => setMobileInfoTab("layers")}>LAYERS</button>
            </div>
            <div className={mobileInfoTab === "location" ? "mobile-info-pane active" : "mobile-info-pane"}><EarthExplorerPanel mode={earthViewMode} selectedLocation={selectedEarthLocation} scaleLabel={earthScale} onModeChange={changeEarthViewMode} onLocationSelect={selectEarthLocation} onClear={clearEarthLocation} onSetObserver={setSelectedAsObserver} /></div>
            <div className={mobileInfoTab === "satellites" ? "mobile-info-pane active" : "mobile-info-pane"}><div className="mobile-stack"><SearchPanel query={query} results={results} onQueryChange={setQuery} onClear={() => setQuery("")} onSelectSatellite={selectSatellite} /><FeaturedPanel featured={catalogData.featured} selectedId={selectedId} onSelectSatellite={selectSatellite} /><IdentityPanel selected={selected} /><SatelliteStatePanels state={state} characteristics={characteristics} selected={selected} /></div></div>
            <div className={mobileInfoTab === "layers" ? "mobile-info-pane active" : "mobile-info-pane"}><div className="mobile-stack"><ObserverPanel observer={observer} setObserver={setObserver} passes={passes} /><MethodologyPanel onOpenGuide={() => setAboutOpen(true)} /></div></div>
          </section>
        </section>

        <aside className="right-rail">
          <SatelliteStatePanels state={state} characteristics={characteristics} selected={selected} />
        </aside>
      </main>

      <div className="lower-grid"><ObserverPanel observer={observer} setObserver={setObserver} passes={passes} /><MethodologyPanel onOpenGuide={() => setAboutOpen(true)} /></div>

      <footer><span>YTS Orbital v0.1</span><a href="https://yorktechservices.com" target="_blank" rel="noreferrer">York Tech Services</a><a href="https://celestrak.org" target="_blank" rel="noreferrer">Orbital data provided by CelesTrak</a><span>Not for safety-critical operations</span></footer>

      {aboutOpen && <GuideDrawer onClose={() => setAboutOpen(false)} />}
    </div>
  );
}