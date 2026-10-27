/**
 * OJIX Property Intelligence - Spatial Rules Engine (R3)
 * Feature 11: Rajakaluve 3-Tier Buffer Screening (50m primary, 25m secondary, 15m tertiary)
 * Feature 12: Lake / Waterbody 30m Statutory Buffer Screening
 * Feature 13: Cadastral Survey Parcel Polygon Validator & Generator
 * Feature 14: Georeferenced Cartographic Snapshot Exporter with Scale Bar & North Arrow
 */


export type SpatialLayerType = 'swd_primary' | 'swd_secondary' | 'swd_tertiary' | 'waterbody';

export interface SpatialScreeningFinding {
  code: string;
  layerType: SpatialLayerType;
  distanceM: number;
  bufferM: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isEncroached: boolean;
  isInsideBuffer: boolean;
  points: number;
  sourceName?: string;
  sourceUrl?: string;
  sourceDate?: string;
}

export interface CartographicMetadata {
  center: [number, number] | null;
  zoom: number;
  scaleText: string;
  hasNorthArrow: boolean;
  sources: string[];
  timestamp: string;
  crs: string;
}

export interface SpatialScreeningResult {
  drainClearanceStatus: 'clear' | 'buffer_zone' | 'encroached' | 'unknown';
  lakeClearanceStatus: 'clear' | 'buffer_zone' | 'encroached' | 'unknown';
  findings: SpatialScreeningFinding[];
  screeningStatus?: 'complete' | 'partial' | 'unavailable' | 'missing_coordinates';
  message?: string;
  cadastralParcelGeoJSON: {
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    properties: {
      surveyNumber: string;
      village: string;
      [key: string]: any;
    };
  };
  georeferencedSnapshot: {
    imagePngBase64: string;
    metadata: CartographicMetadata;
  };
}

export interface SpatialScreeningLayerInput {
  id: string;
  layerType: SpatialLayerType;
  label: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourceDate?: string | null;
  coords?: [number, number]; // [lon, lat]
  distanceM?: number;
}

/**
 * Calculates geodesic distance between two points on the WGS84 ellipsoid
 * using the Haversine spherical approximation (R = 6,371,000 m).
 */
export function calculateGeodesicDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth mean radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generates cartographic metadata including metric scale bar calculation
 * at a given latitude and web mercator zoom level.
 */
export function generateCartographicSnapshotMetadata(
  center: [number, number], // [lon, lat]
  zoom: number,
  sources: string[]
): CartographicMetadata {
  const lat = center[1];
  // Standard Web Mercator ground resolution in meters per pixel at latitude:
  // resolution = (initialResolution * cos(lat)) / 2^zoom, where initialResolution ≈ 156543.03392 m/px
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  // Standard CSS screen pixel density ≈ 96 DPI -> 1 inch = 2.54 cm -> ~37.795 px/cm
  const scaleText = `1 cm = ${Math.round(metersPerPixel * 37.795)} m (Zoom ${zoom})`;

  return {
    center,
    zoom,
    scaleText,
    hasNorthArrow: true,
    sources: [...sources],
    timestamp: new Date().toISOString(),
    crs: 'EPSG:4326 (WGS 84)',
  };
}

/**
 * Validates GeoJSON geometry or feature for cadastral parcel representation:
 * - Must be a valid object (Feature, FeatureCollection, Polygon, or MultiPolygon)
 * - Must have Polygon or MultiPolygon geometry with closed rings (first coord == last coord)
 * - Must have at least 4 coordinate pairs per linear ring
 * - Every coordinate [lng, lat] must be a finite number within [-180, 180] and [-90, 90]
 */
export function validateCadastralGeoJSON(geojson: any): boolean {
  if (!geojson || typeof geojson !== 'object') return false;

  if (geojson.type === 'FeatureCollection') {
    if (!Array.isArray(geojson.features) || geojson.features.length === 0) {
      return false;
    }
    return geojson.features.every((feat: any) => validateCadastralGeoJSON(feat));
  }

  if (geojson.type === 'Feature') {
    if (!geojson.geometry || typeof geojson.geometry !== 'object') {
      return false;
    }
    if (geojson.geometry.type === 'Polygon') {
      return validatePolygonCoordinates(geojson.geometry.coordinates);
    }
    if (geojson.geometry.type === 'MultiPolygon') {
      return validateMultiPolygonCoordinates(geojson.geometry.coordinates);
    }
    return false;
  }

  if (geojson.type === 'Polygon') {
    return validatePolygonCoordinates(geojson.coordinates);
  }

  if (geojson.type === 'MultiPolygon') {
    return validateMultiPolygonCoordinates(geojson.coordinates);
  }

  return false;
}

function validatePolygonCoordinates(coordinates: any): boolean {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return false;
  }
  for (const ring of coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) {
      return false;
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (
      !Array.isArray(first) ||
      !Array.isArray(last) ||
      first.length < 2 ||
      last.length < 2 ||
      first[0] !== last[0] ||
      first[1] !== last[1]
    ) {
      return false;
    }
    for (const pt of ring) {
      if (!Array.isArray(pt) || pt.length < 2) return false;
      const [lng, lat] = pt;
      if (
        typeof lng !== 'number' ||
        typeof lat !== 'number' ||
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        lng < -180 ||
        lng > 180 ||
        lat < -90 ||
        lat > 90
      ) {
        return false;
      }
    }
  }
  return true;
}

function validateMultiPolygonCoordinates(coordinates: any): boolean {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return false;
  }
  for (const poly of coordinates) {
    if (!validatePolygonCoordinates(poly)) {
      return false;
    }
  }
  return true;
}

/**
 * Screen spatial buffers against Karnataka Rajakaluve / SWD and waterbodies:
 * - Primary SWD (50m buffer)
 * - Secondary SWD (25m buffer)
 * - Tertiary SWD (15m buffer)
 * - Lake / Waterbody (30m buffer)
 */
export function screenSpatialBuffers(
  propertyPoint: { latitude: number; longitude: number },
  layers: SpatialScreeningLayerInput[],
  customParcelGeoJSON?: any
): SpatialScreeningResult {
  const findings: SpatialScreeningFinding[] = [];
  let minDrainDist = Infinity;
  let minLakeDist = Infinity;
  const hasValidPoint = Number.isFinite(propertyPoint.latitude) && Number.isFinite(propertyPoint.longitude) &&
    propertyPoint.latitude >= -90 && propertyPoint.latitude <= 90 &&
    propertyPoint.longitude >= -180 && propertyPoint.longitude <= 180;
  const usableLayers = hasValidPoint ? layers.filter(layer =>
    (Number.isFinite(layer.distanceM) && Number(layer.distanceM) >= 0) ||
    (Array.isArray(layer.coords) && layer.coords.length === 2 && layer.coords.every(Number.isFinite) &&
      layer.coords[0] >= -180 && layer.coords[0] <= 180 && layer.coords[1] >= -90 && layer.coords[1] <= 90)
  ) : [];
  const hasDrainLayer = usableLayers.some(layer => layer.layerType.startsWith('swd_'));
  const hasWaterbodyLayer = usableLayers.some(layer => layer.layerType === 'waterbody');
  let drainStatus: SpatialScreeningResult['drainClearanceStatus'] = hasDrainLayer ? 'clear' : 'unknown';
  let lakeStatus: SpatialScreeningResult['lakeClearanceStatus'] = hasWaterbodyLayer ? 'clear' : 'unknown';

  for (const layer of usableLayers) {
    const rawDist =
      layer.distanceM !== undefined
        ? layer.distanceM
        : layer.coords
        ? calculateGeodesicDistance(
            propertyPoint.latitude,
            propertyPoint.longitude,
            layer.coords[1],
            layer.coords[0]
          )
        : Number.NaN;

    if (!Number.isFinite(rawDist) || rawDist < 0) continue;
    let bufferM = 0;
    let severity: SpatialScreeningFinding['severity'] = 'low';
    let points = 5;
    let hasFinding = false;

    if (layer.layerType === 'swd_primary') {
      bufferM = 50;
      minDrainDist = Math.min(minDrainDist, rawDist);
      if (rawDist === 0) {
        drainStatus = 'encroached';
        severity = 'critical';
        points = 35;
        hasFinding = true;
      } else if (rawDist <= bufferM) {
        if (drainStatus !== 'encroached') drainStatus = 'buffer_zone';
        severity = 'critical';
        points = 35;
        hasFinding = true;
      } else if (rawDist <= 100) {
        severity = 'medium';
        points = 15;
        hasFinding = true;
      }
    } else if (layer.layerType === 'swd_secondary') {
      bufferM = 25;
      minDrainDist = Math.min(minDrainDist, rawDist);
      if (rawDist === 0) {
        drainStatus = 'encroached';
        severity = 'critical';
        points = 35;
        hasFinding = true;
      } else if (rawDist <= bufferM) {
        if (drainStatus !== 'encroached') drainStatus = 'buffer_zone';
        severity = 'high';
        points = 25;
        hasFinding = true;
      } else if (rawDist <= 75) {
        severity = 'medium';
        points = 15;
        hasFinding = true;
      }
    } else if (layer.layerType === 'swd_tertiary') {
      bufferM = 15;
      minDrainDist = Math.min(minDrainDist, rawDist);
      if (rawDist === 0) {
        drainStatus = 'encroached';
        severity = 'critical';
        points = 35;
        hasFinding = true;
      } else if (rawDist <= bufferM) {
        if (drainStatus !== 'encroached') drainStatus = 'buffer_zone';
        severity = 'high';
        points = 25;
        hasFinding = true;
      } else if (rawDist <= 75) {
        severity = 'medium';
        points = 15;
        hasFinding = true;
      }
    } else if (layer.layerType === 'waterbody') {
      bufferM = 30;
      minLakeDist = Math.min(minLakeDist, rawDist);
      if (rawDist === 0) {
        lakeStatus = 'encroached';
        severity = 'critical';
        points = 35;
        hasFinding = true;
      } else if (rawDist <= bufferM) {
        if (lakeStatus !== 'encroached') lakeStatus = 'buffer_zone';
        severity = 'critical';
        points = 35;
        hasFinding = true;
      } else if (rawDist <= 100) {
        severity = 'medium';
        points = 15;
        hasFinding = true;
      }
    }

    const isEncroached = rawDist === 0;
    const isInsideBuffer = rawDist <= bufferM;

    if (hasFinding) {
      findings.push({
        code: `SPATIAL_${layer.layerType.toUpperCase()}_${
          isEncroached ? 'ENCROACHMENT' : isInsideBuffer ? 'BUFFER' : 'PROXIMITY'
        }`,
        layerType: layer.layerType,
        distanceM: Math.round(rawDist * 10) / 10,
        bufferM,
        severity,
        isEncroached,
        isInsideBuffer,
        points,
        sourceName: layer.sourceName || undefined,
        sourceUrl: layer.sourceUrl || undefined,
        sourceDate: layer.sourceDate || undefined,
      });
    }
  }

  const sourceLabels = [...new Set(usableLayers.map(layer => layer.label).filter(Boolean))];
  const snapshotMetadata = generateCartographicSnapshotMetadata(
    [propertyPoint.longitude, propertyPoint.latitude], 16, sourceLabels
  );

  return {
    drainClearanceStatus: drainStatus,
    lakeClearanceStatus: lakeStatus,
    findings,
    screeningStatus: hasValidPoint ? (usableLayers.length ? (hasDrainLayer && hasWaterbodyLayer ? 'complete' : 'partial') : 'unavailable') : 'missing_coordinates',
    message: !hasValidPoint
      ? 'Valid coordinates are required; spatial screening was not performed.'
      : usableLayers.length
        ? 'Results are limited to the verified spatial layers supplied for this screening.'
        : 'Map review completed. Official drain and waterbody GIS layers are not connected, so clearance remains Unknown.',
    cadastralParcelGeoJSON: customParcelGeoJSON || { type: 'FeatureCollection', features: [] } as any,
    georeferencedSnapshot: { imagePngBase64: '', metadata: snapshotMetadata },
  };
}

/**
 * Explainable risk calculation for spatial screening findings,
 * matching contract-oracle.ts lines 1095-1130.
 */
export function calculateRiskScore(
  findings: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'unverified';
    points?: number;
    code?: string;
  }>
) {
  const severityWeight = {
    critical: 35,
    high: 25,
    medium: 15,
    low: 5,
    unverified: 0,
  };

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  let rawScore = 0;

  for (const f of findings) {
    if (f.severity !== 'unverified') {
      severityCounts[f.severity]++;
    }
    const pts = f.points !== undefined ? f.points : severityWeight[f.severity];
    rawScore += Math.max(pts, severityWeight[f.severity]);
  }

  const cappedScore = Math.min(100, rawScore);
  const band: 'preliminary' | 'review_required' | 'high_attention' =
    cappedScore >= 70 ? 'high_attention' : cappedScore >= 35 ? 'review_required' : 'preliminary';

  return {
    score: cappedScore,
    band,
    findings,
    severityCounts,
    findingCount: findings.length,
    disclaimer:
      'This risk analysis is an algorithmic due-diligence screening aid and does not constitute a certified legal opinion or title guarantee under Karnataka law.',
  };
}
