export type MapLayerId = "country-boundaries" | "admin1-boundaries" | "city-labels";

export type MapLayerCategory = "boundaries" | "places";

export type MapLayerLoadState = "idle" | "loading" | "ready" | "error";

export interface MapLayerDefinition {
  id: MapLayerId;
  displayName: string;
  category: MapLayerCategory;
  body: "earth";
  defaultVisible: boolean;
  minCameraDistance: number;
  maxCameraDistance: number;
  dataSource: string;
  attribution: string;
  lazy: boolean;
  legend?: {
    color: string;
    lineStyle?: "solid" | "dashed";
  };
}

export interface MapLayerState extends MapLayerDefinition {
  visible: boolean;
  loadState: MapLayerLoadState;
  error?: string;
}

export const MAP_LAYER_DEFINITIONS: readonly MapLayerDefinition[] = [
  {
    id: "country-boundaries",
    displayName: "Country boundaries",
    category: "boundaries",
    body: "earth",
    defaultVisible: true,
    minCameraDistance: 2.4,
    maxCameraDistance: 10,
    dataSource: "Natural Earth 1:110m Admin 0 boundary lines",
    attribution: "Natural Earth (public domain)",
    lazy: true,
    legend: { color: "#69d9d5", lineStyle: "solid" },
  },
  {
    id: "admin1-boundaries",
    displayName: "States / provinces",
    category: "boundaries",
    body: "earth",
    defaultVisible: true,
    minCameraDistance: 2.4,
    maxCameraDistance: 4.9,
    dataSource: "Natural Earth 1:110m Admin 1 boundary lines",
    attribution: "Natural Earth (public domain)",
    lazy: true,
    legend: { color: "#559e9d", lineStyle: "solid" },
  },
  {
    id: "city-labels",
    displayName: "City labels",
    category: "places",
    body: "earth",
    defaultVisible: true,
    minCameraDistance: 2.4,
    maxCameraDistance: 10,
    dataSource: "Curated coordinates maintained by YTS Orbital",
    attribution: "YTS Orbital",
    lazy: false,
  },
] as const;

export type MapLayerStateById = Record<MapLayerId, MapLayerState>;

export function createInitialMapLayerState(): MapLayerStateById {
  return Object.fromEntries(MAP_LAYER_DEFINITIONS.map((definition) => [
    definition.id,
    {
      ...definition,
      visible: definition.defaultVisible,
      loadState: definition.lazy ? "idle" : "ready",
    },
  ])) as MapLayerStateById;
}

export function updateMapLayerState(
  state: MapLayerStateById,
  id: MapLayerId,
  update: Partial<Pick<MapLayerState, "visible" | "loadState" | "error">>,
): MapLayerStateById {
  return {
    ...state,
    [id]: {
      ...state[id],
      ...update,
    },
  };
}

export function isLayerUsefulAtDistance(layer: MapLayerDefinition, cameraDistance: number): boolean {
  return cameraDistance >= layer.minCameraDistance && cameraDistance <= layer.maxCameraDistance;
}