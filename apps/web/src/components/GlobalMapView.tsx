import { useEffect, useRef, useState, useCallback } from 'react';
import { authFetch } from '../authFetch';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import {
  Layers,
  ArrowUpRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Crosshair,
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
  sourceName?: string;
  sourceUrl?: string;
  sourceDate?: string;
}

interface ScreenResult {
  latitude: number;
  longitude: number;
  drainClearanceStatus: 'clear' | 'buffer_zone' | 'encroached' | 'unknown';
  lakeClearanceStatus: 'clear' | 'buffer_zone' | 'encroached' | 'unknown';
  screeningStatus?: 'complete' | 'partial' | 'unavailable' | 'missing_coordinates';
  message?: string;
  findings: SpatialFinding[];
  cadastralParcelGeoJSON?: any;
}

export function GlobalMapView({
  properties,
  apiUrl = '',
  onOpenProperty,
}: {
  properties: any[];
  apiUrl?: string;
  onOpenProperty?: (p: any) => Promise<void> | void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const inspectMarker = useRef<maplibregl.Marker | null>(null);

  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [screenResult, setScreenResult] = useState<ScreenResult | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [screening, setScreening] = useState<boolean>(false);

  const performScreening = useCallback(async (lat: number, lon: number) => {
    setScreening(true);
    setScreenResult(null);
    setScreenError(null);

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
    } catch (e) {
      console.error('Screening error:', e);
      setScreenError('Spatial screening is unavailable. No clearance conclusion was made.');
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
          m.flyTo({ center: [p.longitude!, p.latitude!], zoom: 15 });
          performScreening(p.latitude!, p.longitude!);
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

  return (
    <div className="global-map-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SPATIAL DUE DILIGENCE <span>•</span> SOURCE-QUALIFIED DATA ONLY</div>
          <h1>Map Intelligence & Spatial Review</h1>
          <p>
            Inspect a point against verified, provenance-complete spatial datasets available to this workspace. Missing or unverified data is reported as unknown; results are not an official clearance.
          </p>
        </div>
      </div>

      <div className="global-map-grid">
        {/* Map Container */}
        <div className="panel global-map-panel" style={{ position: 'relative', overflow: 'hidden' }}>
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
            <span>Click a point to check for available verified source data</span>
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
          </div>
        </div>

        {/* Real-time Cadastral & Buffer Inspector */}
        <div className="panel global-map-inspector" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          <div className="panel-head" style={{ padding: 0 }}>
            <div>
              <h3>Spatial Source Review</h3>
              <p>Verified source data only</p>
            </div>
            <Layers size={18} style={{ color: '#64748b' }} />
          </div>

          {screening ? (
            <div style={{ padding: '40px 10px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Checking available verified sources…</div>
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

              <div style={{ background: '#fffbeb', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '11px', color: '#854d0e' }}>
                Spatial screening is informational and does not establish legal clearance or parcel boundaries.
              </div>
              {screenResult.message && <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{screenResult.message}</p>}
              {/* Source status, never a legal clearance claim */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[['SWD source status', screenResult.drainClearanceStatus], ['Waterbody source status', screenResult.lakeClearanceStatus]].map(([label, status]) => {
                  const unknown = status === 'unknown';
                  const positive = status === 'clear';
                  const statusText = unknown ? 'Unknown' : positive ? 'No threshold alert' : String(status).replace('_', ' ');
                  const color = unknown ? '#64748b' : positive ? '#2563eb' : '#b45309';
                  return <div key={label} style={{ padding: '10px', borderRadius: '6px', background: unknown ? '#f8fafc' : positive ? '#eff6ff' : '#fffbeb', border: `1px solid ${unknown ? '#e2e8f0' : positive ? '#bfdbfe' : '#fde68a'}` }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', display: 'block' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    {unknown ? <AlertTriangle size={14} style={{ color }} /> : positive ? <CheckCircle2 size={14} style={{ color }} /> : <ShieldAlert size={14} style={{ color }} />}
                    <strong style={{ fontSize: '11px', textTransform: 'uppercase', color }}>
                      {statusText}
                    </strong>
                  </div>
                </div>;
                })}
              </div>

              {/* Layer Distance Breakdown */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '11px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                  Source-layer observations:
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {screenResult.findings && screenResult.findings.length > 0 ? (
                    screenResult.findings.map((f, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', paddingBottom: '4px', borderBottom: '1px dashed #e2e8f0' }}>
                        <span style={{ color: '#475569' }}>
                          {f.sourceName || f.layerType}{f.sourceDate ? ` · ${String(f.sourceDate).slice(0, 10)}` : ''}
                          {f.sourceUrl && <a href={f.sourceUrl} target="_blank" rel="noreferrer"> source</a>}
                        </span>
                        <span style={{ fontWeight: 600, color: f.isInsideBuffer ? '#dc2626' : '#16a34a' }}>
                          {Math.round(f.distanceM)}m from feature centroid {f.isInsideBuffer && '(configured threshold)'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {screenResult.screeningStatus === 'unavailable' || screenResult.drainClearanceStatus === 'unknown' || screenResult.lakeClearanceStatus === 'unknown'
                        ? 'No eligible verified spatial sources were available. Clearance is unknown.'
                        : 'No alert was returned by the configured source-layer thresholds. This is not an official clearance.'}
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="empty-state" style={{ padding: '36px 12px', textAlign: 'center' }}>
              <Crosshair size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
              <strong style={{ fontSize: '13px' }}>{screenError ? 'Screening unavailable' : 'Click a point on the map'}</strong>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                {screenError || 'The map can check only verified, provenance-complete source layers. No parcel boundary is inferred or attached from a point.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
