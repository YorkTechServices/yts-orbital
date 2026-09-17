import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NATURAL_EARTH_REVISION = "5.1.2";
const SOURCES = [
  {
    output: "admin0-boundaries-110m.json",
    dataset: "Natural Earth 1:110m Admin 0 boundary lines",
    url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_boundary_lines_land.geojson",
  },
  {
    output: "admin1-boundaries-110m.json",
    dataset: "Natural Earth 1:110m Admin 1 states and provinces lines",
    url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_1_states_provinces_lines.geojson",
  },
];

const outputDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/map-details");

function roundCoordinate(value) {
  return Math.round(value * 100) / 100;
}

function splitAtAntimeridian(coordinates) {
  const segments = [];
  let segment = [];
  let previousLongitude;

  for (const coordinate of coordinates) {
    const longitude = roundCoordinate(coordinate[0]);
    const latitude = roundCoordinate(coordinate[1]);
    if (previousLongitude !== undefined && Math.abs(longitude - previousLongitude) > 180) {
      if (segment.length > 1) segments.push(segment);
      segment = [];
    }
    const previous = segment.at(-1);
    if (!previous || previous[0] !== longitude || previous[1] !== latitude) {
      segment.push([longitude, latitude]);
    }
    previousLongitude = longitude;
  }
  if (segment.length > 1) segments.push(segment);
  return segments;
}

function densifyLine(line) {
  const result = [line[0]];
  for (let index = 1; index < line.length; index += 1) {
    const [startLongitude, startLatitude] = line[index - 1];
    const [endLongitude, endLatitude] = line[index];
    const steps = Math.max(1, Math.ceil(Math.max(
      Math.abs(endLongitude - startLongitude),
      Math.abs(endLatitude - startLatitude),
    ) / 2));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      result.push([
        roundCoordinate(startLongitude + (endLongitude - startLongitude) * ratio),
        roundCoordinate(startLatitude + (endLatitude - startLatitude) * ratio),
      ]);
    }
  }
  return result;
}

function extractLines(geoJson) {
  return geoJson.features.flatMap(({ geometry }) => {
    if (!geometry) return [];
    if (geometry.type === "LineString") return splitAtAntimeridian(geometry.coordinates).map(densifyLine);
    if (geometry.type === "MultiLineString") return geometry.coordinates.flatMap(splitAtAntimeridian).map(densifyLine);
    throw new Error(`Unsupported geometry type: ${geometry.type}`);
  });
}

await mkdir(outputDirectory, { recursive: true });

for (const source of SOURCES) {
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`Unable to download ${source.url}: ${response.status}`);
  const geoJson = await response.json();
  const output = {
    dataset: source.dataset,
    version: NATURAL_EARTH_REVISION,
    source: source.url,
    license: "Natural Earth data is in the public domain",
    transformation: "Line geometries only; coordinates rounded to 0.01 degrees; adjacent duplicates removed; antimeridian crossings split; segments densified to at most 2 degrees",
    lines: extractLines(geoJson),
  };
  const outputPath = path.join(outputDirectory, source.output);
  await writeFile(outputPath, `${JSON.stringify(output)}\n`, "utf8");
  console.log(`${source.output}: ${output.lines.length} line segments`);
}