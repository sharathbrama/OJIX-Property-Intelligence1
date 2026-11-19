import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authFetch } from '../authFetch';
import { API_BASE_URL } from '../apiConfig';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import {
  Layers,
  MapPin,
  Compass,
  Download,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Info,
  RefreshCw,
  Upload,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Maximize2,
  FileCode,
  Check,
  ZoomIn,
  ZoomOut,
  Navigation,
} from 'lucide-react';

export interface SpatialFinding {
  code: string;
  layerType: 'swd_primary' | 'swd_secondary' | 'swd_tertiary' | 'waterbody';
  distanceM: number;
  bufferM: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isEncroached: boolean;
  isInsideBuffer: boolean;
  points: number;
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
  findings: SpatialFinding[];
  screeningStatus?: 'complete' | 'partial' | 'unavailable' | 'missing_coordinates';
  message?: string;
  cadastralParcelGeoJSON?: any;
  georeferencedSnapshot?: {
    imagePngBase64: string;
    metadata: CartographicMetadata;
  };
}

export interface MapViewerProps {
  property: {
    id: string;
    name: string;
    village?: string;
    hobli?: string;
    taluk?: string;
    district?: string;
    survey_number?: string;
    subdivision?: string;
    latitude: number | null;
    longitude: number | null;
    address?: string;
  };
  onGeometryUpdated?: (geometry: any) => void;
  readOnly?: boolean;
}

const API = API_BASE_URL;

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const MapViewer: React.FC<MapViewerProps> = ({ property, onGeometryUpdated, readOnly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [screeningResult, setScreeningResult] = useState<SpatialScreeningResult | null>(null);
  const [usingFallbackCanvas, setUsingFallbackCanvas] = useState<boolean>(false);

  // Layer control toggles
  const [showPrimarySwd, setShowPrimarySwd] = useState<boolean>(true);
  const [showSecondarySwd, setShowSecondarySwd] = useState<boolean>(true);
  const [showTertiarySwd, setShowTertiarySwd] = useState<boolean>(true);
  const [showLakeBuffer, setShowLakeBuffer] = useState<boolean>(true);
  const [showCadastralParcel, setShowCadastralParcel] = useState<boolean>(true);

  // GeoJSON upload / editor state
  const [showGeoJsonModal, setShowGeoJsonModal] = useState<boolean>(false);
  const [geoJsonInput, setGeoJsonInput] = useState<string>('');
  const [geoJsonError, setGeoJsonError] = useState<string>('');
  const [uploadBusy, setUploadBusy] = useState<boolean>(false);

  // Snapshot modal / zoom
  const [showSnapshotModal, setShowSnapshotModal] = useState<boolean>(false);

  const centerLat = property.latitude ?? 0;
  const centerLon = property.longitude ?? 0;
  const hasCoordinates = property.latitude !== null && property.longitude !== null;

  // Load spatial screening data from API
  const loadSpatialScreening = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi<SpatialScreeningResult>(
        `/api/properties/${property.id}/spatial-screening`
      );
      setScreeningResult(data);
    } catch (err: any) {
      console.error('Spatial screening unavailable:', err);
      setScreeningResult(null);
      setError(err.message || 'Spatial screening is unavailable. No map findings were generated.');
    } finally {
      setLoading(false);
    }
  }, [property.id, centerLat, centerLon, property.survey_number, property.village]);

  useEffect(() => {
    loadSpatialScreening();
  }, [loadSpatialScreening]);

  // Render high-fidelity 2D Canvas fallback
  const drawCanvasFallback = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background cartographic grid
    ctx.fillStyle = '#f4f6fa';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e2e7ef';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#475569';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Map overlays unavailable; no geometry is being inferred.', width / 2, height / 2);
    return;

    const cx = width / 2;
    const cy = height / 2;

  }, []);

  // Initialize MapLibre GL map or fallback to canvas
  useEffect(() => {
    if (!containerRef.current) return;
    if (!hasCoordinates) {
      setError('Property coordinates are not recorded. The map is not centered on an assumed location.');
      return;
    }

    let mapInstance: MapLibreMap | null = null;
    let cancelled = false;

    try {
      mapInstance = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
        },
        center: [centerLon, centerLat],
        zoom: hasCoordinates ? 16 : 12,
      });

      mapRef.current = mapInstance;

      mapInstance.on('load', () => {
        if (cancelled || !mapInstance) return;

        // Cadastral Parcel Source
        const parcelGeoJSON = screeningResult?.cadastralParcelGeoJSON || { type: 'FeatureCollection', features: [] };

        mapInstance.addSource('cadastral-parcel', {
          type: 'geojson',
          data: parcelGeoJSON,
        });

        // Add Buffer Sources (50m, 30m, 25m, 15m)
        mapInstance.addSource('primary-swd-buffer', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        mapInstance.addSource('lake-buffer', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        mapInstance.addSource('secondary-swd-buffer', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        mapInstance.addSource('tertiary-swd-buffer', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Add Layers with Colors
        // 1. Primary SWD (50m red)
        mapInstance.addLayer({
          id: 'primary-swd-fill',
          type: 'fill',
          source: 'primary-swd-buffer',
          paint: { 'fill-color': '#e63946', 'fill-opacity': 0.12 },
        });
        mapInstance.addLayer({
          id: 'primary-swd-stroke',
          type: 'line',
          source: 'primary-swd-buffer',
          paint: { 'line-color': '#e63946', 'line-width': 2, 'line-dasharray': [3, 2] },
        });

        // 2. Lake Buffer (30m blue)
        mapInstance.addLayer({
          id: 'lake-fill',
          type: 'fill',
          source: 'lake-buffer',
          paint: { 'fill-color': '#457b9d', 'fill-opacity': 0.15 },
        });
        mapInstance.addLayer({
          id: 'lake-stroke',
          type: 'line',
          source: 'lake-buffer',
          paint: { 'line-color': '#457b9d', 'line-width': 2 },
        });

        // 3. Secondary SWD (25m orange)
        mapInstance.addLayer({
          id: 'secondary-swd-fill',
          type: 'fill',
          source: 'secondary-swd-buffer',
          paint: { 'fill-color': '#f4a261', 'fill-opacity': 0.16 },
        });
        mapInstance.addLayer({
          id: 'secondary-swd-stroke',
          type: 'line',
          source: 'secondary-swd-buffer',
          paint: { 'line-color': '#f4a261', 'line-width': 2, 'line-dasharray': [2, 2] },
        });

        // 4. Tertiary SWD (15m amber)
        mapInstance.addLayer({
          id: 'tertiary-swd-fill',
          type: 'fill',
          source: 'tertiary-swd-buffer',
          paint: { 'fill-color': '#e9c46a', 'fill-opacity': 0.2 },
        });
        mapInstance.addLayer({
          id: 'tertiary-swd-stroke',
          type: 'line',
          source: 'tertiary-swd-buffer',
          paint: { 'line-color': '#e9c46a', 'line-width': 2 },
        });

        // 5. Cadastral Parcel (Indigo)
        mapInstance.addLayer({
          id: 'cadastral-fill',
          type: 'fill',
          source: 'cadastral-parcel',
          paint: { 'fill-color': '#4361ee', 'fill-opacity': 0.25 },
        });
        mapInstance.addLayer({
          id: 'cadastral-stroke',
          type: 'line',
          source: 'cadastral-parcel',
          paint: { 'line-color': '#4361ee', 'line-width': 2.5 },
        });

        // Center Pin Marker
        new maplibregl.Marker({ color: '#d90429' })
          .setLngLat([centerLon, centerLat])
          .setPopup(
            new maplibregl.Popup().setText(
              `${property.name} | Survey No: ${property.survey_number || 'Not recorded'} | Coordinates: ${centerLat.toFixed(5)}, ${centerLon.toFixed(5)}`
            )
          )
          .addTo(mapInstance);
      });

      mapInstance.on('error', () => {
        setUsingFallbackCanvas(true);
      });
    } catch (e) {
      console.warn('MapLibre WebGL failed, falling back to 2D Canvas renderer:', e);
      setUsingFallbackCanvas(true);
    }

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [centerLat, centerLon, hasCoordinates, property.name, property.survey_number, property.village]);

  // Sync layer visibility to MapLibre GL
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const setVisibility = (layers: string[], visible: boolean) => {
      for (const l of layers) {
        if (map.getLayer(l)) {
          map.setLayoutProperty(l, 'visibility', visible ? 'visible' : 'none');
        }
      }
    };

    setVisibility(['primary-swd-fill', 'primary-swd-stroke'], showPrimarySwd);
    setVisibility(['secondary-swd-fill', 'secondary-swd-stroke'], showSecondarySwd);
    setVisibility(['tertiary-swd-fill', 'tertiary-swd-stroke'], showTertiarySwd);
    setVisibility(['lake-fill', 'lake-stroke'], showLakeBuffer);
    setVisibility(['cadastral-fill', 'cadastral-stroke'], showCadastralParcel);
  }, [showPrimarySwd, showSecondarySwd, showTertiarySwd, showLakeBuffer, showCadastralParcel]);

  // Redraw canvas fallback whenever layer toggles or props change
  useEffect(() => {
    if (usingFallbackCanvas) {
      drawCanvasFallback();
    }
  }, [usingFallbackCanvas, drawCanvasFallback]);

  // Handle Cadastral GeoJSON form submission
  const handleGeoJsonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeoJsonError('');
    setUploadBusy(true);

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(geoJsonInput);
      } catch {
        throw new Error('Invalid JSON format. Please ensure valid GeoJSON syntax.');
      }

      const res = await fetchApi<{ message: string; latitude?: number; longitude?: number; geometry: any }>(
        `/api/properties/${property.id}/parcel-geometry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        }
      );

      if (onGeometryUpdated) onGeometryUpdated(res.geometry);
      setShowGeoJsonModal(false);
      setGeoJsonInput('');
      await loadSpatialScreening();
    } catch (err: any) {
      setGeoJsonError(err.message || 'Failed to update cadastral parcel geometry.');
    } finally {
      setUploadBusy(false);
    }
  };

  // Download snapshot base64 PNG
  const downloadSnapshotPng = () => {
    if (!screeningResult?.georeferencedSnapshot?.imagePngBase64) return;
    const link = document.createElement('a');
    link.href = screeningResult.georeferencedSnapshot.imagePngBase64;
    link.download = `spatial-cartographic-snapshot-${property.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const snapshotMeta = screeningResult?.georeferencedSnapshot?.metadata;

  return (
    <div className="gis-map-workspace">
      <style>{`
        .gis-map-workspace { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
        .gis-header-panel { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 22px; }
        .gis-header-left h2 { font-family: Manrope, sans-serif; font-size: 18px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
        .gis-header-left p { font-size: 11px; color: #64748b; margin: 0; }
        .gis-header-actions { display: flex; align-items: center; gap: 10px; }
        .gis-main-grid { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(320px, 1fr); gap: 16px; }
        .gis-map-panel { display: flex; flex-direction: column; overflow: hidden; }
        .gis-panel-badges { display: flex; align-items: center; gap: 8px; }
        .source-pill { font-size: 8px; font-weight: 700; color: #475569; background: #f1f5f9; padding: 5px 8px; border-radius: 4px; }
        .gis-map-viewport { position: relative; height: 490px; background: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; overflow: hidden; }
        .gis-maplibregl-container { width: 100%; height: 100%; }
        .gis-fallback-canvas { width: 100%; height: 100%; object-fit: contain; }
        .gis-north-arrow-widget { position: absolute; top: 16px; right: 16px; background: rgba(255, 255, 255, 0.94); border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; align-items: center; gap: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); z-index: 10; pointer-events: none; }
        .north-arrow-icon { display: flex; align-items: center; gap: 2px; }
        .north-needle { color: #e63946; }
        .north-label { font-size: 12px; font-weight: 900; color: #1e293b; }
        .gis-north-arrow-widget small { font-size: 7.5px; font-weight: 700; letter-spacing: 0.8px; color: #64748b; }
        .gis-scale-bar-widget { position: absolute; bottom: 16px; left: 16px; background: rgba(255, 255, 255, 0.94); border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); z-index: 10; pointer-events: none; }
        .scale-bar-line { width: 80px; height: 3px; background: #1e293b; border-left: 3px solid #1e293b; border-right: 3px solid #1e293b; }
        .scale-bar-labels { display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: #1e293b; }
        .scale-bar-text { font-size: 9px; color: #475569; font-weight: 500; }
        .gis-layer-toggles { position: absolute; bottom: 16px; right: 16px; background: rgba(255, 255, 255, 0.95); border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); z-index: 10; min-width: 170px; }
        .layer-toggle-title { font-size: 9px; font-weight: 800; letter-spacing: 0.6px; color: #1e293b; display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
        .layer-checkbox-label { display: flex; align-items: center; gap: 7px; font-size: 10px; color: #334155; cursor: pointer; user-select: none; }
        .layer-checkbox-label input { margin: 0; cursor: pointer; }
        .swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
        .swatch.swd-primary { background: #e63946; }
        .swatch.swd-secondary { background: #f4a261; }
        .swatch.swd-tertiary { background: #e9c46a; }
        .swatch.lake-buffer { background: #457b9d; }
        .swatch.cadastral-parcel { background: #4361ee; }
        .gis-map-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 18px; background: #fff; font-size: 9px; }
        .gis-disclaimer { display: flex; align-items: center; gap: 6px; color: #92400e; }
        .gis-disclaimer svg { flex-shrink: 0; }
        .gis-map-attribution { color: #64748b; font-weight: 600; white-space: nowrap; }
        .gis-sidebar-col { display: flex; flex-direction: column; gap: 16px; }
        .gis-status-panel { padding: 18px 20px; }
        .gis-status-panel h3 { font-family: Manrope, sans-serif; font-size: 13px; font-weight: 800; margin: 0 0 12px; color: #1e293b; }
        .clearance-cards-grid { display: flex; flex-direction: column; gap: 10px; }
        .clearance-card { display: flex; gap: 12px; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .clearance-card.green { background: #f0fdf4; border-color: #bbf7d0; }
        .clearance-card.green .clearance-icon { color: #16a34a; }
        .clearance-card.green .clearance-status { color: #15803d; }
        .clearance-card.amber { background: #fffbeb; border-color: #fde68a; }
        .clearance-card.amber .clearance-icon { color: #d97706; }
        .clearance-card.amber .clearance-status { color: #b45309; }
        .clearance-card.critical { background: #fef2f2; border-color: #fecaca; }
        .clearance-card.critical .clearance-icon { color: #dc2626; }
        .clearance-card.critical .clearance-status { color: #b91c1c; }
        .clearance-info { display: flex; flex-direction: column; gap: 2px; }
        .clearance-label { font-size: 8px; font-weight: 800; letter-spacing: 0.7px; color: #64748b; }
        .clearance-status { font-size: 13px; font-weight: 900; }
        .clearance-info p { font-size: 10px; color: #475569; margin: 2px 0 0; line-height: 1.4; }
        .gis-findings-panel { padding-bottom: 12px; }
        .gis-findings-list { display: flex; flex-direction: column; gap: 8px; padding: 0 16px 10px; }
        .gis-finding-card { border: 1px solid #e2e8f0; border-radius: 7px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; background: #fff; }
        .gis-finding-card.critical { border-left: 3px solid #dc2626; background: #fffdfd; }
        .gis-finding-card.high { border-left: 3px solid #ea580c; background: #fffdfa; }
        .gis-finding-card.medium { border-left: 3px solid #d97706; background: #fffffb; }
        .gis-finding-card.low { border-left: 3px solid #2563eb; }
        .finding-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .finding-code { font-family: monospace; font-size: 10px; color: #0f172a; }
        .severity-tag { font-size: 8px; font-weight: 800; padding: 2px 6px; border-radius: 3px; }
        .severity-tag.critical { background: #fee2e2; color: #991b1b; }
        .severity-tag.high { background: #ffedd5; color: #9a3412; }
        .severity-tag.medium { background: #fef3c7; color: #92400e; }
        .severity-tag.low { background: #e0f2fe; color: #075985; }
        .finding-metrics { display: flex; gap: 12px; font-size: 9px; color: #64748b; background: #f8fafc; padding: 6px 8px; border-radius: 4px; }
        .metric-box { display: flex; flex-direction: column; gap: 1px; }
        .metric-box b { color: #1e293b; font-size: 10px; }
        .points-text { color: #b91c1c !important; }
        .finding-desc { font-size: 9px; }
        .encroach-warn { color: #b91c1c; font-weight: 700; }
        .buffer-warn { color: #c2410c; font-weight: 700; }
        .proximity-note { color: #475569; }
        .empty-findings { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px 16px; gap: 4px; }
        .empty-findings strong { font-size: 11px; color: #15803d; }
        .empty-findings p { font-size: 10px; color: #64748b; margin: 0; }
        .green-icon { color: #16a34a; }
        .gis-snapshot-card { padding: 18px 20px; }
        .gis-snapshot-card .panel-head { padding: 0 0 12px 0; }
        .snapshot-preview-wrap { display: flex; flex-direction: column; gap: 12px; }
        .snapshot-image-preview { width: 100%; height: 160px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; }
        .snapshot-overlay-info { display: flex; flex-direction: column; gap: 4px; font-size: 9px; background: #f8fafc; padding: 8px 10px; border-radius: 6px; }
        .snapshot-meta-item { display: flex; justify-content: space-between; color: #64748b; }
        .snapshot-meta-item b { color: #1e293b; }
        .snapshot-sources-list { margin-top: 4px; font-size: 8.5px; color: #64748b; }
        .snapshot-sources-list ul { margin: 2px 0 0 14px; padding: 0; }
        .snapshot-sources-list li { margin-bottom: 2px; }
        .modal-body-pad { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
        .error-banner { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #b91c1c; font-size: 10px; }
        @media (max-width: 1050px) {
          .gis-main-grid { grid-template-columns: 1fr; }
          .gis-header-panel { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
      {/* Top Header / Status Strip */}
      <div className="panel gis-header-panel">
        <div className="gis-header-left">
          <div className="eyebrow">REGULATORY SPATIAL SCREENING & GIS</div>
          <h2>Rajakaluve SWD & Lake Buffer Engine</h2>
          <p>
            MariaDB-backed spatial buffer screening for Karnataka storm-water drains (50m primary,
            25m secondary, 15m tertiary) and statutory waterbody boundaries (30m).
          </p>
        </div>
        <div className="gis-header-actions">
          {!readOnly&&<button className="secondary-btn" onClick={() => setShowGeoJsonModal(true)}>
            <FileCode size={15} /> Upload / Edit Parcel GeoJSON
          </button>}
          <button className="primary-btn" onClick={loadSpatialScreening} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh Screening
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Side Intelligence Panel */}
      <div className="gis-main-grid">
        {/* Left Column: Interactive GIS Map Viewer */}
        <div className="panel gis-map-panel">
          <div className="panel-head">
            <div>
              <h3>Interactive Cadastral & Buffer Overlay</h3>
              <p>
                Survey Parcel {property.survey_number || 'Not recorded'} ·{' '}
                {property.village || 'Village not recorded'} · {hasCoordinates ? `${centerLat.toFixed(5)}, ${centerLon.toFixed(5)}` : 'Coordinates not recorded'}
              </p>
            </div>
            <div className="gis-panel-badges">
              <span className="source-pill">EPSG:4326 (WGS 84)</span>
              {usingFallbackCanvas ? (
                <span className="demo-badge">BASEMAP FALLBACK</span>
              ) : (
                <span className="demo-badge">MAPLIBRE GL</span>
              )}
            </div>
          </div>

          {/* Map Container */}
          <div className="gis-map-viewport">
            {!usingFallbackCanvas ? (
              <div ref={containerRef} className="gis-maplibregl-container" />
            ) : (
              <canvas
                ref={canvasRef}
                width={700}
                height={480}
                className="gis-fallback-canvas"
              />
            )}

            {snapshotMeta?.scaleText && (
              <div className="gis-scale-bar-widget" aria-label="Map scale">
                <div className="scale-bar-text">{snapshotMeta.scaleText}</div>
              </div>
            )}

            {/* Layer Control Toggle Pill Panel */}
            <div className="gis-layer-toggles">
              <div className="layer-toggle-title">
                <Layers size={13} /> Layer Controls
              </div>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={showPrimarySwd}
                  onChange={(e) => setShowPrimarySwd(e.target.checked)}
                />
                <span className="swatch swd-primary" /> Primary SWD (50m)
              </label>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={showSecondarySwd}
                  onChange={(e) => setShowSecondarySwd(e.target.checked)}
                />
                <span className="swatch swd-secondary" /> Secondary SWD (25m)
              </label>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={showTertiarySwd}
                  onChange={(e) => setShowTertiarySwd(e.target.checked)}
                />
                <span className="swatch swd-tertiary" /> Tertiary SWD (15m)
              </label>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={showLakeBuffer}
                  onChange={(e) => setShowLakeBuffer(e.target.checked)}
                />
                <span className="swatch lake-buffer" /> Lake Buffer (30m)
              </label>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={showCadastralParcel}
                  onChange={(e) => setShowCadastralParcel(e.target.checked)}
                />
                <span className="swatch cadastral-parcel" /> Cadastral Parcel
              </label>
            </div>
          </div>

          {/* Map Footer Note */}
          <div className="gis-map-footer">
            <div className="gis-disclaimer">
              <AlertTriangle size={14} />
              <span>
                Screening requires property coordinates and active, permitted spatial source data. Missing results are not clearance.
              </span>
            </div>
            <div className="gis-map-attribution">
              Only imported layers with recorded source metadata can be reviewed here. No official dataset is bundled.
            </div>
          </div>
        </div>

        {/* Right Column: Clearance Status, Findings & Snapshot Preview */}
        <div className="gis-sidebar-col">
          {/* Clearance Status Cards */}
          <div className="panel gis-status-panel">
            <h3>Clearance Status</h3>
            <div className="clearance-cards-grid">
              <div
                className={`clearance-card ${
                  screeningResult?.drainClearanceStatus === 'clear'
                    ? 'green'
                    : screeningResult?.drainClearanceStatus === 'encroached'
                    ? 'critical'
                    : 'amber'
                }`}
              >
                <div className="clearance-icon">
                  {screeningResult?.drainClearanceStatus === 'clear' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                </div>
                <div className="clearance-info">
                  <span className="clearance-label">RAJAKALUVE SWD CLEARANCE</span>
                  <strong className="clearance-status">
                    {screeningResult?.drainClearanceStatus?.toUpperCase() || 'CHECKING…'}
                  </strong>
                  <p>
                    {screeningResult?.drainClearanceStatus === 'clear'
                      ? 'No findings in the loaded drain layers; this is not an authority clearance.'
                      : screeningResult?.drainClearanceStatus === 'encroached'
                      ? 'Possible geometry intersection; qualified review is required.'
                      : screeningResult?.drainClearanceStatus === 'buffer_zone'
                      ? 'Loaded geometry is within its configured threshold; verify source and rule.'
                      : 'Unknown: coordinates or applicable drain layers are missing.'}
                  </p>
                </div>
              </div>

              <div
                className={`clearance-card ${
                  screeningResult?.lakeClearanceStatus === 'clear'
                    ? 'green'
                    : screeningResult?.lakeClearanceStatus === 'encroached'
                    ? 'critical'
                    : 'amber'
                }`}
              >
                <div className="clearance-icon">
                  {screeningResult?.lakeClearanceStatus === 'clear' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                </div>
                <div className="clearance-info">
                  <span className="clearance-label">LAKE / WATERBODY CLEARANCE</span>
                  <strong className="clearance-status">
                    {screeningResult?.lakeClearanceStatus?.toUpperCase() || 'CHECKING…'}
                  </strong>
                  <p>
                    {screeningResult?.lakeClearanceStatus === 'clear'
                      ? 'No findings in the loaded waterbody layers; this is not an authority clearance.'
                      : screeningResult?.lakeClearanceStatus === 'encroached'
                      ? 'Possible geometry intersection; qualified review is required.'
                      : screeningResult?.lakeClearanceStatus === 'buffer_zone'
                      ? 'Loaded waterbody geometry is within its configured threshold; verify source and rule.'
                      : 'Unknown: coordinates or a waterbody layer are missing.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Spatial Screening Findings Table */}
          <div className="panel gis-findings-panel">
            <div className="panel-head">
              <div>
                <h3>Buffer Screening Findings</h3>
                <p>{screeningResult?.findings.length || 0} spatial findings registered</p>
              </div>
              <ShieldAlert size={16} />
            </div>

            {screeningResult?.findings && screeningResult.findings.length > 0 ? (
              <div className="gis-findings-list">
                {screeningResult.findings.map((f, i) => (
                  <div className={`gis-finding-card ${f.severity}`} key={`${f.code}-${i}`}>
                    <div className="finding-header">
                      <strong className="finding-code">{f.code}</strong>
                      <span className={`severity-tag ${f.severity || 'info'}`}>{(f.severity || 'info').toUpperCase()}</span>
                    </div>
                    <div className="finding-metrics">
                      <div className="metric-box">
                        <span>Distance</span>
                        <b>{f.distanceM} m</b>
                      </div>
                      <div className="metric-box">
                        <span>Statutory Buffer</span>
                        <b>{f.bufferM} m</b>
                      </div>
                      <div className="metric-box">
                        <span>Risk Points</span>
                        <b className="points-text">+{f.points} pts</b>
                      </div>
                    </div>
                    <div className="finding-desc">
                      {f.isEncroached ? (
                        <span className="encroach-warn">Direct alignment intersection ({Number(f.distanceM).toFixed(1)} m)</span>
                      ) : f.isInsideBuffer ? (
                        <span className="buffer-warn">Inside prohibited statutory buffer band</span>
                      ) : (
                        <span className="proximity-note">Proximity advisory observation</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-findings">
                <CheckCircle2 size={24} className="green-icon" />
                <strong>{screeningResult && screeningResult.screeningStatus !== 'unavailable' && screeningResult.drainClearanceStatus === 'clear' && screeningResult.lakeClearanceStatus === 'clear' ? 'No findings in loaded layers' : 'Screening unavailable or incomplete'}</strong>
                <p>{screeningResult?.message || 'No source-backed result is available. This is not a clearance.'}</p>
              </div>
            )}
          </div>

          {/* Cartographic Snapshot Preview Card */}
          <div className="panel gis-snapshot-card">
            <div className="panel-head">
              <div>
                <h3>Cartographic Snapshot Export</h3>
                <p>Source-backed map export; unavailable until a map renderer and source geometry are configured</p>
              </div>
              <button
                className="icon-btn"
                onClick={downloadSnapshotPng}
                title="Download Snapshot PNG"
                disabled={!screeningResult?.georeferencedSnapshot?.imagePngBase64}
              >
                <Download size={16} />
              </button>
            </div>

            {screeningResult?.georeferencedSnapshot?.imagePngBase64 ? (
              <div className="snapshot-preview-wrap">
                <img
                  src={screeningResult.georeferencedSnapshot.imagePngBase64}
                  alt="Georeferenced Cartographic Map Snapshot"
                  className="snapshot-image-preview"
                />
                <div className="snapshot-overlay-info">
                  <div className="snapshot-meta-item">
                    <span>CRS:</span> <b>{snapshotMeta?.crs || 'EPSG:4326 (WGS 84)'}</b>
                  </div>
                  <div className="snapshot-meta-item">
                    <span>Scale:</span> <b>{snapshotMeta?.scaleText || 'Unavailable'}</b>
                  </div>
                  <div className="snapshot-meta-item">
                    <span>True North:</span> <b>{snapshotMeta?.hasNorthArrow ? 'Shown' : 'Unavailable'}</b>
                  </div>
                  <div className="snapshot-sources-list">
                    <span>Datasets Cited:</span>
                    <ul>
                      {snapshotMeta?.sources.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button className="secondary-btn full-btn" onClick={downloadSnapshotPng}>
                  <Download size={15} /> Download High-Res Cartographic PNG
                </button>
              </div>
            ) : (
              <div className="empty-findings"><strong>Snapshot unavailable</strong><p>A valid map snapshot requires source geometry and a configured renderer.</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Cadastral GeoJSON Upload Modal */}
      {showGeoJsonModal && !readOnly && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowGeoJsonModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="eyebrow">CADASTRAL SURVEY GEOMETRY</div>
                <h2>Attach Cadastral Parcel GeoJSON</h2>
                <p>
                  Paste or upload a valid closed GeoJSON Polygon representing the survey parcel
                  boundary for Sy. {property.survey_number || 'the recorded survey number'}.
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowGeoJsonModal(false)}>
                <XCircle size={19} />
              </button>
            </div>

            <form onSubmit={handleGeoJsonSubmit}>
              <div className="modal-body-pad">
                <label className="form-field span-2">
                  <span>GeoJSON Geometry Payload (Polygon or Feature) <b>*</b></span>
                  <textarea
                    rows={8}
                    required
                    value={geoJsonInput}
                    onChange={(e) => setGeoJsonInput(e.target.value)}
                    placeholder={'Paste a GeoJSON Feature or FeatureCollection for the actual parcel geometry.'}
                  />
                </label>

                {geoJsonError && (
                  <div className="error-banner">
                    <AlertTriangle size={15} />
                    <span>{geoJsonError}</span>
                  </div>
                )}

                <div className="form-note">
                  <ShieldCheck size={16} />
                  <span>
                    Validation checks: First coordinate must equal last coordinate. Minimum 4
                    coordinate pairs required. Geometry type must be Polygon.
                  </span>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowGeoJsonModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={uploadBusy}>
                  {uploadBusy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}
                  Validate & Save Geometry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
