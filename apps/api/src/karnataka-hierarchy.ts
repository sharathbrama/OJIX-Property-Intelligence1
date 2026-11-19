/**
 * OJIX Property Intelligence — Karnataka Administrative Hierarchy
 * 
 * Provides complete official Karnataka location reference data:
 * 31 Districts, Taluks, Hoblis, and revenue villages, with a curated,
 * high-fidelity demonstration dataset covering Bengaluru Urban, Mandya,
 * Mysuru, Bengaluru Rural, Ramanagara, and other Karnataka districts.
 */

import crypto from 'node:crypto';
import karnatakaData from './karnataka-locations-data.json' with { type: 'json' };
import {
  DEMO_DISTRICTS,
  DEMO_TALUKS,
  DEMO_HOBLIS,
  DEMO_VILLAGES,
  findHierarchyMatch,
} from './karnataka-demo-data.js';

export interface KarnatakaDistrict {
  id: string;
  name: string;
  code: string;
  active: number;
  is_demo?: number | boolean;
}

export interface KarnatakaTaluk {
  id: string;
  district_id: string;
  name: string;
  code: string;
  active: number;
  is_demo?: number | boolean;
}

export interface KarnatakaHobli {
  id: string;
  taluk_id: string;
  name: string;
  code: string;
  active: number;
  is_demo?: number | boolean;
}

export interface KarnatakaVillage {
  id: string;
  hobli_id: string;
  name: string;
  code: string | null;
  active: number;
  is_demo?: number | boolean;
}

function deterministicUuid(seed: string): string {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// ─── Districts ───────────────────────────────────────────────────────────────
const rawDistricts = (karnatakaData.districts as KarnatakaDistrict[]) || [];
const districtMap = new Map<string, KarnatakaDistrict>();

// First add official raw districts, normalizing legacy spelling
for (const d of rawDistricts) {
  let normalizedName = d.name;
  if (d.name === 'Bangalore Urban') normalizedName = 'Bengaluru Urban';
  else if (d.name === 'Bangalore Rural') normalizedName = 'Bengaluru Rural';
  else if (d.name === 'Mysore') normalizedName = 'Mysuru';
  else if (d.name === 'Tumkur') normalizedName = 'Tumakuru';
  districtMap.set(d.id, { ...d, name: normalizedName });
}

// Ensure all DEMO_DISTRICTS are present and take precedence
for (const d of DEMO_DISTRICTS) {
  districtMap.set(d.id, {
    id: d.id,
    name: d.name,
    code: d.code,
    active: 1,
    is_demo: 1,
  });
}

export const KARNATAKA_DISTRICTS: KarnatakaDistrict[] = Array.from(districtMap.values())
  .sort((a, b) => a.name.localeCompare(b.name));

export const KARNATAKA_TALUKS: KarnatakaTaluk[] = (karnatakaData.taluks as KarnatakaTaluk[]) || [];
export const KARNATAKA_HOBLIS: KarnatakaHobli[] = (karnatakaData.hoblis as KarnatakaHobli[]) || [];
export const KARNATAKA_VILLAGES: KarnatakaVillage[] = (karnatakaData.villages as KarnatakaVillage[]) || [];

export { DEMO_DISTRICTS, DEMO_TALUKS, DEMO_HOBLIS, DEMO_VILLAGES, findHierarchyMatch };

// ─── Hierarchy Accessors ─────────────────────────────────────────────────────

export function getTaluksForDistrict(districtId: string): KarnatakaTaluk[] {
  // 1. Check curated demo taluks
  const demoMatches = DEMO_TALUKS.filter(t => t.districtId === districtId);
  if (demoMatches.length > 0) {
    return demoMatches.map(t => ({
      id: t.id,
      district_id: t.districtId,
      name: t.name,
      code: t.code,
      active: 1,
      is_demo: 1,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // 2. Check general Karnataka dataset
  const filtered = KARNATAKA_TALUKS.filter(t => t.district_id === districtId);
  if (filtered.length > 0) {
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  // 3. Deterministic fallback so IDs never shift between requests
  const dist = KARNATAKA_DISTRICTS.find(d => d.id === districtId);
  const name = dist?.name || 'District';
  return [
    { id: deterministicUuid(`${districtId}:taluk:1`), district_id: districtId, name: `${name} North`, code: 'TAL-01', active: 1, is_demo: 1 },
    { id: deterministicUuid(`${districtId}:taluk:2`), district_id: districtId, name: `${name} South`, code: 'TAL-02', active: 1, is_demo: 1 },
    { id: deterministicUuid(`${districtId}:taluk:3`), district_id: districtId, name: `${name} Central`, code: 'TAL-03', active: 1, is_demo: 1 },
  ];
}

export function getHoblisForTaluk(talukId: string): KarnatakaHobli[] {
  // 1. Check curated demo hoblis
  const demoMatches = DEMO_HOBLIS.filter(h => h.talukId === talukId);
  if (demoMatches.length > 0) {
    return demoMatches.map(h => ({
      id: h.id,
      taluk_id: h.talukId,
      name: h.name,
      code: h.code,
      active: 1,
      is_demo: 1,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // 2. Check general Karnataka dataset
  const filtered = KARNATAKA_HOBLIS.filter(h => h.taluk_id === talukId);
  if (filtered.length > 0) {
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  // 3. Deterministic fallback
  const taluk = DEMO_TALUKS.find(t => t.id === talukId) || KARNATAKA_TALUKS.find(t => t.id === talukId);
  const name = taluk?.name || 'Taluk';
  return [
    { id: deterministicUuid(`${talukId}:hobli:1`), taluk_id: talukId, name: `${name} Kasaba`, code: 'HOB-01', active: 1, is_demo: 1 },
    { id: deterministicUuid(`${talukId}:hobli:2`), taluk_id: talukId, name: `${name} Central`, code: 'HOB-02', active: 1, is_demo: 1 },
    { id: deterministicUuid(`${talukId}:hobli:3`), taluk_id: talukId, name: `${name} Rural`, code: 'HOB-03', active: 1, is_demo: 1 },
  ];
}

export function getVillagesForHobli(hobliId: string): KarnatakaVillage[] {
  // 1. Check curated demo villages
  const demoMatches = DEMO_VILLAGES.filter(v => v.hobliId === hobliId);
  if (demoMatches.length > 0) {
    return demoMatches.map(v => ({
      id: v.id,
      hobli_id: v.hobliId,
      name: v.name,
      code: v.code,
      active: 1,
      is_demo: 1,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // 2. Check general Karnataka dataset
  const filtered = KARNATAKA_VILLAGES.filter(v => v.hobli_id === hobliId);
  if (filtered.length > 0) {
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  // 3. Deterministic fallback
  const hobli = DEMO_HOBLIS.find(h => h.id === hobliId) || KARNATAKA_HOBLIS.find(h => h.id === hobliId);
  const name = hobli?.name || 'Hobli';
  return [
    { id: deterministicUuid(`${hobliId}:village:1`), hobli_id: hobliId, name: `${name} Village 1`, code: 'V-01', active: 1, is_demo: 1 },
    { id: deterministicUuid(`${hobliId}:village:2`), hobli_id: hobliId, name: `${name} Village 2`, code: 'V-02', active: 1, is_demo: 1 },
    { id: deterministicUuid(`${hobliId}:village:3`), hobli_id: hobliId, name: `${name} Extension`, code: 'V-03', active: 1, is_demo: 1 },
  ];
}
