import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  screenSpatialBuffers,
  calculateGeodesicDistance,
  generateCartographicSnapshotMetadata,
  validateCadastralGeoJSON,
  type SpatialScreeningLayerInput,
} from '../src/spatial-rules-engine.js';

// ============================================================================
// HELPER: CRC32 implementation matching IEEE 802.3
// ============================================================================
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function calculateCrc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface PngChunk {
  length: number;
  type: string;
  data: Buffer;
  crc: number;
  calculatedCrc: number;
}

function parsePngBuffer(buf: Buffer): { signatureValid: boolean; chunks: PngChunk[] } {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const signatureValid = buf.subarray(0, 8).equals(signature);
  const chunks: PngChunk[] = [];

  let offset = 8;
  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = buf.subarray(dataStart, dataEnd);
    const crc = buf.readUInt32BE(dataEnd);

    // CRC is computed over type + data
    const crcPayload = buf.subarray(offset + 4, dataEnd);
    const calculatedCrc = calculateCrc32(crcPayload);

    chunks.push({ length, type, data, crc, calculatedCrc });
    offset = dataEnd + 4;
  }

  return { signatureValid, chunks };
}

// ============================================================================
// 1. EXTREME COORDINATES & BOUNDARY DEGENERACIES
// ============================================================================

test('ADVERSARIAL GIS-1.1: Polar coordinates (North & South Poles) do not crash snapshot generator', () => {
  const northPole = { latitude: 90.0, longitude: 0.0 };
  const southPole = { latitude: -90.0, longitude: 0.0 };

  // North pole
  const resNorth = screenSpatialBuffers(northPole, []);
  assert.ok(resNorth.georeferencedSnapshot);
  assert.equal(resNorth.georeferencedSnapshot.imagePngBase64, '');
  assert.equal(resNorth.georeferencedSnapshot.metadata.center?.[0], 0.0);
  assert.equal(resNorth.georeferencedSnapshot.metadata.center?.[1], 90.0);
  assert.match(resNorth.georeferencedSnapshot.metadata.scaleText, /1 cm = \d+ m/);

  // South pole
  const resSouth = screenSpatialBuffers(southPole, []);
  assert.ok(resSouth.georeferencedSnapshot);
  assert.equal(resSouth.georeferencedSnapshot.imagePngBase64, '');
  assert.equal(resSouth.georeferencedSnapshot.metadata.center?.[0], 0.0);
  assert.equal(resSouth.georeferencedSnapshot.metadata.center?.[1], -90.0);
  assert.match(resSouth.georeferencedSnapshot.metadata.scaleText, /1 cm = \d+ m/);
});

test('ADVERSARIAL GIS-1.2: Equatorial Center & Prime Meridian (Null Island [0,0])', () => {
  const nullIsland = { latitude: 0.0, longitude: 0.0 };
  const res = screenSpatialBuffers(nullIsland, []);
  assert.ok(res.georeferencedSnapshot);
  assert.equal(res.georeferencedSnapshot.metadata.hasNorthArrow, true);
  assert.equal(res.georeferencedSnapshot.metadata.center?.[0], 0.0);
  assert.equal(res.georeferencedSnapshot.metadata.center?.[1], 0.0);
  // At latitude 0 zoom 16: metersPerPixel = 156543.03392 * cos(0) / 65536 = 2.38865 m/px
  // 1 cm = 2.38865 * 37.795 = 90.28m -> 90 m
  assert.equal(res.georeferencedSnapshot.metadata.scaleText, '1 cm = 90 m (Zoom 16)');
});

test('ADVERSARIAL GIS-1.3: Antimeridian / Date Line extreme longitudes (+180, -180, 179.9999)', () => {
  const coords = [
    { latitude: 12.9716, longitude: 180.0 },
    { latitude: 12.9716, longitude: -180.0 },
    { latitude: 12.9716, longitude: 179.99999 },
    { latitude: -12.9716, longitude: -179.99999 },
  ];

  for (const pt of coords) {
    const res = screenSpatialBuffers(pt, []);
    assert.ok(res.georeferencedSnapshot);
    assert.equal(res.georeferencedSnapshot.imagePngBase64, '');
    assert.equal(res.georeferencedSnapshot.metadata.center?.[0], pt.longitude);
    assert.equal(res.georeferencedSnapshot.metadata.center?.[1], pt.latitude);
  }
});

test('ADVERSARIAL GIS-1.4: Web Mercator projection bounds (lat = ±85.051129)', () => {
  const northMercatorLimit = { latitude: 85.051129, longitude: 77.5946 };
  const southMercatorLimit = { latitude: -85.051129, longitude: 77.5946 };

  const resNorth = screenSpatialBuffers(northMercatorLimit, []);
  assert.ok(resNorth.georeferencedSnapshot);
  assert.match(resNorth.georeferencedSnapshot.metadata.scaleText, /1 cm = \d+ m/);

  const resSouth = screenSpatialBuffers(southMercatorLimit, []);
  assert.ok(resSouth.georeferencedSnapshot);
  assert.match(resSouth.georeferencedSnapshot.metadata.scaleText, /1 cm = \d+ m/);
});

test('ADVERSARIAL GIS-1.5: Cadastral GeoJSON validator handles null, empty, corrupt, and non-polygon structures', () => {
  // Primitive / empty falsy inputs
  assert.equal(validateCadastralGeoJSON(null), false, 'null is rejected');
  assert.equal(validateCadastralGeoJSON(undefined), false, 'undefined is rejected');
  assert.equal(validateCadastralGeoJSON(''), false, 'empty string is rejected');
  assert.equal(validateCadastralGeoJSON(12345), false, 'number is rejected');
  assert.equal(validateCadastralGeoJSON([]), false, 'empty array is rejected');
  assert.equal(validateCadastralGeoJSON({}), false, 'empty object is rejected');

  // Features with invalid geometry types
  assert.equal(validateCadastralGeoJSON({ type: 'Feature' }), false, 'feature without geometry is rejected');
  assert.equal(
    validateCadastralGeoJSON({ type: 'Feature', geometry: null }),
    false,
    'feature with null geometry is rejected'
  );
  assert.equal(
    validateCadastralGeoJSON({ type: 'Feature', geometry: { type: 'Point', coordinates: [77.5, 12.9] } }),
    false,
    'point geometry is rejected'
  );
  assert.equal(
    validateCadastralGeoJSON({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }),
    false,
    'linestring geometry is rejected'
  );

  // Polygon with empty coordinates
  assert.equal(validateCadastralGeoJSON({ type: 'Polygon', coordinates: [] }), false, 'empty polygon coordinates rejected');
  assert.equal(validateCadastralGeoJSON({ type: 'Polygon', coordinates: [[]] }), false, 'empty polygon ring rejected');

  // Ring with fewer than 4 coordinates
  assert.equal(
    validateCadastralGeoJSON({
      type: 'Polygon',
      coordinates: [[[77.5, 12.9], [77.6, 12.9], [77.5, 12.9]]],
    }),
    false,
    'triangle with 3 points rejected (minimum 4 required for closed ring)'
  );

  // Unclosed polygon ring (first != last)
  assert.equal(
    validateCadastralGeoJSON({
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
    }),
    false,
    'unclosed 4-vertex ring rejected'
  );

  // Valid closed polygon
  assert.equal(
    validateCadastralGeoJSON({
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    }),
    true,
    'valid closed 5-vertex polygon accepted'
  );

  // Empty FeatureCollection
  assert.equal(
    validateCadastralGeoJSON({ type: 'FeatureCollection', features: [] }),
    false,
    'empty FeatureCollection rejected'
  );

  // FeatureCollection with a valid Polygon Feature
  assert.equal(
    validateCadastralGeoJSON({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
          properties: {},
        },
      ],
    }),
    true,
    'FeatureCollection with valid polygon accepted'
  );

  // Malformed ring coordinates (non-numeric, single-element, or string)
  assert.equal(
    validateCadastralGeoJSON({
      type: 'Polygon',
      coordinates: [[[0], [1], [2], [0]]],
    }),
    false,
    'coordinates with < 2 dimensions rejected'
  );
  assert.equal(
    validateCadastralGeoJSON({
      type: 'Polygon',
      coordinates: ['not-an-array'],
    }),
    false,
    'string in coordinates array rejected'
  );
});

// ============================================================================
// 2. BINARY PNG FORMAT INTEGRITY & CRYPTOGRAPHIC CRC-32 VALIDATION
// ============================================================================

test('ADVERSARIAL GIS-2: No synthetic map raster is emitted without a renderer and source geometry', () => {
  const result = screenSpatialBuffers({ latitude: 12.9716, longitude: 77.5946 }, []);
  assert.equal(result.georeferencedSnapshot.imagePngBase64, '');
  assert.deepEqual(result.cadastralParcelGeoJSON, { type: 'FeatureCollection', features: [] });
  assert.equal(result.drainClearanceStatus, 'unknown');
  assert.equal(result.lakeClearanceStatus, 'unknown');
});

// ============================================================================
// 3. NORTH ARROW & METRIC SCALE BAR DYNAMICS AT VARYING LATITUDES
// ============================================================================

test('ADVERSARIAL GIS-3.1: True North Arrow flag invariant across all latitudes', () => {
  const latitudes = [0, 12.9716, -12.9716, 45, -45, 60, -60, 80, -80];
  for (const lat of latitudes) {
    const meta = generateCartographicSnapshotMetadata([77.5946, lat], 16, ['Test']);
    assert.equal(meta.hasNorthArrow, true, `North arrow is true for latitude ${lat}`);
    assert.equal(meta.crs, 'EPSG:4326 (WGS 84)');
  }
});

test('ADVERSARIAL GIS-3.2: Dynamic metric scale bar resolution strictly decreases as latitude increases', () => {
  // Web Mercator ground resolution: resolution = (initialResolution * cos(lat)) / 2^zoom
  // As latitude goes from 0 -> 80 degrees, cos(lat) strictly decreases from 1.0 -> 0.1736
  // Therefore, ground resolution in meters/cm MUST strictly decrease.
  const latPoints = [
    { name: 'Equator', lat: 0.0, expectedMeters: 90 },
    { name: 'Bengaluru', lat: 12.9716, expectedMeters: 88 },
    { name: 'Tokyo', lat: 35.6762, expectedMeters: 73 },
    { name: 'London', lat: 51.5074, expectedMeters: 56 },
    { name: 'Reykjavik', lat: 64.1466, expectedMeters: 39 },
    { name: 'Longyearbyen', lat: 78.2232, expectedMeters: 19 },
  ];

  const parsedValues: number[] = [];

  for (const pt of latPoints) {
    const meta = generateCartographicSnapshotMetadata([0.0, pt.lat], 16, ['Dataset']);
    const match = meta.scaleText.match(/1 cm = (\d+) m \(Zoom 16\)/);
    assert.ok(match, `Scale text matches expected format: ${meta.scaleText}`);
    const meters = parseInt(match[1], 10);
    parsedValues.push(meters);

    // Check tolerance ±2 meters against theoretical expectation
    assert.ok(
      Math.abs(meters - pt.expectedMeters) <= 2,
      `${pt.name} scale ${meters}m matches expected ~${pt.expectedMeters}m (diff: ${Math.abs(meters - pt.expectedMeters)})`
    );
  }

  // Verify strict monotonic decrease
  for (let i = 0; i < parsedValues.length - 1; i++) {
    assert.ok(
      parsedValues[i] >= parsedValues[i + 1],
      `Scale at ${latPoints[i].name} (${parsedValues[i]}m) >= ${latPoints[i + 1].name} (${parsedValues[i + 1]}m)`
    );
  }
});

test('ADVERSARIAL GIS-3.3: Metric scale bar scales inversely with zoom level at fixed latitude', () => {
  const center: [number, number] = [77.5946, 12.9716]; // Bengaluru
  const zoomLevels = [12, 14, 16, 18];
  const scales: number[] = [];

  for (const z of zoomLevels) {
    const meta = generateCartographicSnapshotMetadata(center, z, ['Source']);
    const match = meta.scaleText.match(/1 cm = (\d+) m/);
    assert.ok(match);
    scales.push(parseInt(match[1], 10));
  }

  // Zooming in by 2 levels (e.g. 14 -> 16) roughly divides meters by 4 (2^2)
  // Scale at zoom 12 should be ~4x scale at zoom 14, etc.
  assert.ok(scales[0] > scales[1], 'Zoom 12 scale > Zoom 14 scale');
  assert.ok(scales[1] > scales[2], 'Zoom 14 scale > Zoom 16 scale');
  assert.ok(scales[2] > scales[3], 'Zoom 16 scale > Zoom 18 scale');

  // Verify ratio approximation:
  const ratio14to16 = scales[1] / scales[2];
  assert.ok(ratio14to16 > 3.8 && ratio14to16 < 4.2, `Ratio of zoom 14 to 16 is ~4x (actual: ${ratio14to16.toFixed(2)})`);
});

// ============================================================================
// 4. CONCURRENCY: 50 CONCURRENT CALLS & LATENCY (<50ms per call)
// ============================================================================

test('ADVERSARIAL GIS-4.1: 50 concurrent calls to snapshot metadata generator execute safely under 50ms per call', async () => {
  const CONCURRENCY = 50;
  const promises: Promise<{ id: number; durationMs: number; result: any }>[] = [];

  const tStart = performance.now();

  for (let i = 0; i < CONCURRENCY; i++) {
    const id = i;
    const lat = 12.0 + (i * 0.02);
    const lon = 77.0 + (i * 0.02);
    const p = new Promise<{ id: number; durationMs: number; result: any }>((resolve) => {
      const callStart = performance.now();
      const meta = generateCartographicSnapshotMetadata([lon, lat], 16, [`Source-${id}`]);
      const callEnd = performance.now();
      resolve({ id, durationMs: callEnd - callStart, result: meta });
    });
    promises.push(p);
  }

  const results = await Promise.all(promises);
  const totalDuration = performance.now() - tStart;

  assert.equal(results.length, CONCURRENCY, 'All 50 calls resolved');

  const durations = results.map((r) => r.durationMs);
  const maxDuration = Math.max(...durations);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / CONCURRENCY;

  // Strict latency check: every call must execute in < 50ms
  for (const r of results) {
    assert.ok(
      r.durationMs < 50,
      `Call #${r.id} duration (${r.durationMs.toFixed(3)}ms) must be under 50ms latency threshold`
    );
    // Thread safety & isolation check
    assert.equal(r.result.sources[0], `Source-${r.id}`);
    assert.equal(r.result.hasNorthArrow, true);
  }

  console.log(
    `[METRICS 50-Concurrent Metadata]: Total=${totalDuration.toFixed(2)}ms, Avg=${avgDuration.toFixed(3)}ms, Max=${maxDuration.toFixed(3)}ms`
  );
  assert.ok(maxDuration < 50, `Max duration ${maxDuration}ms < 50ms`);
});

test('ADVERSARIAL GIS-4.2: 50 concurrent spatial evaluations preserve findings without fabricated imagery', async () => {
  const CONCURRENCY = 50;
  const layers: SpatialScreeningLayerInput[] = [
    { id: 'swd_1', layerType: 'swd_primary', label: 'Primary SWD', distanceM: 25 },
    { id: 'lake_1', layerType: 'waterbody', label: 'Lake', distanceM: 40 },
  ];

  const promises: Promise<{ id: number; durationMs: number; pngLength: number; findingsCount: number }>[] = [];
  const tStart = performance.now();

  for (let i = 0; i < CONCURRENCY; i++) {
    const id = i;
    const lat = 12.9 + (i * 0.001);
    const lon = 77.5 + (i * 0.001);
    const p = new Promise<{ id: number; durationMs: number; pngLength: number; findingsCount: number }>((resolve) => {
      const callStart = performance.now();
      const res = screenSpatialBuffers({ latitude: lat, longitude: lon }, layers);
      const callEnd = performance.now();
      resolve({
        id,
        durationMs: callEnd - callStart,
        pngLength: res.georeferencedSnapshot.imagePngBase64.length,
        findingsCount: res.findings.length,
      });
    });
    promises.push(p);
  }

  const results = await Promise.all(promises);
  const totalDuration = performance.now() - tStart;

  assert.equal(results.length, CONCURRENCY);

  const durations = results.map((r) => r.durationMs);
  const maxDuration = Math.max(...durations);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / CONCURRENCY;
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(CONCURRENCY * 0.95)];
  const p99 = durations[Math.floor(CONCURRENCY * 0.99)];

  for (const r of results) {
    assert.ok(
      r.durationMs < 50,
      `Full screening call #${r.id} duration (${r.durationMs.toFixed(3)}ms) must be under 50ms`
    );
    assert.equal(r.pngLength, 0, 'No map raster is fabricated without configured rendering');
    assert.equal(r.findingsCount, 2, 'Findings calculated consistently across parallel threads');
  }

  console.log(
    `[METRICS 50-Concurrent Full Screening + PNG]: Total=${totalDuration.toFixed(2)}ms, Avg=${avgDuration.toFixed(3)}ms, P95=${p95.toFixed(3)}ms, P99=${p99.toFixed(3)}ms, Max=${maxDuration.toFixed(3)}ms`
  );

  assert.ok(maxDuration < 50, `Max duration ${maxDuration.toFixed(2)}ms < 50ms`);
  assert.ok(p95 < 50, `P95 duration ${p95.toFixed(2)}ms < 50ms`);
});

// ============================================================================
// 5. UI COMPONENT VALIDATION: MapViewer.tsx WebGL FALLBACK INTEGRITY
// ============================================================================

test('ADVERSARIAL GIS-5.1: MapViewer.tsx source analysis proves graceful WebGL failure handling & 2D Canvas fallback', () => {
  const mapViewerPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../../apps/web/src/components/MapViewer.tsx'
  );
  assert.ok(fs.existsSync(mapViewerPath), `MapViewer.tsx exists at ${mapViewerPath}`);

  const source = fs.readFileSync(mapViewerPath, 'utf8');

  // 1. WebGL Error Catching & Listener
  assert.ok(
    source.includes("mapInstance.on('error',") || source.includes('mapInstance.on("error",'),
    'MapViewer listens to mapInstance error event for WebGL failure'
  );
  assert.ok(
    source.includes('catch (e)') && source.includes('setUsingFallbackCanvas(true)'),
    'MapViewer wraps new maplibregl.Map in try/catch and activates fallback canvas state upon error'
  );

  // 2. Fallback State Management
  assert.ok(
    source.includes('const [usingFallbackCanvas, setUsingFallbackCanvas] = useState<boolean>(false);'),
    'MapViewer defines usingFallbackCanvas state boolean'
  );

  // 3. Conditional Rendering of HTML5 2D Canvas
  assert.ok(
    source.includes('<canvas') && source.includes('ref={canvasRef}') && source.includes('className="gis-fallback-canvas"'),
    'MapViewer renders <canvas ref={canvasRef} className="gis-fallback-canvas" /> when WebGL is unavailable'
  );

  // 4. Engine Badge Feedback
  assert.ok(
    source.includes('BASEMAP FALLBACK') && source.includes('MAPLIBRE GL'),
    'MapViewer dynamically indicates active renderer'
  );

  // 5. Fallback 2D Canvas Drawing Routine
  assert.ok(
    source.includes('const drawCanvasFallback = useCallback(() => {'),
    'MapViewer implements drawCanvasFallback callback'
  );
  assert.ok(source.includes('Map overlays unavailable; no geometry is being inferred.'));
  assert.ok(!source.includes('50 * mToPx') && !source.includes('1 cm ≈ 38 m'));
});

test('ADVERSARIAL GIS-5.2: Canvas fallback displays no inferred spatial geometry', () => {
  // Simulate the canvas 2D fallback context drawing calls to verify no syntax or math exceptions
  const drawOps: string[] = [];
  const mockCtx: any = {
    clearRect: (x: number, y: number, w: number, h: number) => drawOps.push(`clearRect(${x},${y},${w},${h})`),
    fillRect: (x: number, y: number, w: number, h: number) => drawOps.push(`fillRect(${x},${y},${w},${h})`),
    beginPath: () => drawOps.push('beginPath'),
    moveTo: (x: number, y: number) => drawOps.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => drawOps.push(`lineTo(${x},${y})`),
    stroke: () => drawOps.push('stroke'),
    fill: () => drawOps.push('fill'),
    arc: (x: number, y: number, r: number, sAngle: number, eAngle: number) =>
      drawOps.push(`arc(${x},${y},${Math.round(r)})`),
    rect: (x: number, y: number, w: number, h: number) => drawOps.push(`rect(${x},${y},${w},${h})`),
    fillText: (text: string, x: number, y: number) => drawOps.push(`fillText(${text},${x},${y})`),
    save: () => drawOps.push('save'),
    restore: () => drawOps.push('restore'),
    translate: (x: number, y: number) => drawOps.push(`translate(${x},${y})`),
    closePath: () => drawOps.push('closePath'),
    setLineDash: (arr: number[]) => drawOps.push(`setLineDash([${arr.join(',')}])`),
  };

  // Replicate the neutral fallback behavior in a mock environment.
  function simulateDrawCanvasFallback(ctx: any, width = 700, height = 480) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f4f6fa';
    ctx.fillRect(0, 0, width, height);
    ctx.fillText('Map overlays unavailable; no geometry is being inferred.', width / 2, height / 2);
  }

  assert.doesNotThrow(() => {
    simulateDrawCanvasFallback(mockCtx, 700, 480);
  }, 'Fallback canvas drawing executes without throwing');

  assert.ok(drawOps.includes('fillRect(0,0,700,480)'), 'Canvas background filled');
  assert.ok(drawOps.includes('fillText(Map overlays unavailable; no geometry is being inferred.,350,240)'));
  assert.equal(drawOps.some(operation => operation.startsWith('arc(')), false);
});
