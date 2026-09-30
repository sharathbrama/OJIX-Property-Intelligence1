import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenSpatialBuffers,
  calculateGeodesicDistance,
  generateCartographicSnapshotMetadata,
  validateCadastralGeoJSON,
  calculateRiskScore,
} from '../src/spatial-rules-engine.js';

// ============================================================================
// SUITE 1: IRREGULAR SURVEY BOUNDARIES
// ============================================================================

test('ADVERSARIAL-1.1: Concave L-shaped polygon validation and vertex-mean centroid divergence', () => {
  // L-shaped survey parcel coordinates in Bengaluru
  const lShapedGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.590, 12.970],
          [77.593, 12.970],
          [77.593, 12.971],
          [77.591, 12.971],
          [77.591, 12.973],
          [77.590, 12.973],
          [77.590, 12.970],
        ],
      ],
    },
    properties: { surveyNumber: '45/1-Concave' },
  };

  // Validator accepts concave polygon structure
  assert.equal(validateCadastralGeoJSON(lShapedGeoJSON), true);

  // Compute arithmetic vertex mean (as implemented in server.ts lines 1004-1012)
  const ring = lShapedGeoJSON.geometry.coordinates[0];
  let sumLon = 0;
  let sumLat = 0;
  const count = ring.length - 1;
  for (let i = 0; i < count; i++) {
    sumLon += ring[i][0];
    sumLat += ring[i][1];
  }
  const meanLon = Math.round((sumLon / count) * 1e6) / 1e6;
  const meanLat = Math.round((sumLat / count) * 1e6) / 1e6;

  // Vertex mean is (77.590833, 12.970833).
  // In an L-shaped parcel where the inner cutout is from [77.591, 12.971] to [77.593, 12.973],
  // the vertex mean falls near the inner boundary notch.
  assert.ok(meanLon > 77.590 && meanLon < 77.593);
  assert.ok(meanLat > 12.970 && meanLat < 12.973);
});

test('ADVERSARIAL-1.2: Complex meandering survey boundary with 50+ irregular vertices', () => {
  // Meandering stream boundary simulation along southern border
  const coordinates: [number, number][] = [];
  const baseLon = 77.6000;
  const baseLat = 12.9000;

  // North boundary
  coordinates.push([baseLon, baseLat + 0.005]);
  coordinates.push([baseLon + 0.005, baseLat + 0.005]);
  // East boundary
  coordinates.push([baseLon + 0.005, baseLat]);

  // Meandering South boundary with 50 sinusoidal segments
  for (let i = 50; i >= 0; i--) {
    const frac = i / 50;
    const x = baseLon + 0.005 * frac;
    const y = baseLat + 0.0003 * Math.sin(frac * Math.PI * 4);
    coordinates.push([x, y]);
  }
  // Close the ring
  coordinates.push([baseLon, baseLat + 0.005]);

  const complexParcel = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    properties: { surveyNumber: '88/Meander' },
  };

  assert.equal(validateCadastralGeoJSON(complexParcel), true);
  assert.ok(complexParcel.geometry.coordinates[0].length >= 54);
});

test('ADVERSARIAL-1.3: Boundary coordinates with 15+ digits of floating-point precision', () => {
  const highPrecisionGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.594567890123456, 12.971234567890123],
          [77.595567890123456, 12.971234567890123],
          [77.595567890123456, 12.972234567890123],
          [77.594567890123456, 12.972234567890123],
          [77.594567890123456, 12.971234567890123],
        ],
      ],
    },
    properties: { surveyNumber: '99/HighPrecision' },
  };

  assert.equal(validateCadastralGeoJSON(highPrecisionGeoJSON), true);

  // Slight floating point representation mismatch on closing point (1 ULP difference)
  const mismatchPrecisionGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.59456789012345, 12.97123456789012],
          [77.59556789012345, 12.97123456789012],
          [77.59556789012345, 12.97223456789012],
          [77.59456789012345, 12.97223456789012],
          [77.59456789012346, 12.97123456789012], // 1 ULP off on longitude
        ],
      ],
    },
    properties: { surveyNumber: '99/Mismatch' },
  };
  // Should reject because first[0] !== last[0]
  assert.equal(validateCadastralGeoJSON(mismatchPrecisionGeoJSON), false);
});

test('ADVERSARIAL-1.4: Extreme latitude handling in cartographic metadata generator', () => {
  // At latitude 90 (North Pole), ground resolution is 0 m/px
  const metaPole = generateCartographicSnapshotMetadata([0, 90], 16, ['Test']);
  assert.equal(metaPole.scaleText, '1 cm = 0 m (Zoom 16)');

  // At latitude > 90 (invalid coordinate), cosine produces negative resolution
  const metaOverPole = generateCartographicSnapshotMetadata([0, 120], 16, ['Test']);
  // Reveals unconstrained latitude in cartographic projection calculation
  assert.match(metaOverPole.scaleText, /1 cm = -\d+ m/);
});

// ============================================================================
// SUITE 2: MULTI-POLYGON PARCELS & DEGENERATE GEOMETRIES
// ============================================================================

test('ADVERSARIAL-2.1 [DEFECT]: validateCadastralGeoJSON rejects valid standard MultiPolygon parcels', () => {
  // Common Karnataka land tenure case: parcel split by a cart track or hissa division
  const multiPolygonParcel = {
    type: 'Feature',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [77.590, 12.970],
            [77.592, 12.970],
            [77.592, 12.972],
            [77.590, 12.972],
            [77.590, 12.970],
          ],
        ],
        [
          [
            [77.593, 12.970],
            [77.595, 12.970],
            [77.595, 12.972],
            [77.593, 12.972],
            [77.593, 12.970],
          ],
        ],
      ],
    },
    properties: { surveyNumber: '102/1A & 102/1B' },
  };

  // Requirement R2 states: "Validate the spatial screening engine across irregular cadastral survey boundaries, multi-polygon parcels..."
  // BUT validateCadastralGeoJSON hardcodes: if (!geojson.geometry || geojson.geometry.type !== 'Polygon') return false;
  const isValid = validateCadastralGeoJSON(multiPolygonParcel);
  assert.equal(isValid, false, 'DEFECT CONFIRMED: validateCadastralGeoJSON rejects standard MultiPolygon parcel');

  // Direct MultiPolygon geometry object
  const directMultiPoly = {
    type: 'MultiPolygon',
    coordinates: multiPolygonParcel.geometry.coordinates,
  };
  assert.equal(validateCadastralGeoJSON(directMultiPoly), false, 'DEFECT CONFIRMED: Direct MultiPolygon geometry rejected');
});

test('ADVERSARIAL-2.2 [DEFECT]: validateCadastralGeoJSON accepts degenerate coordinates (NaN, 1D array, non-numeric strings)', () => {
  // Intermediate coordinate with NaN
  const nanCoordGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.59, 12.97],
          [NaN, 12.97],
          [77.60, 12.98],
          [77.59, 12.97],
        ],
      ],
    },
    properties: {},
  };
  // Because validatePolygonCoordinates only validates first and last coordinates, it accepts NaN!
  const nanAccepted = validateCadastralGeoJSON(nanCoordGeoJSON);
  assert.equal(nanAccepted, true, 'DEFECT CONFIRMED: validateCadastralGeoJSON accepted intermediate NaN coordinate');

  // Intermediate coordinate with 1-dimensional array [77.6] (missing latitude)
  const oneDCoordGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.59, 12.97],
          [77.60], // Missing Y coord!
          [77.60, 12.98],
          [77.59, 12.97],
        ],
      ],
    },
    properties: {},
  };
  const oneDAccepted = validateCadastralGeoJSON(oneDCoordGeoJSON);
  assert.equal(oneDAccepted, true, 'DEFECT CONFIRMED: validateCadastralGeoJSON accepted 1D coordinate');

  // Intermediate coordinate with string values
  const stringCoordGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.59, 12.97],
          ['invalid_x', 'invalid_y'],
          [77.60, 12.98],
          [77.59, 12.97],
        ],
      ],
    },
    properties: {},
  };
  const stringAccepted = validateCadastralGeoJSON(stringCoordGeoJSON);
  assert.equal(stringAccepted, true, 'DEFECT CONFIRMED: validateCadastralGeoJSON accepted non-numeric string coordinate');
});

test('ADVERSARIAL-2.3: Degenerate zero-area collinear polygon and self-intersecting bowtie', () => {
  // Collinear points along a straight line (zero area)
  const collinearGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.590, 12.970],
          [77.595, 12.970],
          [77.600, 12.970],
          [77.590, 12.970],
        ],
      ],
    },
    properties: {},
  };
  // Passes basic ring structure check despite having zero area
  assert.equal(validateCadastralGeoJSON(collinearGeoJSON), true);

  // Self-intersecting bowtie polygon (figure-8)
  const bowtieGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 2],
          [2, 0],
          [0, 2],
          [0, 0],
        ],
      ],
    },
    properties: {},
  };
  // Passes coordinate checks despite self-intersecting topology
  assert.equal(validateCadastralGeoJSON(bowtieGeoJSON), true);
});

// ============================================================================
// SUITE 3: OVERLAPPING RAJAKALUVE BUFFER ZONES & MAXIMUM-SEVERITY ASSIGNMENT
// ============================================================================

test('ADVERSARIAL-3.1: Simultaneous Primary (40m), Secondary (20m), and Tertiary (10m) SWD buffers', () => {
  const propertyPoint = { latitude: 12.9350, longitude: 77.6200 };
  const layers = [
    { id: 'swd_prim', layerType: 'swd_primary' as const, label: 'Primary Drain', distanceM: 40.0 },
    { id: 'swd_sec', layerType: 'swd_secondary' as const, label: 'Secondary Drain', distanceM: 20.0 },
    { id: 'swd_tert', layerType: 'swd_tertiary' as const, label: 'Tertiary Drain', distanceM: 10.0 },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  assert.equal(result.findings.length, 3);

  // All 3 buffers violated
  assert.ok(result.findings.every(f => f.isInsideBuffer));

  // Maximum severity among findings is Critical (from Primary SWD buffer at 35 points)
  const maxSeverity = result.findings.reduce((max, f) => (f.severity === 'critical' ? 'critical' : max), 'high');
  assert.equal(maxSeverity, 'critical');

  // Risk score aggregates all three findings
  const risk = calculateRiskScore(result.findings);
  // 35 (Primary) + 25 (Secondary) + 25 (Tertiary) = 85
  assert.equal(risk.score, 85);
  assert.equal(risk.band, 'high_attention');
});

test('ADVERSARIAL-3.2: Direct canal encroachment (0m) on Tertiary drain supersedes Primary buffer zone (40m)', () => {
  const propertyPoint = { latitude: 12.9350, longitude: 77.6200 };
  // Order 1: Primary buffer zone first, then Tertiary encroachment
  const layersOrder1 = [
    { id: 'swd_prim', layerType: 'swd_primary' as const, label: 'Primary Drain', distanceM: 40.0 },
    { id: 'swd_tert', layerType: 'swd_tertiary' as const, label: 'Tertiary Drain Encroached', distanceM: 0.0 },
  ];
  const res1 = screenSpatialBuffers(propertyPoint, layersOrder1);
  assert.equal(res1.drainClearanceStatus, 'encroached');

  // Order 2: Tertiary encroachment first, then Primary buffer zone
  const layersOrder2 = [
    { id: 'swd_tert', layerType: 'swd_tertiary' as const, label: 'Tertiary Drain Encroached', distanceM: 0.0 },
    { id: 'swd_prim', layerType: 'swd_primary' as const, label: 'Primary Drain', distanceM: 40.0 },
  ];
  const res2 = screenSpatialBuffers(propertyPoint, layersOrder2);
  assert.equal(res2.drainClearanceStatus, 'encroached');
});

test('ADVERSARIAL-3.3 [DEFECT]: Secondary and Tertiary SWD proximity warnings between bufferM*2 and 75m are dropped', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };

  // Secondary SWD: bufferM = 25. Code at lines 374-377 specifies `dist <= 75` triggers medium severity advisory.
  // BUT line 410 filters `isInsideBuffer || dist <= bufferM * 2` (where bufferM * 2 = 50).
  // A secondary drain at 60m should produce a medium severity proximity warning, but is dropped!
  const secResult = screenSpatialBuffers(propertyPoint, [
    { id: 'sec_60', layerType: 'swd_secondary' as const, label: 'Secondary Drain at 60m', distanceM: 60.0 },
  ]);
  assert.equal(secResult.findings.length, 0, 'DEFECT CONFIRMED: Secondary drain proximity at 60m dropped silently');

  // Tertiary SWD: bufferM = 15. Code at lines 389-390 specifies `dist <= 75` triggers medium severity advisory.
  // BUT line 410 filters `isInsideBuffer || dist <= bufferM * 2` (where bufferM * 2 = 30).
  // A tertiary drain at 45m should produce a medium severity proximity warning, but is dropped!
  const tertResult = screenSpatialBuffers(propertyPoint, [
    { id: 'tert_45', layerType: 'swd_tertiary' as const, label: 'Tertiary Drain at 45m', distanceM: 45.0 },
  ]);
  assert.equal(tertResult.findings.length, 0, 'DEFECT CONFIRMED: Tertiary drain proximity at 45m dropped silently');

  // Waterbody: bufferM = 30. Code at lines 401-404 specifies `dist <= 100` triggers medium severity advisory.
  // BUT line 410 filters `isInsideBuffer || dist <= bufferM * 2` (where bufferM * 2 = 60).
  // A lake at 80m should produce a medium severity proximity warning, but is dropped!
  const lakeResult = screenSpatialBuffers(propertyPoint, [
    { id: 'lake_80', layerType: 'waterbody' as const, label: 'Lake at 80m', distanceM: 80.0 },
  ]);
  assert.equal(lakeResult.findings.length, 0, 'DEFECT CONFIRMED: Waterbody proximity at 80m dropped silently');
});

// ============================================================================
// SUITE 4: LAKE WETLAND STATUTORY BUFFER (30M) BOUNDARY & FLOATING-POINT ROUNDING
// ============================================================================

test('ADVERSARIAL-4.1: Point exactly at 30.0m boundary is inside buffer zone', () => {
  const propertyPoint = { latitude: 12.9400, longitude: 77.7400 };
  const layers = [
    { id: 'lake_30', layerType: 'waterbody' as const, label: 'Lake Boundary', distanceM: 30.0 },
  ];
  const res = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(res.lakeClearanceStatus, 'buffer_zone');
  assert.equal(res.findings[0].isInsideBuffer, true);
  assert.equal(res.findings[0].severity, 'critical');
  assert.equal(res.findings[0].points, 35);
});

test('ADVERSARIAL-4.2: Point 29.99m inside 30m lake buffer is inside buffer zone', () => {
  const propertyPoint = { latitude: 12.9400, longitude: 77.7400 };
  const layers = [
    { id: 'lake_29_99', layerType: 'waterbody' as const, label: 'Lake Boundary', distanceM: 29.99 },
  ];
  const res = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(res.lakeClearanceStatus, 'buffer_zone');
  assert.equal(res.findings[0].isInsideBuffer, true);
  assert.equal(res.findings[0].severity, 'critical');
});

test('ADVERSARIAL-4.3 [CRITICAL DEFECT]: Point 30.01m OUTSIDE lake buffer is falsely flagged inside buffer due to premature Math.round()', () => {
  const propertyPoint = { latitude: 12.9400, longitude: 77.7400 };
  // Under Karnataka NGT / HC law, 30.0m is the statutory buffer.
  // A property situated at 30.01m is legally OUTSIDE the buffer.
  const layers = [
    { id: 'lake_30_01', layerType: 'waterbody' as const, label: 'Lake Boundary Outside', distanceM: 30.01 },
  ];
  const res = screenSpatialBuffers(propertyPoint, layers);

  // Line 342: dist = Math.round(dist * 10) / 10; rounds 30.01 to 30.0!
  // Then dist <= bufferM (30.0 <= 30) is TRUE!
  // This causes an illegal false positive:
  assert.equal(
    res.lakeClearanceStatus,
    'buffer_zone',
    'CRITICAL DEFECT CONFIRMED: 30.01m falsely classified as buffer_zone'
  );
  assert.equal(
    res.findings[0].isInsideBuffer,
    true,
    'CRITICAL DEFECT CONFIRMED: 30.01m falsely reported as isInsideBuffer=true'
  );
  assert.equal(
    res.findings[0].code,
    'SPATIAL_WATERBODY_BUFFER',
    'CRITICAL DEFECT CONFIRMED: 30.01m assigned buffer violation code'
  );
  assert.equal(
    res.findings[0].severity,
    'critical',
    'CRITICAL DEFECT CONFIRMED: 30.01m assigned critical severity (35 points)'
  );
});

test('ADVERSARIAL-4.4 [CRITICAL DEFECT]: Premature rounding triggers false positives across all SWD buffer thresholds (50.01m, 25.01m, 15.01m)', () => {
  const pt = { latitude: 12.90, longitude: 77.60 };

  // Primary SWD at 50.01m (legally outside 50m buffer)
  const resPrim = screenSpatialBuffers(pt, [
    { id: 'p_50_01', layerType: 'swd_primary' as const, label: 'Primary Drain', distanceM: 50.01 },
  ]);
  assert.equal(resPrim.drainClearanceStatus, 'buffer_zone', 'Primary 50.01m false positive');
  assert.equal(resPrim.findings[0].isInsideBuffer, true);
  assert.equal(resPrim.findings[0].severity, 'critical');

  // Secondary SWD at 25.01m (legally outside 25m buffer)
  const resSec = screenSpatialBuffers(pt, [
    { id: 's_25_01', layerType: 'swd_secondary' as const, label: 'Secondary Drain', distanceM: 25.01 },
  ]);
  assert.equal(resSec.drainClearanceStatus, 'buffer_zone', 'Secondary 25.01m false positive');
  assert.equal(resSec.findings[0].isInsideBuffer, true);
  assert.equal(resSec.findings[0].severity, 'high');

  // Tertiary SWD at 15.01m (legally outside 15m buffer)
  const resTert = screenSpatialBuffers(pt, [
    { id: 't_15_01', layerType: 'swd_tertiary' as const, label: 'Tertiary Drain', distanceM: 15.01 },
  ]);
  assert.equal(resTert.drainClearanceStatus, 'buffer_zone', 'Tertiary 15.01m false positive');
  assert.equal(resTert.findings[0].isInsideBuffer, true);
  assert.equal(resTert.findings[0].severity, 'high');
});

// ============================================================================
// SUITE 5: ARBITRARY COORDINATES & TOPOLOGICAL INTEGRITY
// ============================================================================

test('ADVERSARIAL-5.1 [DEFECT]: screenSpatialBuffers with NaN coordinates produces bogus clear status', () => {
  // Screen property point with NaN coordinates
  const res = screenSpatialBuffers({ latitude: NaN, longitude: NaN }, [
    { id: 'swd_1', layerType: 'swd_primary' as const, label: 'Nearby Drain', coords: [77.60, 12.90] },
  ]);

  // When lat/lon is NaN, calculateGeodesicDistance produces NaN,
  // which causes all distance checks (dist === 0, dist <= bufferM) to evaluate to false!
  assert.equal(res.drainClearanceStatus, 'clear', 'DEFECT CONFIRMED: NaN coordinates falsely reported as clear');
  assert.equal(res.findings.length, 0, 'DEFECT CONFIRMED: No findings generated for NaN coordinates');
  assert.match(res.georeferencedSnapshot.metadata.scaleText, /1 cm = NaN m/);
});

test('ADVERSARIAL-5.2 [DEFECT]: Synthetic parcel polygon replaces actual parcel geometry destroying topological integrity', () => {
  const propertyPoint = { latitude: 12.9716, longitude: 77.5946 };
  const res = screenSpatialBuffers(propertyPoint, []);

  // screenSpatialBuffers always generates a hardcoded 0.001 x 0.001 degree square (about 110m x 110m)
  // regardless of the actual parcel shape, survey sketch, or deed extent:
  const ring = res.cadastralParcelGeoJSON.geometry.coordinates[0];
  assert.equal(ring.length, 5);
  assert.equal(ring[0][0], propertyPoint.longitude - 0.0005);
  assert.equal(ring[0][1], propertyPoint.latitude - 0.0005);
  assert.equal(res.cadastralParcelGeoJSON.properties.surveyNumber, '34/2');
  assert.equal(res.cadastralParcelGeoJSON.properties.village, 'Arakere');
});

test('ADVERSARIAL-5.3 [DEFECT]: POST /api/spatial/screen-point silently overwrites valid 0.0 latitude or longitude with Bengaluru coordinates', async () => {
  const serverBaseUrl = process.env.TEST_API_URL || 'http://localhost:4000';
  const response = await fetch(`${serverBaseUrl}/api/spatial/screen-point`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 0, longitude: 0 }),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  // server.ts lines 927-928: const lat = Number(latitude || 12.887); const lon = Number(longitude || 77.596);
  // Because 0 is falsy, it replaces (0, 0) with Bengaluru default coordinates!
  assert.equal(data.latitude, 12.887, 'DEFECT CONFIRMED: Latitude 0 silently replaced with 12.887');
  assert.equal(data.longitude, 77.596, 'DEFECT CONFIRMED: Longitude 0 silently replaced with 77.596');
});

test('ADVERSARIAL-5.4 [DEFECT]: POST /api/properties/:id/parcel-geometry rejects standard MultiPolygon with 400 Bad Request', async () => {
  const serverBaseUrl = process.env.TEST_API_URL || 'http://localhost:4000';
  const testPropertyId = '22222222-2222-4222-8222-222222222222';
  const response = await fetch(`${serverBaseUrl}/api/properties/${testPropertyId}/parcel-geometry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[77.59, 12.97], [77.60, 12.97], [77.60, 12.98], [77.59, 12.98], [77.59, 12.97]]],
        ],
      },
      properties: { surveyNumber: '102/1A' },
    }),
  });
  assert.equal(response.status, 400, 'DEFECT CONFIRMED: MultiPolygon rejected with 400 Bad Request');
  const data = await response.json();
  assert.match(data.error, /Invalid cadastral GeoJSON/);
});

test('ADVERSARIAL-5.5 [CRITICAL DEFECT]: POST /api/properties/:id/parcel-geometry unhandled 500 error on degenerate non-numeric coords', async () => {
  const serverBaseUrl = process.env.TEST_API_URL || 'http://localhost:4000';
  const testPropertyId = '22222222-2222-4222-8222-222222222222';
  const response = await fetch(`${serverBaseUrl}/api/properties/${testPropertyId}/parcel-geometry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[77.59, 12.97], ['corrupt_x', 12.97], [77.60, 12.98], [77.59, 12.97]],
        ],
      },
      properties: { surveyNumber: '102' },
    }),
  });
  // validateCadastralGeoJSON passes the degenerate geometry; server attempts UPDATE with NaN;
  // Postgres check constraint properties_longitude_check throws unhandled exception -> 500
  assert.equal(response.status, 500, 'CRITICAL DEFECT CONFIRMED: Degenerate geometry crashes server with 500 error');
  const data = await response.json();
  assert.equal(data.error, 'Internal server error.');
});

