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
// FEATURE 11: Rajakaluve SWD 3-Tier Buffer Screening (R3)
// ============================================================================

test('F11 Tier 1: Primary SWD buffer screening (distance <= 50m flags critical 35 pts)', () => {
  const propertyPoint = { latitude: 12.9352, longitude: 77.6245 }; // Koramangala
  const layers = [
    {
      id: 'swd_1',
      layerType: 'swd_primary' as const,
      label: 'Koramangala Primary SWD (Valakaluve)',
      distanceM: 18.0,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  assert.equal(result.findings.length, 1);
  const f = result.findings[0];
  assert.equal(f.code, 'SPATIAL_SWD_PRIMARY_BUFFER');
  assert.equal(f.severity, 'critical');
  assert.equal(f.points, 35);
  assert.equal(f.isInsideBuffer, true);
  assert.equal(f.bufferM, 50);
});

test('F11 Tier 1: Secondary SWD buffer screening (distance <= 25m flags high 25 pts)', () => {
  const propertyPoint = { latitude: 12.9250, longitude: 77.6850 }; // Bellandur
  const layers = [
    {
      id: 'swd_sec_1',
      layerType: 'swd_secondary' as const,
      label: 'Secondary Feeder Halla',
      distanceM: 20.0,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  const f = result.findings[0];
  assert.equal(f.code, 'SPATIAL_SWD_SECONDARY_BUFFER');
  assert.equal(f.severity, 'high');
  assert.equal(f.points, 25);
  assert.equal(f.bufferM, 25);
});

test('F11 Tier 1: Tertiary SWD buffer screening (distance <= 15m flags high 25 pts)', () => {
  const propertyPoint = { latitude: 12.8800, longitude: 77.5800 }; // Begur
  const layers = [
    {
      id: 'swd_tert_1',
      layerType: 'swd_tertiary' as const,
      label: 'Micro Agricultural Kaluve',
      distanceM: 12.5,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  const f = result.findings[0];
  assert.equal(f.code, 'SPATIAL_SWD_TERTIARY_BUFFER');
  assert.equal(f.severity, 'high');
  assert.equal(f.points, 25);
  assert.equal(f.bufferM, 15);
});

test('F11 Tier 1: Direct drain intersection (0.0m) flags encroached status', () => {
  const propertyPoint = { latitude: 12.9300, longitude: 77.6200 };
  const layers = [
    {
      id: 'swd_prim_encroach',
      layerType: 'swd_primary' as const,
      label: 'Direct Stormwater Drain Canal Intersection',
      distanceM: 0.0,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'encroached');
  assert.equal(result.findings[0].isEncroached, true);
  assert.equal(result.findings[0].severity, 'critical');
  assert.equal(result.findings[0].points, 35);
});

test('F11 Tier 1: Property far outside buffers (>150m) flags clear status', () => {
  const propertyPoint = { latitude: 12.9716, longitude: 77.5946 };
  const layers = [
    {
      id: 'swd_distant',
      layerType: 'swd_primary' as const,
      label: 'Distant Primary Drain',
      distanceM: 250.0,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'clear');
  assert.equal(result.findings.length, 0);
});

test('F11 Tier 1: Geodesic Haversine distance matches expected metric scale', () => {
  // Bangalore Vidhana Soudha (12.9797, 77.5907) to Cubbon Park Metro (12.9797, 77.5997)
  const dist = calculateGeodesicDistance(12.9797, 77.5907, 12.9797, 77.5997);
  // ~975 meters along latitude circle
  assert.ok(dist >= 900 && dist <= 1050);
});

test('F11 Tier 2: Primary SWD exactly at 50.0m boundary is inside buffer zone', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [{ id: 'p50', layerType: 'swd_primary' as const, label: 'Boundary 50m', distanceM: 50.0 }];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  assert.equal(result.findings[0].isInsideBuffer, true);
});

test('F11 Tier 2: Primary SWD at 50.1m is outside buffer (medium proximity advisory)', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [{ id: 'p50_1', layerType: 'swd_primary' as const, label: 'Boundary 50.1m', distanceM: 50.1 }];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'clear');
  assert.equal(result.findings[0].isInsideBuffer, false);
  assert.equal(result.findings[0].severity, 'medium');
});

test('F11 Tier 2: Secondary SWD exactly at 25.0m is inside buffer zone', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [{ id: 's25', layerType: 'swd_secondary' as const, label: 'Sec 25m', distanceM: 25.0 }];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  assert.equal(result.findings[0].isInsideBuffer, true);
});

test('F11 Tier 2: Tertiary SWD exactly at 15.0m is inside buffer zone', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [{ id: 't15', layerType: 'swd_tertiary' as const, label: 'Tert 15m', distanceM: 15.0 }];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  assert.equal(result.findings[0].isInsideBuffer, true);
});

test('F11 Tier 2: Simultaneous Primary and Tertiary SWD within buffers flags highest severity', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [
    { id: 'p', layerType: 'swd_primary' as const, label: 'Primary Drain', distanceM: 40.0 },
    { id: 't', layerType: 'swd_tertiary' as const, label: 'Tertiary Drain', distanceM: 10.0 },
  ];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  assert.equal(result.findings.length, 2);
  assert.ok(result.findings.some(f => f.severity === 'critical'));
});

test('F11 Tier 2: Empty layers array returns unknown status with 0 findings', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const result = screenSpatialBuffers(propertyPoint, []);
  assert.equal(result.drainClearanceStatus, 'unknown');
  assert.equal(result.lakeClearanceStatus, 'unknown');
  assert.equal(result.findings.length, 0);
});

// ============================================================================
// FEATURE 12: Lake / Waterbody 30m Buffer Screening (R3)
// ============================================================================

test('F12 Tier 1: Lake distance <= 30m flags SPATIAL_LAKE_BUFFER (critical 35 pts)', () => {
  const propertyPoint = { latitude: 12.9400, longitude: 77.7400 }; // Varthur Lake area
  const layers = [
    {
      id: 'lake_varthur',
      layerType: 'waterbody' as const,
      label: 'Varthur Lake Cadastral Boundary',
      distanceM: 22.0,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.lakeClearanceStatus, 'buffer_zone');
  const f = result.findings[0];
  assert.equal(f.code, 'SPATIAL_WATERBODY_BUFFER');
  assert.equal(f.severity, 'critical');
  assert.equal(f.points, 35);
  assert.equal(f.bufferM, 30);
  assert.equal(f.isInsideBuffer, true);
});

test('F12 Tier 1: Lake direct intersection (0m) flags encroached status', () => {
  const propertyPoint = { latitude: 12.9400, longitude: 77.7400 };
  const layers = [
    {
      id: 'lake_bellandur',
      layerType: 'waterbody' as const,
      label: 'Bellandur Lake Body',
      distanceM: 0.0,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.lakeClearanceStatus, 'encroached');
  assert.equal(result.findings[0].isEncroached, true);
  assert.equal(result.findings[0].severity, 'critical');
  assert.equal(result.findings[0].points, 35);
});

test('F12 Tier 1: Lake distance > 30m & <= 100m flags medium severity proximity advisory', () => {
  const propertyPoint = { latitude: 12.9400, longitude: 77.7400 };
  const layers = [
    {
      id: 'lake_prox',
      layerType: 'waterbody' as const,
      label: 'Agara Lake Buffer',
      distanceM: 45.0,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.lakeClearanceStatus, 'clear'); // Not inside 30m prohibited buffer
  assert.equal(result.findings[0].severity, 'medium');
  assert.equal(result.findings[0].points, 15);
});

test('F12 Tier 1: Lake distance > 200m marked completely clear', () => {
  const propertyPoint = { latitude: 12.9400, longitude: 77.7400 };
  const layers = [
    {
      id: 'lake_far',
      layerType: 'waterbody' as const,
      label: 'Ulsoor Lake',
      distanceM: 350.0,
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.lakeClearanceStatus, 'clear');
  assert.equal(result.findings.length, 0);
});

test('F12 Tier 1: Computes distance from geographic layer coordinates if distanceM omitted', () => {
  const propertyPoint = { latitude: 12.9400, longitude: 77.7400 };
  const layers = [
    {
      id: 'lake_coords',
      layerType: 'waterbody' as const,
      label: 'Nearby Lake Point',
      coords: [77.7401, 12.9401] as [number, number], // ~15m away
    },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.ok(result.findings.length > 0);
  assert.ok(result.findings[0].distanceM < 30);
});

test('F12 Tier 2: Lake distance exactly 30.0m boundary is inside buffer zone', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [{ id: 'l30', layerType: 'waterbody' as const, label: 'Lake 30m', distanceM: 30.0 }];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.lakeClearanceStatus, 'buffer_zone');
  assert.equal(result.findings[0].isInsideBuffer, true);
});

test('F12 Tier 2: Lake distance 30.1m is outside buffer zone', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [{ id: 'l30_1', layerType: 'waterbody' as const, label: 'Lake 30.1m', distanceM: 30.1 }];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.lakeClearanceStatus, 'clear');
  assert.equal(result.findings[0].isInsideBuffer, false);
});

test('F12 Tier 2: Multiple lakes surrounding property tracks closest waterbody', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [
    { id: 'l1', layerType: 'waterbody' as const, label: 'Lake North', distanceM: 100.0 },
    { id: 'l2', layerType: 'waterbody' as const, label: 'Lake South', distanceM: 25.0 }, // Inside buffer
    { id: 'l3', layerType: 'waterbody' as const, label: 'Lake East', distanceM: 80.0 },
  ];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.lakeClearanceStatus, 'buffer_zone');
  const bufferFinding = result.findings.find(f => f.isInsideBuffer);
  assert.ok(bufferFinding);
  assert.equal(bufferFinding.distanceM, 25.0);
});

test('F12 Tier 2: Extreme distant coordinate (>100 km)', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [{ id: 'l_mysore', layerType: 'waterbody' as const, label: 'KRS Dam Lake', distanceM: 140000.0 }];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.lakeClearanceStatus, 'clear');
  assert.equal(result.findings.length, 0);
});

test('F12 Tier 2: Distance rounding to 1 decimal place', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [{ id: 'l_round', layerType: 'waterbody' as const, label: 'Lake Precise', distanceM: 22.45678 }];
  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.findings[0].distanceM, 22.5);
});

// ============================================================================
// FEATURE 13: MapLibre Cadastral Parcel Visualizer (R3)
// ============================================================================

test('F13 Tier 1: Missing survey geometry remains unavailable', () => {
  const result = screenSpatialBuffers({ latitude: 12.9716, longitude: 77.5946 }, []);
  assert.deepEqual(result.cadastralParcelGeoJSON, { type: 'FeatureCollection', features: [] });
  assert.equal(result.drainClearanceStatus, 'unknown');
  assert.equal(result.lakeClearanceStatus, 'unknown');
});

test('F13 Tier 1: Validator accepts FeatureCollection structure', () => {
  const fc = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[77.59, 12.97], [77.60, 12.97], [77.60, 12.98], [77.59, 12.98], [77.59, 12.97]]],
      },
      properties: { surveyNumber: '10' },
    }],
  };
  assert.equal(validateCadastralGeoJSON(fc), true);
});

test('F13 Tier 2: Validator rejects unclosed polygon ring', () => {
  const unclosed = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[77.59, 12.97], [77.60, 12.97], [77.60, 12.98], [77.59, 12.98]]], // Missing closing point!
    },
    properties: {},
  };
  assert.equal(validateCadastralGeoJSON(unclosed), false);
});

test('F13 Tier 2: Validator rejects non-polygon geometry types (e.g. LineString)', () => {
  const line = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [[77.59, 12.97], [77.60, 12.97]],
    },
    properties: {},
  };
  assert.equal(validateCadastralGeoJSON(line), false);
});

test('F13 Tier 2: Validator rejects empty or null objects', () => {
  assert.equal(validateCadastralGeoJSON(null), false);
  assert.equal(validateCadastralGeoJSON({}), false);
  assert.equal(validateCadastralGeoJSON('not an object'), false);
});

test('F13 Tier 2: Validator rejects ring with fewer than 4 coordinates', () => {
  const invalidRing = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[77.59, 12.97], [77.60, 12.97], [77.59, 12.97]]], // Only 3 coords
    },
    properties: {},
  };
  assert.equal(validateCadastralGeoJSON(invalidRing), false);
});

test('F13 Tier 2: Handles polygon with holes (multiple rings)', () => {
  const polyWithHole = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[77.59, 12.97], [77.61, 12.97], [77.61, 12.99], [77.59, 12.99], [77.59, 12.97]],
        [[77.595, 12.975], [77.605, 12.975], [77.605, 12.985], [77.595, 12.985], [77.595, 12.975]],
      ],
    },
    properties: { surveyNumber: '10/1' },
  };
  assert.equal(validateCadastralGeoJSON(polyWithHole), true);
});

// ============================================================================
// FEATURE 14: Georeferenced Snapshot Exporter (R3)
// ============================================================================

test('F14 Tier 1: Includes mandatory True North Arrow flag', () => {
  const meta = generateCartographicSnapshotMetadata([77.5946, 12.9716], 16, ['BDA 2023']);
  assert.equal(meta.hasNorthArrow, true);
});

test('F14 Tier 1: Computes dynamic metric scale bar text', () => {
  const meta = generateCartographicSnapshotMetadata([77.5946, 12.9716], 16, ['BDA 2023']);
  assert.ok(meta.scaleText);
  assert.match(meta.scaleText, /1 cm = \d+ m/);
});

test('F14 Tier 1: Cites authoritative source datasets', () => {
  const sources = ['BDA Revised Master Plan SWD Layer v2.1 (2023)', 'Bhoomi Cadastral Survey (2024)'];
  const meta = generateCartographicSnapshotMetadata([77.5946, 12.9716], 16, sources);
  assert.deepEqual(meta.sources, sources);
});

test('F14 Tier 1: Includes CRS WGS 84 (EPSG:4326) coordinate reference system', () => {
  const meta = generateCartographicSnapshotMetadata([77.5946, 12.9716], 16, ['BDA']);
  assert.match(meta.crs, /EPSG:4326/);
});

test('F14 Tier 1: Snapshot image is unavailable until a real renderer is configured', () => {
  const result = screenSpatialBuffers({ latitude: 12.9716, longitude: 77.5946 }, []);
  assert.ok(result.georeferencedSnapshot);
  assert.equal(result.georeferencedSnapshot.imagePngBase64, '');
  assert.equal(result.georeferencedSnapshot.metadata.hasNorthArrow, true);
});

test('F14 Tier 2: Scale calculation varies inversely with zoom level', () => {
  const metaZoom14 = generateCartographicSnapshotMetadata([77.5946, 12.9716], 14, []);
  const metaZoom16 = generateCartographicSnapshotMetadata([77.5946, 12.9716], 16, []);
  // At zoom 14, 1 cm covers more ground than at zoom 16
  const match14 = metaZoom14.scaleText.match(/1 cm = (\d+) m/);
  const match16 = metaZoom16.scaleText.match(/1 cm = (\d+) m/);
  assert.ok(match14 && match16);
  assert.ok(parseInt(match14[1], 10) > parseInt(match16[1], 10));
});

test('F14 Tier 2: Scale calculation handles zoom level 0', () => {
  const meta = generateCartographicSnapshotMetadata([77.5946, 12.9716], 0, []);
  assert.ok(meta.scaleText);
});

test('F14 Tier 2: Scale calculation handles high zoom level 20', () => {
  const meta = generateCartographicSnapshotMetadata([77.5946, 12.9716], 20, []);
  assert.ok(meta.scaleText);
});

test('F14 Tier 2: Timestamp in ISO 8601 format', () => {
  const meta = generateCartographicSnapshotMetadata([77.5946, 12.9716], 16, []);
  assert.ok(!isNaN(Date.parse(meta.timestamp)));
});

test('F14 Tier 2: Handles empty sources array gracefully', () => {
  const meta = generateCartographicSnapshotMetadata([77.5946, 12.9716], 16, []);
  assert.deepEqual(meta.sources, []);
});

// ============================================================================
// TIER 3: Cross-Feature Combinations (Pairwise)
// ============================================================================

test('Tier 3 Pairwise: Primary SWD Buffer (35 pts) + Lake Buffer (35 pts) Multi-Hazard Screening', () => {
  const propertyPoint = { latitude: 12.9350, longitude: 77.6850 }; // Near both drain and lake
  const layers = [
    { id: 'swd_prim', layerType: 'swd_primary' as const, label: 'Primary SWD', distanceM: 18.0 }, // 35 pts
    { id: 'lake_varth', layerType: 'waterbody' as const, label: 'Lake Boundary', distanceM: 22.0 }, // 35 pts
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'buffer_zone');
  assert.equal(result.lakeClearanceStatus, 'buffer_zone');
  assert.equal(result.findings.length, 2);

  const risk = calculateRiskScore(result.findings);
  assert.equal(risk.score, 70); // 35 + 35 = 70
  assert.equal(risk.band, 'high_attention');
});

test('Tier 3 Pairwise: Missing cadastral geometry is not inferred in snapshot metadata', () => {
  const propertyPoint = { latitude: 12.9716, longitude: 77.5946 };
  const result = screenSpatialBuffers(propertyPoint, []);
  const geojson = result.cadastralParcelGeoJSON;
  const snapshot = result.georeferencedSnapshot;

  assert.deepEqual(geojson, { type: 'FeatureCollection', features: [] });
  assert.ok(snapshot);
  assert.equal(snapshot.metadata.hasNorthArrow, true);
  assert.deepEqual(snapshot.metadata.center, [propertyPoint.longitude, propertyPoint.latitude]);
});

test('Tier 3 Pairwise: Zero Distance Encroachment triggers Encroached Status and Critical Risk', () => {
  const propertyPoint = { latitude: 12.90, longitude: 77.60 };
  const layers = [
    { id: 'enc_drain', layerType: 'swd_secondary' as const, label: 'Direct Canal', distanceM: 0.0 },
  ];

  const result = screenSpatialBuffers(propertyPoint, layers);
  assert.equal(result.drainClearanceStatus, 'encroached');
  const risk = calculateRiskScore(result.findings);
  assert.equal(risk.score, 35);
  assert.equal(risk.band, 'review_required');
});
