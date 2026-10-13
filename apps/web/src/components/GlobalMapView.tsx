import { useEffect, useRef, useState, useCallback } from 'react';
import { authFetch } from '../authFetch';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import {
  MapPin,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Crosshair,
  Building2,
  Sparkles,
  Link as LinkIcon,
  Navigation,
  Check
} from 'lucide-react';

interface Property {
  id: string;
  name: string;
  village: string;
  survey_number: string;
  extent: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  [key: string]: any;
}

interface SpatialFinding {
  code: string;
  layerType: string;
  distanceM: number;
  bufferM: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isEncroached: boolean;
  isInsideBuffer: boolean;
  points: number;
}

interface ScreenResult {
  latitude: number;
  longitude: number;
  drainClearanceStatus: 'clear' | 'buffer_zone' | 'encroached';
  lakeClearanceStatus: 'clear' | 'buffer_zone' | 'encroached';
  findings: SpatialFinding[];
  cadastralParcelGeoJSON?: any;
}

const BENGALURU_HOTSPOTS = [
  { name: 'Hulimavu Lake Buffer', lat: 12.887, lon: 77.596, desc: '30m NGT Wetland Buffer Corridor' },
  { name: 'Koramangala Valley SWD', lat: 12.931, lon: 77.618, desc: '50m Primary Rajakaluve Drain' },
  { name: 'Bellandur Wetland Belt', lat: 12.935, lon: 77.675, desc: 'K&C Valley Inflow Zone' },
  { name: 'Whitefield Cadastre', lat: 12.986, lon: 77.749, desc: 'Survey Boundaries & Secondary SWD' },
  { name: 'Hebbal Lake Periphery', lat: 13.045, lon: 77.588, desc: 'Ecological Green Belt' },
];

function createGeoJSONCircle(center: [number, number], radiusInMeters: number, points = 48) {
  const [lon, lat] = center;
  const coords: [number, number][] = [];
  const km = radiusInMeters / 1000;
  const distanceX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lon + x, lat + y]);
  }
  return coords;
}

export function GlobalMapView({
  properties,
  apiUrl = '',
  onOpenProperty,
  onRefreshProperties,
  readOnly = false
}: {
  properties: any[];
  apiUrl?: string;
  onOpenProperty?: (p: any) => Promise<void> | void;
  onRefreshProperties?: () => void;
  readOnly?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const inspectMarker = useRef<maplibregl.Marker | null>(null);

  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [inspectCoord, setInspectCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [screenResult, setScreenResult] = useState<ScreenResult | null>(null);
  const [screening, setScreening] = useState<boolean>(false);
  const [assignPropId, setAssignPropId] = useState<string>('');
  const [assignSuccess, setAssignSuccess] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);

  const performScreening = useCallback(async (lat: number, lon: number, customName?: string) => {
    setScreening(true);
    setAssignSuccess('');
    setInspectCoord({ lat, lon });

    if (map.current) {
      if (inspectMarker.current) {
        inspectMarker.current.setLngLat([lon, lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'inspect-pin-marker';
        el.innerHTML = `<div style="background:#2563eb;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(37,99,235,0.3);font-size:12px;font-weight:bold;cursor:pointer;">⌖</div>`;
        inspectMarker.current = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map.current);
      }
    }

    try {
      const res = await authFetch(`${apiUrl}/api/spatial/screen-point`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });

      if (!res.ok) throw new Error('Spatial screening query failed');
      const data: ScreenResult = await res.json();
      setScreenResult(data);

      // Render buffer overlays onto MapLibre
      if (map.current && map.current.isStyleLoaded()) {
        const m = map.current;
        const circle50 = createGeoJSONCircle([lon, lat], 50);
        const circle30 = createGeoJSONCircle([lon, lat], 30);
        const circle25 = createGeoJSONCircle([lon, lat], 25);

        const parcelCoords = data.cadastralParcelGeoJSON?.geometry?.coordinates || [createGeoJSONCircle([lon, lat], 15)];

        const geojsonData: any = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { type: 'buffer_50m', name: '50m Primary Rajakaluve Buffer' },
              geometry: { type: 'Polygon', coordinates: [circle50] },
            },
            {
              type: 'Feature',
              properties: { type: 'buffer_30m', name: '30m Lake / Waterbody Wetland Buffer' },
              geometry: { type: 'Polygon', coordinates: [circle30] },
            },
            {
              type: 'Feature',
              properties: { type: 'buffer_25m', name: '25m Secondary Drain Buffer' },
              geometry: { type: 'Polygon', coordinates: [circle25] },
            },
            {
              type: 'Feature',
              properties: { type: 'parcel', name: customName || 'Cadastral Parcel Extent' },
              geometry: { type: 'Polygon', coordinates: parcelCoords },
            },
          ],
        };

        const existingSource = m.getSource('active-inspection-buffers') as maplibregl.GeoJSONSource;
        if (existingSource) {
          existingSource.setData(geojsonData);
        } else {
          m.addSource('active-inspection-buffers', {
            type: 'geojson',
            data: geojsonData,
          });

          // 50m SWD Buffer (Red/Coral)
          m.addLayer({
            id: 'buffer-50m-fill',
            type: 'fill',
            source: 'active-inspection-buffers',
            filter: ['==', ['get', 'type'], 'buffer_50m'],
            paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.12 },
          });
          m.addLayer({
            id: 'buffer-50m-line',
            type: 'line',
            source: 'active-inspection-buffers',
            filter: ['==', ['get', 'type'], 'buffer_50m'],
            paint: { 'line-color': '#dc2626', 'line-width': 1.5, 'line-dasharray': [3, 2] },
          });

          // 30m Lake Buffer (Emerald)
          m.addLayer({
            id: 'buffer-30m-fill',
            type: 'fill',
            source: 'active-inspection-buffers',
            filter: ['==', ['get', 'type'], 'buffer_30m'],
            paint: { 'fill-color': '#10b981', 'fill-opacity': 0.14 },
          });
          m.addLayer({
            id: 'buffer-30m-line',
            type: 'line',
            source: 'active-inspection-buffers',
            filter: ['==', ['get', 'type'], 'buffer_30m'],
            paint: { 'line-color': '#059669', 'line-width': 1.5, 'line-dasharray': [2, 2] },
          });

          // Cadastral Parcel Polygon (Amber)
          m.addLayer({
            id: 'parcel-poly-fill',
            type: 'fill',
            source: 'active-inspection-buffers',
            filter: ['==', ['get', 'type'], 'parcel'],
            paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.25 },
          });
          m.addLayer({
            id: 'parcel-poly-line',
            type: 'line',
            source: 'active-inspection-buffers',
            filter: ['==', ['get', 'type'], 'parcel'],
            paint: { 'line-color': '#b45309', 'line-width': 2 },
          });
        }
      }
    } catch (e) {
      console.error('Screening error:', e);
    } finally {
      setScreening(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const validProps = properties.filter(p => p.latitude !== null && p.longitude !== null);
    const center: [number, number] = validProps.length > 0
      ? [validProps[0].longitude!, validProps[0].latitude!]
      : [77.5946, 12.9716];

    const m = new maplibregl.Map({
      container: container.current,
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
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center,
      zoom: 12,
    });

    map.current = m;

    m.on('load', () => {
      // Add existing property markers
      validProps.forEach(p => {
        const marker = new maplibregl.Marker({ color: '#d84b42' })
          .setLngLat([p.longitude!, p.latitude!])
          .addTo(m);

        marker.getElement().style.cursor = 'pointer';
        marker.getElement().addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedProp(p);
          setAssignPropId(p.id);
          m.flyTo({ center: [p.longitude!, p.latitude!], zoom: 15 });
          performScreening(p.latitude!, p.longitude!, p.name);
        });
      });

      // Interactive Click-to-Screen on the Map
      m.on('click', (e) => {
        const lat = Math.round(e.lngLat.lat * 1e6) / 1e6;
        const lon = Math.round(e.lngLat.lng * 1e6) / 1e6;
        setSelectedProp(null);
        performScreening(lat, lon);
      });
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, [properties, performScreening]);

  const handleHotspotJump = (spot: typeof BENGALURU_HOTSPOTS[0]) => {
    if (map.current) {
      map.current.flyTo({ center: [spot.lon, spot.lat], zoom: 15, duration: 1200 });
      performScreening(spot.lat, spot.lon, spot.name);
    }
  };

  const handleAssignToProperty = async () => {
    if (!assignPropId || !screenResult || !inspectCoord) return;
    setAssigning(true);
    setAssignSuccess('');

    try {
      const payload = {
        parcelGeoJSON: screenResult.cadastralParcelGeoJSON || {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [createGeoJSONCircle([inspectCoord.lon, inspectCoord.lat], 18)],
          },
          properties: {
            assignedFromMapInspection: true,
            latitude: inspectCoord.lat,
            longitude: inspectCoord.lon,
          },
        },
      };

      const res = await authFetch(`${apiUrl}/api/properties/${assignPropId}/parcel-geometry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update parcel geometry');
      }

      const assignedProp = properties.find(p => p.id === assignPropId);
      setAssignSuccess(`Coordinates & Cadastral polygon attached to "${assignedProp?.name || 'Property'}"!`);
      if (onRefreshProperties) onRefreshProperties();
    } catch (e: any) {
      alert(`Assignment failed: ${e.message}`);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="global-map-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SPATIAL DUE DILIGENCE <span>•</span> REAL-TIME MARIADB SPATIAL SCREENING</div>
          <h1>Map Intelligence & Cadastral Clearance</h1>
          <p>
            Interactive GIS clearance engine. Click anywhere on the map or select a known property to run
            real-time buffer screening against statutory stormwater drains (Rajakaluve), lake peripheries, and master plan buffers.
          </p>
        </div>
      </div>

      {/* Hotspots Quick Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '10px',
        marginBottom: '12px'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
          <Navigation size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
          Hotspots:
        </span>
        {BENGALURU_HOTSPOTS.map((h, i) => (
          <button
            key={i}
            className="secondary-btn"
            style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap' }}
            onClick={() => handleHotspotJump(h)}
          >
            {h.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '16px' }}>
        {/* Map Container */}
        <div className="panel" style={{ height: '580px', position: 'relative', overflow: 'hidden' }}>
          <div ref={container} style={{ width: '100%', height: '100%' }} />

          {/* Interactive instruction pill */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            <Crosshair size={13} style={{ color: '#38bdf8' }} />
            <span>Click anywhere on map to inspect statutory clearance</span>
          </div>

          {/* Legend */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(255, 255, 255, 0.94)',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '10px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <span><strong style={{ color: '#d84b42' }}>●</strong> Known Property</span>
            <span><strong style={{ color: '#2563eb' }}>⌖</strong> Screened Point</span>
            <span><strong style={{ color: '#ef4444' }}>—</strong> 50m SWD Buffer</span>
            <span><strong style={{ color: '#10b981' }}>—</strong> 30m Lake Buffer</span>
            <span><strong style={{ color: '#d97706' }}>■</strong> Cadastral Extent</span>
          </div>
        </div>

        {/* Real-time Cadastral & Buffer Inspector */}
        <div className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '580px' }}>
          <div className="panel-head" style={{ padding: 0 }}>
            <div>
              <h3>Cadastral Parcel Inspector</h3>
              <p>Live spatial buffer calculation</p>
            </div>
            <Layers size={18} style={{ color: '#64748b' }} />
          </div>

          {screening ? (
            <div style={{ padding: '40px 10px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Screening against MariaDB spatial layers…</div>
              <p style={{ fontSize: '11px' }}>Calculating geodesic distance to Rajakaluve drains and lake peripheries</p>
            </div>
          ) : screenResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedProp ? (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                        {selectedProp.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Sy. {selectedProp.survey_number} · {selectedProp.village}, {selectedProp.district}
                      </span>
                    </div>
                    {onOpenProperty && (
                      <button
                        className="text-btn"
                        style={{ fontSize: '11px' }}
                        onClick={() => onOpenProperty(selectedProp)}
                      >
                        Workspace <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e40af', fontSize: '12px', fontWeight: 600 }}>
                    <Crosshair size={14} /> Screened Point
                  </div>
                  <span style={{ fontSize: '11px', color: '#1e3a8a' }}>
                    Lat: {screenResult.latitude.toFixed(6)}, Lon: {screenResult.longitude.toFixed(6)}
                  </span>
                </div>
              )}

              {/* Clearance Status Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{
                  padding: '10px',
                  borderRadius: '6px',
                  background: screenResult.drainClearanceStatus === 'clear' ? '#f0fdf4' : screenResult.drainClearanceStatus === 'buffer_zone' ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${screenResult.drainClearanceStatus === 'clear' ? '#bbf7d0' : screenResult.drainClearanceStatus === 'buffer_zone' ? '#fde68a' : '#fecaca'}`,
                }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', display: 'block' }}>SWD CLEARANCE</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    {screenResult.drainClearanceStatus === 'clear' ? (
                      <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                    ) : screenResult.drainClearanceStatus === 'buffer_zone' ? (
                      <AlertTriangle size={14} style={{ color: '#d97706' }} />
                    ) : (
                      <ShieldAlert size={14} style={{ color: '#dc2626' }} />
                    )}
                    <strong style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: screenResult.drainClearanceStatus === 'clear' ? '#16a34a' : screenResult.drainClearanceStatus === 'buffer_zone' ? '#d97706' : '#dc2626'
                    }}>
                      {screenResult.drainClearanceStatus.replace('_', ' ')}
                    </strong>
                  </div>
                </div>

                <div style={{
                  padding: '10px',
                  borderRadius: '6px',
                  background: screenResult.lakeClearanceStatus === 'clear' ? '#f0fdf4' : screenResult.lakeClearanceStatus === 'buffer_zone' ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${screenResult.lakeClearanceStatus === 'clear' ? '#bbf7d0' : screenResult.lakeClearanceStatus === 'buffer_zone' ? '#fde68a' : '#fecaca'}`,
                }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', display: 'block' }}>LAKE WETLAND CLEARANCE</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    {screenResult.lakeClearanceStatus === 'clear' ? (
                      <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                    ) : (
                      <AlertTriangle size={14} style={{ color: '#d97706' }} />
                    )}
                    <strong style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: screenResult.lakeClearanceStatus === 'clear' ? '#16a34a' : '#d97706'
                    }}>
                      {screenResult.lakeClearanceStatus.replace('_', ' ')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Layer Distance Breakdown */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '11px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                  Statutory Distance Breakdown:
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {screenResult.findings && screenResult.findings.length > 0 ? (
                    screenResult.findings.map((f, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', paddingBottom: '4px', borderBottom: '1px dashed #e2e8f0' }}>
                        <span style={{ color: '#475569' }}>
                          {f.layerType === 'swd_primary' ? 'Primary SWD (50m)' : f.layerType === 'waterbody' ? 'Lake Buffer (30m)' : 'Secondary Drain (25m)'}
                        </span>
                        <span style={{ fontWeight: 600, color: f.isInsideBuffer ? '#dc2626' : '#16a34a' }}>
                          {Math.round(f.distanceM)}m away {f.isInsideBuffer && '(Buffer Violation)'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>All statutory buffer thresholds satisfied.</div>
                  )}
                </div>
              </div>

              {/* Real-world action: Link Coordinates & Parcel to Property */}
              {!readOnly&&<div style={{ background: '#faf5ff', padding: '12px', borderRadius: '6px', border: '1px solid #e9d5ff' }}>
                <strong style={{ fontSize: '11px', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                  <LinkIcon size={13} /> Link Geometry to Case File
                </strong>
                <p style={{ fontSize: '10px', color: '#7e22ce', margin: '0 0 8px 0' }}>
                  Attach screened coordinates and cadastral polygon to an active property workspace.
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={assignPropId}
                    onChange={(e) => setAssignPropId(e.target.value)}
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #d8b4fe',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select Property Workspace…</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Sy. {p.survey_number || '—'})
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary-btn"
                    style={{ fontSize: '11px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    onClick={handleAssignToProperty}
                    disabled={!assignPropId || assigning}
                  >
                    {assigning ? 'Linking…' : 'Attach'}
                  </button>
                </div>

                {assignSuccess && (
                  <div style={{ marginTop: '8px', color: '#16a34a', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <Check size={14} /> {assignSuccess}
                  </div>
                )}
              </div>}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '36px 12px', textAlign: 'center' }}>
              <Crosshair size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
              <strong style={{ fontSize: '13px' }}>Click anywhere on the map</strong>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Click any cadastral location or stormwater corridor to compute instant spatial buffer clearance and attach surveyed geometry to your property dossier.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
