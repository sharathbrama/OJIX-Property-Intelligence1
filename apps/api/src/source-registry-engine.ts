/**
 * Karnataka property-data source catalog.
 *
 * No government record is fabricated here. Until an authorized connector is
 * configured, queries return an explicit not-connected result and direct the
 * user to the official portal or verified document-upload workflow.
 */
import crypto from 'node:crypto';

export type RegistryName = 'bhoomi' | 'kaveri' | 'mojini' | 'dishaank' | 'easthi' | 'rera';

export interface RegistryHealth {
  name: RegistryName;
  displayName: string;
  department: string;
  officialUrl: string;
  status: 'not_connected';
  portalReachability: 'not_checked' | 'reachable' | 'unreachable';
  uptimePct: null;
  averageLatencyMs: number | null;
  lastChecked: string | null;
  recordTypes: string[];
  connectionNotice: string;
}

export interface VerificationDiscrepancy {
  field: string;
  workspaceValue: string;
  registryValue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

export interface RegistryVerificationResult {
  registryName: RegistryName;
  displayName: string;
  status: 'not_connected';
  matchScorePct: 0;
  queryParameters: Record<string, any>;
  matchedRecord: {
    dataStatus: 'not_connected';
    isOfficialRecord: false;
    message: string;
    requiredAction: string;
  };
  discrepancies: VerificationDiscrepancy[];
  evidenceHash: string;
  latencyMs: number;
  timestamp: string;
  officialPortalReference: string;
}

export interface PropertyInputForRegistry {
  id: string;
  name: string;
  village: string;
  hobli?: string;
  taluk?: string;
  district?: string;
  surveyNumber: string;
  subdivision?: string;
  extent?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DirectRegistryQueryParams {
  registry?: 'all' | RegistryName;
  district?: string;
  taluk?: string;
  hobli?: string;
  village?: string;
  surveyNumber: string;
  subdivision?: string;
  sroOffice?: string;
  pidNumber?: string;
  reraNumber?: string;
  latitude?: number;
  longitude?: number;
  ownerNameQuery?: string;
}

const NOT_CONNECTED_NOTICE = 'OJIX has no authorized live data connector for this source. Portal reachability does not verify a property record.';

export class SourceRegistryEngine {
  private healthCache: Record<RegistryName, RegistryHealth> = {
    bhoomi: this.registry('bhoomi', 'Bhoomi RTC & Mutation Portal', 'Revenue Department, Government of Karnataka', 'https://landrecords.karnataka.gov.in/service2/', ['RTC / Pahani (Form 16)', 'Mutation Register (MR)', 'Akarbandh', 'RR5/RR6 Register']),
    kaveri: this.registry('kaveri', 'Kaveri 2.0 Registration & EC Portal', 'Department of Stamps & Registration, Karnataka', 'https://kaveri.karnataka.gov.in/', ['Encumbrance Certificate', 'Registered instruments', 'Certified copies']),
    mojini: this.registry('mojini', 'Mojini 2.0 Cadastral Survey Portal', 'Survey, Settlement & Land Records Department', 'https://bhoomojini.karnataka.gov.in/', ['11E sketch', 'Podi / pre-mutation sketch', 'Tippani / FMB']),
    dishaank: this.registry('dishaank', 'Dishaank GIS Cadastral Boundary App', 'Karnataka State Remote Sensing Applications Centre', 'https://ksrsac.karnataka.gov.in/dishaank/', ['Survey-number map context', 'Village boundaries', 'Available GIS context']),
    easthi: this.registry('easthi', 'e-Aasthi & BBMP Municipal Register', 'BBMP / Urban Development Department', 'https://bbmpeaasthi.karnataka.gov.in/', ['Property register information', 'PID references', 'Mutation services']),
    rera: this.registry('rera', 'Karnataka Real Estate Regulatory Authority', 'Housing Department, Government of Karnataka', 'https://rera.karnataka.gov.in/', ['Project registration', 'Promoter disclosures', 'Complaint information'])
  };

  private registry(name: RegistryName, displayName: string, department: string, officialUrl: string, recordTypes: string[]): RegistryHealth {
    return { name, displayName, department, officialUrl, status: 'not_connected', portalReachability: 'not_checked', uptimePct: null, averageLatencyMs: null, lastChecked: null, recordTypes, connectionNotice: NOT_CONNECTED_NOTICE };
  }

  /** Checks public portal reachability only. It does not retrieve records. */
  async getRegistryHealth(probeLive = false): Promise<RegistryHealth[]> {
    if (!probeLive) return Object.values(this.healthCache);
    return Promise.all(Object.values(this.healthCache).map(async registry => {
      const start = Date.now();
      try {
        const response = await fetch(registry.officialUrl, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (OJIX Source Reachability Check)' }, signal: AbortSignal.timeout(3500) });
        return { ...registry, portalReachability: response.status < 500 ? 'reachable' as const : 'unreachable' as const, averageLatencyMs: Date.now() - start, lastChecked: new Date().toISOString() };
      } catch {
        return { ...registry, portalReachability: 'unreachable' as const, averageLatencyMs: Date.now() - start, lastChecked: new Date().toISOString() };
      }
    }));
  }

  private notConnected(registryName: RegistryName, property: PropertyInputForRegistry): RegistryVerificationResult {
    const registry = this.healthCache[registryName];
    const queryParameters = { district: property.district || '', taluk: property.taluk || '', hobli: property.hobli || '', village: property.village || '', surveyNumber: property.surveyNumber || '', subdivision: property.subdivision || '' };
    const matchedRecord = { dataStatus: 'not_connected' as const, isOfficialRecord: false as const, message: NOT_CONNECTED_NOTICE, requiredAction: 'Open the official portal or upload an official/certified record for evidence extraction and human review.' };
    const responseMetadata = JSON.stringify({ registryName, queryParameters, matchedRecord });
    return { registryName, displayName: registry.displayName, status: 'not_connected', matchScorePct: 0, queryParameters, matchedRecord, discrepancies: [], evidenceHash: crypto.createHash('sha256').update(responseMetadata).digest('hex'), latencyMs: 0, timestamp: new Date().toISOString(), officialPortalReference: registry.officialUrl };
  }

  verifyBhoomi(property: PropertyInputForRegistry) { return this.notConnected('bhoomi', property); }
  verifyKaveri(property: PropertyInputForRegistry) { return this.notConnected('kaveri', property); }
  verifyMojini(property: PropertyInputForRegistry) { return this.notConnected('mojini', property); }
  verifyDishaank(property: PropertyInputForRegistry) { return this.notConnected('dishaank', property); }
  verifyEAasthi(property: PropertyInputForRegistry) { return this.notConnected('easthi', property); }
  verifyRera(property: PropertyInputForRegistry) { return this.notConnected('rera', property); }

  async verifyAll(property: PropertyInputForRegistry) {
    return { propertyId: property.id, verifications: [this.verifyBhoomi(property), this.verifyKaveri(property), this.verifyMojini(property), this.verifyDishaank(property), this.verifyEAasthi(property), this.verifyRera(property)], overallTrustScorePct: 0, totalDiscrepancies: 0, completedAt: new Date().toISOString() };
  }

  async queryDirect(params: DirectRegistryQueryParams) {
    const property: PropertyInputForRegistry = { id: crypto.randomUUID(), name: `Source lookup request: Survey ${params.surveyNumber}`, village: params.village || '', hobli: params.hobli || '', taluk: params.taluk || '', district: params.district || '', surveyNumber: params.surveyNumber, subdivision: params.subdivision || '', latitude: params.latitude ?? null, longitude: params.longitude ?? null };
    const all = await this.verifyAll(property);
    const target = params.registry || 'all';
    const verifications = target === 'all' ? all.verifications : all.verifications.filter(item => item.registryName === target);
    return { queryParameters: params, verifications, overallTrustScorePct: 0, totalDiscrepancies: 0, completedAt: new Date().toISOString() };
  }
}

export const sourceRegistryEngine = new SourceRegistryEngine();
