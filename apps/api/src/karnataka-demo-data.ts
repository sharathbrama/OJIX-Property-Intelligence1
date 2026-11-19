/**
 * OJIX Property Intelligence — Karnataka Demo Locations Dataset
 * 
 * Comprehensive structured demonstration hierarchy for Karnataka:
 * Level 1: District
 * Level 2: Taluk
 * Level 3: Hobli / Town
 * Level 4: Index-II Village
 * 
 * Fully covers Bengaluru Urban, Mandya, Mysuru and other Karnataka districts
 * with deterministic IDs for repeatable, reliable demo workflows.
 */

export interface DemoLocationItem {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  isDemo?: boolean;
}

export interface DemoDistrict extends DemoLocationItem {}
export interface DemoTaluk extends DemoLocationItem {
  districtId: string;
}
export interface DemoHobli extends DemoLocationItem {
  talukId: string;
}
export interface DemoVillage extends DemoLocationItem {
  hobliId: string;
}

export const DEMO_DISTRICTS: DemoDistrict[] = [
  { id: '44ddb060-53cf-4c38-863a-368f25212485', name: 'Bengaluru Urban', code: 'BLR-U', isDemo: true },
  { id: 'e37a87f9-a2d4-4c19-a9d8-19830c95743a', name: 'Mandya', code: 'MAN', isDemo: true },
  { id: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', name: 'Mysuru', code: 'MYS', isDemo: true },
  { id: '86cd7e12-0542-43ef-96e6-2a1f0c3a03f7', name: 'Bengaluru Rural', code: 'BLR-R', isDemo: true },
  { id: '53025ed6-5b15-4887-a63d-73b521f7bfe6', name: 'Ramanagara', code: 'RMN', isDemo: true },
  { id: '4c80e8a6-e6e3-4898-aa8f-47e7666f90a0', name: 'Dakshina Kannada', code: 'DKN', isDemo: true },
  { id: 'e62002d5-a909-4fa8-a2a5-19cc1b02142b', name: 'Tumakuru', code: 'TMK', isDemo: true },
  { id: 'cf04fb87-d034-4003-9320-b6193d97dfee', name: 'Hassan', code: 'HAS', isDemo: true },
];

export const DEMO_TALUKS: DemoTaluk[] = [
  // ─── Bengaluru Urban ────────────────────────────────────────────────────────
  { id: '94217fa0-dd0f-4975-8ad9-f4da0b0590fb', districtId: '44ddb060-53cf-4c38-863a-368f25212485', name: 'Bengaluru North', code: 'BLR-N', isDemo: true },
  { id: '6bca520d-f442-4e3d-9023-cfbdf3e82e88', districtId: '44ddb060-53cf-4c38-863a-368f25212485', name: 'Bengaluru South', code: 'BLR-S', isDemo: true },
  { id: 'dbb1ce1c-2854-4312-a8b5-728b05d7d1c5', districtId: '44ddb060-53cf-4c38-863a-368f25212485', name: 'Bengaluru East', code: 'BLR-E', isDemo: true },
  { id: '697a6511-3ac8-4058-982a-1cf65abac0e7', districtId: '44ddb060-53cf-4c38-863a-368f25212485', name: 'Anekal', code: 'ANK', isDemo: true },
  { id: '84268c93-9596-4af8-a624-160ac38b0517', districtId: '44ddb060-53cf-4c38-863a-368f25212485', name: 'Yelahanka', code: 'YLH', isDemo: true },

  // ─── Mandya ─────────────────────────────────────────────────────────────────
  { id: 'e61ad754-7544-47d9-859a-ca2dec00a951', districtId: 'e37a87f9-a2d4-4c19-a9d8-19830c95743a', name: 'Mandya', code: 'MAN-TAL', isDemo: true },
  { id: 'b02396d2-66c2-48d8-974e-cc628ffccf20', districtId: 'e37a87f9-a2d4-4c19-a9d8-19830c95743a', name: 'Srirangapatna', code: 'SRP', isDemo: true },
  { id: '3b333f17-64b9-48a8-ae1f-98bba874117a', districtId: 'e37a87f9-a2d4-4c19-a9d8-19830c95743a', name: 'Maddur', code: 'MAD', isDemo: true },
  { id: '96576905-54d1-456a-acc9-2dabb7939687', districtId: 'e37a87f9-a2d4-4c19-a9d8-19830c95743a', name: 'Pandavapura', code: 'PAN', isDemo: true },
  { id: '839a69ad-a6bc-45ad-a6ff-3375e68d3261', districtId: 'e37a87f9-a2d4-4c19-a9d8-19830c95743a', name: 'Malavalli', code: 'MAL', isDemo: true },
  { id: '2d573660-7212-4d49-91c8-d5e1223cb5e9', districtId: 'e37a87f9-a2d4-4c19-a9d8-19830c95743a', name: 'Nagamangala', code: 'NAG', isDemo: true },
  { id: 'ee0fa6e8-0c27-48c1-adfe-090d8b5a250a', districtId: 'e37a87f9-a2d4-4c19-a9d8-19830c95743a', name: 'Krishnarajpet (K.R. Pet)', code: 'KRP', isDemo: true },

  // ─── Mysuru ─────────────────────────────────────────────────────────────────
  { id: 'f53eaef6-2872-4dbe-bed6-72680b4ac0cf', districtId: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', name: 'Mysuru', code: 'MYS-TAL', isDemo: true },
  { id: '879e6f03-9f1d-4c64-a67e-33bf19e0fd11', districtId: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', name: 'Nanjangud', code: 'NAN', isDemo: true },
  { id: '0ed6114d-4a91-4007-979a-896570eefd38', districtId: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', name: 'Hunsur', code: 'HUN', isDemo: true },
  { id: '7cc5dad6-d221-46eb-bab7-c76d0b14afc9', districtId: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', name: 'T. Narasipura', code: 'TNP', isDemo: true },
  { id: 'd7b91ed5-e46d-4b8e-a19d-db4cbaa9cc00', districtId: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', name: 'K.R. Nagar', code: 'KRN', isDemo: true },
  { id: '333a9030-1563-4f9d-9710-e83d95d0b6c5', districtId: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', name: 'Heggadadevanakote', code: 'HDK', isDemo: true },
  { id: '4dd0fd1e-3e98-4ca1-bb79-4ec06b120183', districtId: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', name: 'Periyapatna', code: 'PRP', isDemo: true },

  // ─── Bengaluru Rural ────────────────────────────────────────────────────────
  { id: '10e0666d-e6d3-401f-b2bb-e448691a66da', districtId: '86cd7e12-0542-43ef-96e6-2a1f0c3a03f7', name: 'Doddaballapura', code: 'DOD', isDemo: true },
  { id: '536ad4cb-b6ec-43a7-b4e1-731fca920d10', districtId: '86cd7e12-0542-43ef-96e6-2a1f0c3a03f7', name: 'Devanahalli', code: 'DEV', isDemo: true },
  { id: '588cd6b2-e34a-4f5c-9c63-6b19bdcb4d1d', districtId: '86cd7e12-0542-43ef-96e6-2a1f0c3a03f7', name: 'Hoskote', code: 'HOS', isDemo: true },
  { id: '6c6c2a34-821d-48d0-919d-fbc7f45f9f29', districtId: '86cd7e12-0542-43ef-96e6-2a1f0c3a03f7', name: 'Nelamangala', code: 'NEL', isDemo: true },

  // ─── Ramanagara ─────────────────────────────────────────────────────────────
  { id: 'c585c3fa-7dd4-4197-8d38-bd3ed193abc7', districtId: '53025ed6-5b15-4887-a63d-73b521f7bfe6', name: 'Ramanagara', code: 'RAM-T', isDemo: true },
  { id: '0782e082-5efc-49ea-aaaa-4087288b872a', districtId: '53025ed6-5b15-4887-a63d-73b521f7bfe6', name: 'Channapatna', code: 'CHN', isDemo: true },
  { id: '25ef65e4-69b3-4af0-ad43-441b9d864187', districtId: '53025ed6-5b15-4887-a63d-73b521f7bfe6', name: 'Kanakapura', code: 'KAN', isDemo: true },
  { id: '86be09d5-6578-4673-b2b8-45c5a232ae9b', districtId: '53025ed6-5b15-4887-a63d-73b521f7bfe6', name: 'Magadi', code: 'MAG', isDemo: true },
];

export const DEMO_HOBLIS: DemoHobli[] = [
  // ─── Bengaluru Urban — Bengaluru North ─────────────────────────────────────
  { id: 'e1000001-0001-4000-8000-000000000001', talukId: '94217fa0-dd0f-4975-8ad9-f4da0b0590fb', name: 'Kasaba (North)', code: 'BN-KAS', isDemo: true },
  { id: 'e1000001-0001-4000-8000-000000000002', talukId: '94217fa0-dd0f-4975-8ad9-f4da0b0590fb', name: 'Dasanapura', code: 'BN-DAS', isDemo: true },
  { id: 'e1000001-0001-4000-8000-000000000003', talukId: '94217fa0-dd0f-4975-8ad9-f4da0b0590fb', name: 'Yeshwanthapura', code: 'BN-YES', isDemo: true },
  { id: 'e1000001-0001-4000-8000-000000000004', talukId: '94217fa0-dd0f-4975-8ad9-f4da0b0590fb', name: 'Hesaraghatta', code: 'BN-HES', isDemo: true },

  // ─── Bengaluru Urban — Bengaluru South ─────────────────────────────────────
  { id: 'e1000002-0001-4000-8000-000000000001', talukId: '6bca520d-f442-4e3d-9023-cfbdf3e82e88', name: 'Begur', code: 'BS-BEG', isDemo: true },
  { id: 'e1000002-0001-4000-8000-000000000002', talukId: '6bca520d-f442-4e3d-9023-cfbdf3e82e88', name: 'Kengeri', code: 'BS-KEN', isDemo: true },
  { id: 'e1000002-0001-4000-8000-000000000003', talukId: '6bca520d-f442-4e3d-9023-cfbdf3e82e88', name: 'Uttarahalli', code: 'BS-UTT', isDemo: true },
  { id: 'e1000002-0001-4000-8000-000000000004', talukId: '6bca520d-f442-4e3d-9023-cfbdf3e82e88', name: 'Tavarekere', code: 'BS-TAV', isDemo: true },

  // ─── Bengaluru Urban — Bengaluru East ──────────────────────────────────────
  { id: 'e1000003-0001-4000-8000-000000000001', talukId: 'dbb1ce1c-2854-4312-a8b5-728b05d7d1c5', name: 'Varthur', code: 'BE-VAR', isDemo: true },
  { id: 'e1000003-0001-4000-8000-000000000002', talukId: 'dbb1ce1c-2854-4312-a8b5-728b05d7d1c5', name: 'Bidarahalli', code: 'BE-BID', isDemo: true },
  { id: 'e1000003-0001-4000-8000-000000000003', talukId: 'dbb1ce1c-2854-4312-a8b5-728b05d7d1c5', name: 'K.R. Puram', code: 'BE-KRP', isDemo: true },

  // ─── Bengaluru Urban — Anekal ──────────────────────────────────────────────
  { id: 'e1000004-0001-4000-8000-000000000001', talukId: '697a6511-3ac8-4058-982a-1cf65abac0e7', name: 'Kasaba (Anekal)', code: 'ANK-KAS', isDemo: true },
  { id: 'e1000004-0001-4000-8000-000000000002', talukId: '697a6511-3ac8-4058-982a-1cf65abac0e7', name: 'Attibele', code: 'ANK-ATT', isDemo: true },
  { id: 'e1000004-0001-4000-8000-000000000003', talukId: '697a6511-3ac8-4058-982a-1cf65abac0e7', name: 'Sarjapura', code: 'ANK-SAR', isDemo: true },
  { id: 'e1000004-0001-4000-8000-000000000004', talukId: '697a6511-3ac8-4058-982a-1cf65abac0e7', name: 'Jigani', code: 'ANK-JIG', isDemo: true },

  // ─── Bengaluru Urban — Yelahanka ───────────────────────────────────────────
  { id: 'e1000005-0001-4000-8000-000000000001', talukId: '84268c93-9596-4af8-a624-160ac38b0517', name: 'Yelahanka Kasaba', code: 'YLH-KAS', isDemo: true },
  { id: 'e1000005-0001-4000-8000-000000000002', talukId: '84268c93-9596-4af8-a624-160ac38b0517', name: 'Jala', code: 'YLH-JAL', isDemo: true },
  { id: 'e1000005-0001-4000-8000-000000000003', talukId: '84268c93-9596-4af8-a624-160ac38b0517', name: 'Hesaraghatta (Ylh)', code: 'YLH-HES', isDemo: true },

  // ─── Mandya — Mandya Taluk ──────────────────────────────────────────────────
  { id: 'e2000001-0001-4000-8000-000000000001', talukId: 'e61ad754-7544-47d9-859a-ca2dec00a951', name: 'Kasaba (Mandya)', code: 'MAN-KAS', isDemo: true },
  { id: 'e2000001-0001-4000-8000-000000000002', talukId: 'e61ad754-7544-47d9-859a-ca2dec00a951', name: 'Dudda', code: 'MAN-DUD', isDemo: true },
  { id: 'e2000001-0001-4000-8000-000000000003', talukId: 'e61ad754-7544-47d9-859a-ca2dec00a951', name: 'Keragodu', code: 'MAN-KER', isDemo: true },
  { id: 'e2000001-0001-4000-8000-000000000004', talukId: 'e61ad754-7544-47d9-859a-ca2dec00a951', name: 'Kothathi', code: 'MAN-KOT', isDemo: true },
  { id: 'e2000001-0001-4000-8000-000000000005', talukId: 'e61ad754-7544-47d9-859a-ca2dec00a951', name: 'Basaralu', code: 'MAN-BAS', isDemo: true },

  // ─── Mandya — Srirangapatna ─────────────────────────────────────────────────
  { id: 'e2000002-0001-4000-8000-000000000001', talukId: 'b02396d2-66c2-48d8-974e-cc628ffccf20', name: 'Kasaba (Srirangapatna)', code: 'SRP-KAS', isDemo: true },
  { id: 'e2000002-0001-4000-8000-000000000002', talukId: 'b02396d2-66c2-48d8-974e-cc628ffccf20', name: 'Arakere', code: 'SRP-ARA', isDemo: true },
  { id: 'e2000002-0001-4000-8000-000000000003', talukId: 'b02396d2-66c2-48d8-974e-cc628ffccf20', name: 'Belagola', code: 'SRP-BEL', isDemo: true },
  { id: 'e2000002-0001-4000-8000-000000000004', talukId: 'b02396d2-66c2-48d8-974e-cc628ffccf20', name: 'K. Shettihalli', code: 'SRP-KSH', isDemo: true },

  // ─── Mandya — Maddur ────────────────────────────────────────────────────────
  { id: 'e2000003-0001-4000-8000-000000000001', talukId: '3b333f17-64b9-48a8-ae1f-98bba874117a', name: 'Kasaba (Maddur)', code: 'MAD-KAS', isDemo: true },
  { id: 'e2000003-0001-4000-8000-000000000002', talukId: '3b333f17-64b9-48a8-ae1f-98bba874117a', name: 'Koppa', code: 'MAD-KOP', isDemo: true },
  { id: 'e2000003-0001-4000-8000-000000000003', talukId: '3b333f17-64b9-48a8-ae1f-98bba874117a', name: 'Chikkarasinakere', code: 'MAD-CRK', isDemo: true },
  { id: 'e2000003-0001-4000-8000-000000000004', talukId: '3b333f17-64b9-48a8-ae1f-98bba874117a', name: 'Athagur', code: 'MAD-ATH', isDemo: true },

  // ─── Mandya — Pandavapura ───────────────────────────────────────────────────
  { id: 'e2000004-0001-4000-8000-000000000001', talukId: '96576905-54d1-456a-acc9-2dabb7939687', name: 'Kasaba (Pandavapura)', code: 'PAN-KAS', isDemo: true },
  { id: 'e2000004-0001-4000-8000-000000000002', talukId: '96576905-54d1-456a-acc9-2dabb7939687', name: 'Chinakurali', code: 'PAN-CHI', isDemo: true },
  { id: 'e2000004-0001-4000-8000-000000000003', talukId: '96576905-54d1-456a-acc9-2dabb7939687', name: 'Melukote', code: 'PAN-MEL', isDemo: true },

  // ─── Mysuru — Mysuru Taluk ──────────────────────────────────────────────────
  { id: 'e3000001-0001-4000-8000-000000000001', talukId: 'f53eaef6-2872-4dbe-bed6-72680b4ac0cf', name: 'Kasaba (Mysuru)', code: 'MYS-KAS', isDemo: true },
  { id: 'e3000001-0001-4000-8000-000000000002', talukId: 'f53eaef6-2872-4dbe-bed6-72680b4ac0cf', name: 'Varuna', code: 'MYS-VAR', isDemo: true },
  { id: 'e3000001-0001-4000-8000-000000000003', talukId: 'f53eaef6-2872-4dbe-bed6-72680b4ac0cf', name: 'Jayapura', code: 'MYS-JAY', isDemo: true },
  { id: 'e3000001-0001-4000-8000-000000000004', talukId: 'f53eaef6-2872-4dbe-bed6-72680b4ac0cf', name: 'Ilavala', code: 'MYS-ILA', isDemo: true },

  // ─── Mysuru — Nanjangud ─────────────────────────────────────────────────────
  { id: 'e3000002-0001-4000-8000-000000000001', talukId: '879e6f03-9f1d-4c64-a67e-33bf19e0fd11', name: 'Kasaba (Nanjangud)', code: 'NAN-KAS', isDemo: true },
  { id: 'e3000002-0001-4000-8000-000000000002', talukId: '879e6f03-9f1d-4c64-a67e-33bf19e0fd11', name: 'Biligere', code: 'NAN-BIL', isDemo: true },
  { id: 'e3000002-0001-4000-8000-000000000003', talukId: '879e6f03-9f1d-4c64-a67e-33bf19e0fd11', name: 'Hullahalli', code: 'NAN-HUL', isDemo: true },

  // ─── Mysuru — Hunsur ────────────────────────────────────────────────────────
  { id: 'e3000003-0001-4000-8000-000000000001', talukId: '0ed6114d-4a91-4007-979a-896570eefd38', name: 'Kasaba (Hunsur)', code: 'HUN-KAS', isDemo: true },
  { id: 'e3000003-0001-4000-8000-000000000002', talukId: '0ed6114d-4a91-4007-979a-896570eefd38', name: 'Hanagodu', code: 'HUN-HAN', isDemo: true },
  { id: 'e3000003-0001-4000-8000-000000000003', talukId: '0ed6114d-4a91-4007-979a-896570eefd38', name: 'Bilikere', code: 'HUN-BIL', isDemo: true },

  // ─── Mysuru — T. Narasipura ─────────────────────────────────────────────────
  { id: 'e3000004-0001-4000-8000-000000000001', talukId: '7cc5dad6-d221-46eb-bab7-c76d0b14afc9', name: 'Kasaba (T. Narasipura)', code: 'TNP-KAS', isDemo: true },
  { id: 'e3000004-0001-4000-8000-000000000002', talukId: '7cc5dad6-d221-46eb-bab7-c76d0b14afc9', name: 'Bannur', code: 'TNP-BAN', isDemo: true },
  { id: 'e3000004-0001-4000-8000-000000000003', talukId: '7cc5dad6-d221-46eb-bab7-c76d0b14afc9', name: 'Mugur', code: 'TNP-MUG', isDemo: true },
];

export const DEMO_VILLAGES: DemoVillage[] = [
  // ─── Bengaluru North — Kasaba ──────────────────────────────────────────────
  { id: 'f1000001-0001-4000-8000-000000000001', hobliId: 'e1000001-0001-4000-8000-000000000001', name: 'Peenya', code: 'V-PEE', isDemo: true },
  { id: 'f1000001-0001-4000-8000-000000000002', hobliId: 'e1000001-0001-4000-8000-000000000001', name: 'Yeshwanthpur', code: 'V-YES', isDemo: true },
  { id: 'f1000001-0001-4000-8000-000000000003', hobliId: 'e1000001-0001-4000-8000-000000000001', name: 'Jalahalli', code: 'V-JAL', isDemo: true },
  { id: 'f1000001-0001-4000-8000-000000000004', hobliId: 'e1000001-0001-4000-8000-000000000001', name: 'Mathikere', code: 'V-MAT', isDemo: true },
  { id: 'f1000001-0001-4000-8000-000000000005', hobliId: 'e1000001-0001-4000-8000-000000000001', name: 'Hebbal', code: 'V-HEB', isDemo: true },

  // ─── Bengaluru North — Dasanapura ──────────────────────────────────────────
  { id: 'f1000001-0002-4000-8000-000000000001', hobliId: 'e1000001-0001-4000-8000-000000000002', name: 'Dasanapura', code: 'V-DAS', isDemo: true },
  { id: 'f1000001-0002-4000-8000-000000000002', hobliId: 'e1000001-0001-4000-8000-000000000002', name: 'Alur', code: 'V-ALU', isDemo: true },
  { id: 'f1000001-0002-4000-8000-000000000003', hobliId: 'e1000001-0001-4000-8000-000000000002', name: 'Makali', code: 'V-MAK', isDemo: true },
  { id: 'f1000001-0002-4000-8000-000000000004', hobliId: 'e1000001-0001-4000-8000-000000000002', name: 'Madavara', code: 'V-MAD', isDemo: true },
  { id: 'f1000001-0002-4000-8000-000000000005', hobliId: 'e1000001-0001-4000-8000-000000000002', name: 'Nelagadaranahalli', code: 'V-NEL', isDemo: true },

  // ─── Bengaluru North — Yeshwanthapura ──────────────────────────────────────
  { id: 'f1000001-0003-4000-8000-000000000001', hobliId: 'e1000001-0001-4000-8000-000000000003', name: 'Kamakshipalya', code: 'V-KAM', isDemo: true },
  { id: 'f1000001-0003-4000-8000-000000000002', hobliId: 'e1000001-0001-4000-8000-000000000003', name: 'Laggere', code: 'V-LAG', isDemo: true },
  { id: 'f1000001-0003-4000-8000-000000000003', hobliId: 'e1000001-0001-4000-8000-000000000003', name: 'Nandini Layout', code: 'V-NAN', isDemo: true },

  // ─── Bengaluru North — Hesaraghatta ────────────────────────────────────────
  { id: 'f1000001-0004-4000-8000-000000000001', hobliId: 'e1000001-0001-4000-8000-000000000004', name: 'Hesaraghatta Village', code: 'V-HES', isDemo: true },
  { id: 'f1000001-0004-4000-8000-000000000002', hobliId: 'e1000001-0001-4000-8000-000000000004', name: 'Kakolu', code: 'V-KAK', isDemo: true },
  { id: 'f1000001-0004-4000-8000-000000000003', hobliId: 'e1000001-0001-4000-8000-000000000004', name: 'Silvepura', code: 'V-SIL', isDemo: true },

  // ─── Bengaluru South — Begur ───────────────────────────────────────────────
  { id: 'f1000002-0001-4000-8000-000000000001', hobliId: 'e1000002-0001-4000-8000-000000000001', name: 'Begur Village', code: 'V-BEG', isDemo: true },
  { id: 'f1000002-0001-4000-8000-000000000002', hobliId: 'e1000002-0001-4000-8000-000000000001', name: 'Bommanahalli', code: 'V-BOM', isDemo: true },
  { id: 'f1000002-0001-4000-8000-000000000003', hobliId: 'e1000002-0001-4000-8000-000000000001', name: 'Hulimavu', code: 'V-HUL', isDemo: true },
  { id: 'f1000002-0001-4000-8000-000000000004', hobliId: 'e1000002-0001-4000-8000-000000000001', name: 'Singasandra', code: 'V-SIN', isDemo: true },
  { id: 'f1000002-0001-4000-8000-000000000005', hobliId: 'e1000002-0001-4000-8000-000000000001', name: 'Arakere', code: 'V-ARA', isDemo: true },

  // ─── Bengaluru South — Kengeri ─────────────────────────────────────────────
  { id: 'f1000002-0002-4000-8000-000000000001', hobliId: 'e1000002-0001-4000-8000-000000000002', name: 'Kengeri Village', code: 'V-KEN', isDemo: true },
  { id: 'f1000002-0002-4000-8000-000000000002', hobliId: 'e1000002-0001-4000-8000-000000000002', name: 'Nagarbhavi', code: 'V-NAG', isDemo: true },
  { id: 'f1000002-0002-4000-8000-000000000003', hobliId: 'e1000002-0001-4000-8000-000000000002', name: 'Kumbalgodu', code: 'V-KUM', isDemo: true },
  { id: 'f1000002-0002-4000-8000-000000000004', hobliId: 'e1000002-0001-4000-8000-000000000002', name: 'Hemmigepura', code: 'V-HEM', isDemo: true },
  { id: 'f1000002-0002-4000-8000-000000000005', hobliId: 'e1000002-0001-4000-8000-000000000002', name: 'Ramohalli', code: 'V-RAM', isDemo: true },

  // ─── Bengaluru South — Uttarahalli ─────────────────────────────────────────
  { id: 'f1000002-0003-4000-8000-000000000001', hobliId: 'e1000002-0001-4000-8000-000000000003', name: 'Uttarahalli Manavarthekaval', code: 'V-UTT', isDemo: true },
  { id: 'f1000002-0003-4000-8000-000000000002', hobliId: 'e1000002-0001-4000-8000-000000000003', name: 'Konanakunte', code: 'V-KON', isDemo: true },
  { id: 'f1000002-0003-4000-8000-000000000003', hobliId: 'e1000002-0001-4000-8000-000000000003', name: 'Vajarahalli', code: 'V-VAJ', isDemo: true },
  { id: 'f1000002-0003-4000-8000-000000000004', hobliId: 'e1000002-0001-4000-8000-000000000003', name: 'Subramanyapura', code: 'V-SUB', isDemo: true },

  // ─── Bengaluru South — Tavarekere ──────────────────────────────────────────
  { id: 'f1000002-0004-4000-8000-000000000001', hobliId: 'e1000002-0001-4000-8000-000000000004', name: 'Tavarekere Village', code: 'V-TAV', isDemo: true },
  { id: 'f1000002-0004-4000-8000-000000000002', hobliId: 'e1000002-0001-4000-8000-000000000004', name: 'Chunchanakuppe', code: 'V-CHU', isDemo: true },

  // ─── Bengaluru East — Varthur ──────────────────────────────────────────────
  { id: 'f1000003-0001-4000-8000-000000000001', hobliId: 'e1000003-0001-4000-8000-000000000001', name: 'Varthur Village', code: 'V-VAR', isDemo: true },
  { id: 'f1000003-0001-4000-8000-000000000002', hobliId: 'e1000003-0001-4000-8000-000000000001', name: 'Bellandur', code: 'V-BEL', isDemo: true },
  { id: 'f1000003-0001-4000-8000-000000000003', hobliId: 'e1000003-0001-4000-8000-000000000001', name: 'Whitefield', code: 'V-WHI', isDemo: true },
  { id: 'f1000003-0001-4000-8000-000000000004', hobliId: 'e1000003-0001-4000-8000-000000000001', name: 'Marathahalli', code: 'V-MAR', isDemo: true },
  { id: 'f1000003-0001-4000-8000-000000000005', hobliId: 'e1000003-0001-4000-8000-000000000001', name: 'Gunjur', code: 'V-GUN', isDemo: true },

  // ─── Bengaluru East — Bidarahalli ──────────────────────────────────────────
  { id: 'f1000003-0002-4000-8000-000000000001', hobliId: 'e1000003-0001-4000-8000-000000000002', name: 'Bidarahalli Village', code: 'V-BID', isDemo: true },
  { id: 'f1000003-0002-4000-8000-000000000002', hobliId: 'e1000003-0001-4000-8000-000000000002', name: 'Avalahalli', code: 'V-AVA', isDemo: true },
  { id: 'f1000003-0002-4000-8000-000000000003', hobliId: 'e1000003-0001-4000-8000-000000000002', name: 'Mandur', code: 'V-MAN', isDemo: true },
  { id: 'f1000003-0002-4000-8000-000000000004', hobliId: 'e1000003-0001-4000-8000-000000000002', name: 'Kannamangala', code: 'V-KAN', isDemo: true },

  // ─── Bengaluru East — K.R. Puram ───────────────────────────────────────────
  { id: 'f1000003-0003-4000-8000-000000000001', hobliId: 'e1000003-0001-4000-8000-000000000003', name: 'Krishnarajapura', code: 'V-KRP', isDemo: true },
  { id: 'f1000003-0003-4000-8000-000000000002', hobliId: 'e1000003-0001-4000-8000-000000000003', name: 'Mahadevapura', code: 'V-MAH', isDemo: true },
  { id: 'f1000003-0003-4000-8000-000000000003', hobliId: 'e1000003-0001-4000-8000-000000000003', name: 'Hoodi', code: 'V-HOO', isDemo: true },
  { id: 'f1000003-0003-4000-8000-000000000004', hobliId: 'e1000003-0001-4000-8000-000000000003', name: 'Kadugodi', code: 'V-KAD', isDemo: true },

  // ─── Bengaluru Urban — Anekal Hoblis ───────────────────────────────────────
  { id: 'f1000004-0001-4000-8000-000000000001', hobliId: 'e1000004-0001-4000-8000-000000000001', name: 'Anekal Town', code: 'V-AKT', isDemo: true },
  { id: 'f1000004-0001-4000-8000-000000000002', hobliId: 'e1000004-0001-4000-8000-000000000001', name: 'Byagadadenahalli', code: 'V-BYA', isDemo: true },
  { id: 'f1000004-0001-4000-8000-000000000003', hobliId: 'e1000004-0001-4000-8000-000000000001', name: 'Haragadde', code: 'V-HAR', isDemo: true },
  { id: 'f1000004-0002-4000-8000-000000000001', hobliId: 'e1000004-0001-4000-8000-000000000002', name: 'Attibele Village', code: 'V-ATT', isDemo: true },
  { id: 'f1000004-0002-4000-8000-000000000002', hobliId: 'e1000004-0001-4000-8000-000000000002', name: 'Mayasandra', code: 'V-MAY', isDemo: true },
  { id: 'f1000004-0002-4000-8000-000000000003', hobliId: 'e1000004-0001-4000-8000-000000000002', name: 'Yadavanahalli', code: 'V-YAD', isDemo: true },
  { id: 'f1000004-0003-4000-8000-000000000001', hobliId: 'e1000004-0001-4000-8000-000000000003', name: 'Sarjapura Village', code: 'V-SAR', isDemo: true },
  { id: 'f1000004-0003-4000-8000-000000000002', hobliId: 'e1000004-0001-4000-8000-000000000003', name: 'Mugalur', code: 'V-MUG', isDemo: true },
  { id: 'f1000004-0003-4000-8000-000000000003', hobliId: 'e1000004-0001-4000-8000-000000000003', name: 'Yamare', code: 'V-YAM', isDemo: true },
  { id: 'f1000004-0004-4000-8000-000000000001', hobliId: 'e1000004-0001-4000-8000-000000000004', name: 'Jigani Village', code: 'V-JIG', isDemo: true },
  { id: 'f1000004-0004-4000-8000-000000000002', hobliId: 'e1000004-0001-4000-8000-000000000004', name: 'Kallubalu', code: 'V-KAL', isDemo: true },

  // ─── Bengaluru Urban — Yelahanka Hoblis ─────────────────────────────────────
  { id: 'f1000005-0001-4000-8000-000000000001', hobliId: 'e1000005-0001-4000-8000-000000000001', name: 'Yelahanka Village', code: 'V-YLH', isDemo: true },
  { id: 'f1000005-0001-4000-8000-000000000002', hobliId: 'e1000005-0001-4000-8000-000000000001', name: 'Allalasandra', code: 'V-ALL', isDemo: true },
  { id: 'f1000005-0001-4000-8000-000000000003', hobliId: 'e1000005-0001-4000-8000-000000000001', name: 'Jakkur', code: 'V-JAK', isDemo: true },
  { id: 'f1000005-0002-4000-8000-000000000001', hobliId: 'e1000005-0001-4000-8000-000000000002', name: 'Bagalur', code: 'V-BAG', isDemo: true },
  { id: 'f1000005-0002-4000-8000-000000000002', hobliId: 'e1000005-0001-4000-8000-000000000002', name: 'Chikkajala', code: 'V-CHJ', isDemo: true },

  // ─── Mandya — Mandya Taluk Hoblis ───────────────────────────────────────────
  { id: 'f2000001-0001-4000-8000-000000000001', hobliId: 'e2000001-0001-4000-8000-000000000001', name: 'Mandya Rural', code: 'V-MNR', isDemo: true },
  { id: 'f2000001-0001-4000-8000-000000000002', hobliId: 'e2000001-0001-4000-8000-000000000001', name: 'Guthalu', code: 'V-GUT', isDemo: true },
  { id: 'f2000001-0001-4000-8000-000000000003', hobliId: 'e2000001-0001-4000-8000-000000000001', name: 'Induvalu', code: 'V-IND', isDemo: true },
  { id: 'f2000001-0002-4000-8000-000000000001', hobliId: 'e2000001-0001-4000-8000-000000000002', name: 'Dudda Village', code: 'V-DUD', isDemo: true },
  { id: 'f2000001-0002-4000-8000-000000000002', hobliId: 'e2000001-0001-4000-8000-000000000002', name: 'Shivalli', code: 'V-SHI', isDemo: true },
  { id: 'f2000001-0003-4000-8000-000000000001', hobliId: 'e2000001-0001-4000-8000-000000000003', name: 'Keragodu Village', code: 'V-KER', isDemo: true },
  { id: 'f2000001-0003-4000-8000-000000000002', hobliId: 'e2000001-0001-4000-8000-000000000003', name: 'Hulivana', code: 'V-HULV', isDemo: true },

  // ─── Mandya — Srirangapatna Hoblis ──────────────────────────────────────────
  { id: 'f2000002-0001-4000-8000-000000000001', hobliId: 'e2000002-0001-4000-8000-000000000001', name: 'Srirangapatna Town', code: 'V-SPT', isDemo: true },
  { id: 'f2000002-0001-4000-8000-000000000002', hobliId: 'e2000002-0001-4000-8000-000000000001', name: 'Ganjam', code: 'V-GAN', isDemo: true },
  { id: 'f2000002-0001-4000-8000-000000000003', hobliId: 'e2000002-0001-4000-8000-000000000001', name: 'Baburayanakoppal', code: 'V-BRK', isDemo: true },
  { id: 'f2000002-0002-4000-8000-000000000001', hobliId: 'e2000002-0001-4000-8000-000000000002', name: 'Arakere Village', code: 'V-ARK', isDemo: true },
  { id: 'f2000002-0002-4000-8000-000000000002', hobliId: 'e2000002-0001-4000-8000-000000000002', name: 'Mandagere', code: 'V-MND', isDemo: true },
  { id: 'f2000002-0002-4000-8000-000000000003', hobliId: 'e2000002-0001-4000-8000-000000000002', name: 'Kodiyala', code: 'V-KOD', isDemo: true },
  { id: 'f2000002-0003-4000-8000-000000000001', hobliId: 'e2000002-0001-4000-8000-000000000003', name: 'Belagola Village', code: 'V-BLG', isDemo: true },
  { id: 'f2000002-0003-4000-8000-000000000002', hobliId: 'e2000002-0001-4000-8000-000000000003', name: 'KRS Dam Area', code: 'V-KRS', isDemo: true },

  // ─── Mandya — Maddur Hoblis ─────────────────────────────────────────────────
  { id: 'f2000003-0001-4000-8000-000000000001', hobliId: 'e2000003-0001-4000-8000-000000000001', name: 'Maddur Town', code: 'V-MDR', isDemo: true },
  { id: 'f2000003-0001-4000-8000-000000000002', hobliId: 'e2000003-0001-4000-8000-000000000001', name: 'Shivapura', code: 'V-SVP', isDemo: true },
  { id: 'f2000003-0001-4000-8000-000000000003', hobliId: 'e2000003-0001-4000-8000-000000000001', name: 'Gejjalagere', code: 'V-GEJ', isDemo: true },
  { id: 'f2000003-0002-4000-8000-000000000001', hobliId: 'e2000003-0001-4000-8000-000000000002', name: 'Koppa Village', code: 'V-KOP', isDemo: true },
  { id: 'f2000003-0002-4000-8000-000000000002', hobliId: 'e2000003-0001-4000-8000-000000000002', name: 'Besagarahalli', code: 'V-BES', isDemo: true },

  // ─── Mandya — Pandavapura Hoblis ────────────────────────────────────────────
  { id: 'f2000004-0001-4000-8000-000000000001', hobliId: 'e2000004-0001-4000-8000-000000000001', name: 'Pandavapura Town', code: 'V-PPT', isDemo: true },
  { id: 'f2000004-0001-4000-8000-000000000002', hobliId: 'e2000004-0001-4000-8000-000000000001', name: 'Haravu', code: 'V-HARV', isDemo: true },
  { id: 'f2000004-0001-4000-8000-000000000003', hobliId: 'e2000004-0001-4000-8000-000000000001', name: 'Melukote Village', code: 'V-MEL', isDemo: true },

  // ─── Mysuru — Mysuru Taluk Hoblis ───────────────────────────────────────────
  { id: 'f3000001-0001-4000-8000-000000000001', hobliId: 'e3000001-0001-4000-8000-000000000001', name: 'Chamundi Hill', code: 'V-CHM', isDemo: true },
  { id: 'f3000001-0001-4000-8000-000000000002', hobliId: 'e3000001-0001-4000-8000-000000000001', name: 'Alanahalli', code: 'V-ALA', isDemo: true },
  { id: 'f3000001-0001-4000-8000-000000000003', hobliId: 'e3000001-0001-4000-8000-000000000001', name: 'Hinkal', code: 'V-HIN', isDemo: true },
  { id: 'f3000001-0001-4000-8000-000000000004', hobliId: 'e3000001-0001-4000-8000-000000000001', name: 'Bogadi', code: 'V-BOG', isDemo: true },
  { id: 'f3000001-0001-4000-8000-000000000005', hobliId: 'e3000001-0001-4000-8000-000000000001', name: 'Metagalli', code: 'V-MET', isDemo: true },
  { id: 'f3000001-0002-4000-8000-000000000001', hobliId: 'e3000001-0001-4000-8000-000000000002', name: 'Varuna Village', code: 'V-VARN', isDemo: true },
  { id: 'f3000001-0002-4000-8000-000000000002', hobliId: 'e3000001-0001-4000-8000-000000000002', name: 'Dandikere', code: 'V-DAN', isDemo: true },
  { id: 'f3000001-0002-4000-8000-000000000003', hobliId: 'e3000001-0001-4000-8000-000000000002', name: 'Megalapura', code: 'V-MEG', isDemo: true },
  { id: 'f3000001-0003-4000-8000-000000000001', hobliId: 'e3000001-0001-4000-8000-000000000003', name: 'Jayapura Village', code: 'V-JAY', isDemo: true },
  { id: 'f3000001-0003-4000-8000-000000000002', hobliId: 'e3000001-0001-4000-8000-000000000003', name: 'Udbur', code: 'V-UDB', isDemo: true },
  { id: 'f3000001-0004-4000-8000-000000000001', hobliId: 'e3000001-0001-4000-8000-000000000004', name: 'Ilavala Village', code: 'V-ILA', isDemo: true },
  { id: 'f3000001-0004-4000-8000-000000000002', hobliId: 'e3000001-0001-4000-8000-000000000004', name: 'Koorgalli', code: 'V-KOO', isDemo: true },
  { id: 'f3000001-0004-4000-8000-000000000003', hobliId: 'e3000001-0001-4000-8000-000000000004', name: 'Belavatha', code: 'V-BELV', isDemo: true },

  // ─── Mysuru — Nanjangud Hoblis ──────────────────────────────────────────────
  { id: 'f3000002-0001-4000-8000-000000000001', hobliId: 'e3000002-0001-4000-8000-000000000001', name: 'Nanjangud Town', code: 'V-NJT', isDemo: true },
  { id: 'f3000002-0001-4000-8000-000000000002', hobliId: 'e3000002-0001-4000-8000-000000000001', name: 'Hullahalli', code: 'V-HULH', isDemo: true },
  { id: 'f3000002-0002-4000-8000-000000000001', hobliId: 'e3000002-0001-4000-8000-000000000002', name: 'Biligere Village', code: 'V-BLGV', isDemo: true },
  { id: 'f3000002-0002-4000-8000-000000000002', hobliId: 'e3000002-0001-4000-8000-000000000002', name: 'Thandavapura', code: 'V-THA', isDemo: true },

  // ─── Mysuru — Hunsur Hoblis ─────────────────────────────────────────────────
  { id: 'f3000003-0001-4000-8000-000000000001', hobliId: 'e3000003-0001-4000-8000-000000000001', name: 'Hunsur Town', code: 'V-HNT', isDemo: true },
  { id: 'f3000003-0001-4000-8000-000000000002', hobliId: 'e3000003-0001-4000-8000-000000000001', name: 'Bilikere', code: 'V-BLK', isDemo: true },
  { id: 'f3000003-0002-4000-8000-000000000001', hobliId: 'e3000003-0001-4000-8000-000000000002', name: 'Hanagodu Village', code: 'V-HNG', isDemo: true },
  { id: 'f3000003-0002-4000-8000-000000000002', hobliId: 'e3000003-0001-4000-8000-000000000002', name: 'Nilavagilu', code: 'V-NIL', isDemo: true },

  // ─── Mysuru — T. Narasipura Hoblis ──────────────────────────────────────────
  { id: 'f3000004-0001-4000-8000-000000000001', hobliId: 'e3000004-0001-4000-8000-000000000001', name: 'T. Narasipura Town', code: 'V-TNT', isDemo: true },
  { id: 'f3000004-0001-4000-8000-000000000002', hobliId: 'e3000004-0001-4000-8000-000000000001', name: 'Bannur', code: 'V-BNR', isDemo: true },
  { id: 'f3000004-0001-4000-8000-000000000003', hobliId: 'e3000004-0001-4000-8000-000000000001', name: 'Talkad', code: 'V-TAL', isDemo: true },
];

export function getDemoTaluks(districtIdOrName: string): DemoTaluk[] {
  if (!districtIdOrName) return [];
  const target = districtIdOrName.trim().toLowerCase();
  const matchedDistrict = DEMO_DISTRICTS.find(
    d => d.id.toLowerCase() === target || d.name.toLowerCase() === target || d.code.toLowerCase() === target
  );
  const targetId = matchedDistrict ? matchedDistrict.id : districtIdOrName;

  const matches = DEMO_TALUKS.filter(t => t.districtId === targetId || t.districtId.toLowerCase() === target);
  const list = matches.length > 0 ? matches : DEMO_TALUKS.filter(t => t.districtId === '44ddb060-53cf-4c38-863a-368f25212485');
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function getDemoHoblis(talukIdOrName: string): DemoHobli[] {
  if (!talukIdOrName) return [];
  const target = talukIdOrName.trim().toLowerCase();
  const matchedTaluk = DEMO_TALUKS.find(
    t => t.id.toLowerCase() === target || t.name.toLowerCase() === target || t.code.toLowerCase() === target
  );
  const targetId = matchedTaluk ? matchedTaluk.id : talukIdOrName;

  const matches = DEMO_HOBLIS.filter(h => h.talukId === targetId || h.talukId.toLowerCase() === target);
  const list = matches.length > 0 ? matches : DEMO_HOBLIS.filter(h => h.talukId === '94217fa0-dd0f-4975-8ad9-f4da0b0590fb');
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function getDemoVillages(hobliIdOrName: string): DemoVillage[] {
  if (!hobliIdOrName) return [];
  const target = hobliIdOrName.trim().toLowerCase();
  const matchedHobli = DEMO_HOBLIS.find(
    h => h.id.toLowerCase() === target || h.name.toLowerCase() === target || h.code.toLowerCase() === target
  );
  const targetId = matchedHobli ? matchedHobli.id : hobliIdOrName;

  const matches = DEMO_VILLAGES.filter(v => v.hobliId === targetId || v.hobliId.toLowerCase() === target);
  const list = matches.length > 0 ? matches : DEMO_VILLAGES.filter(v => v.hobliId === 'e1000001-0001-4000-8000-000000000001');
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function findHierarchyMatch(districtId: string, talukId: string, hobliId: string, villageId: string) {
  const d = DEMO_DISTRICTS.find(x => x.id === districtId || x.name.toLowerCase() === districtId.toLowerCase());
  const t = DEMO_TALUKS.find(x => (x.id === talukId || x.name.toLowerCase() === talukId.toLowerCase()) && (!d || x.districtId === d.id));
  const h = DEMO_HOBLIS.find(x => (x.id === hobliId || x.name.toLowerCase() === hobliId.toLowerCase()) && (!t || x.talukId === t.id));
  const v = DEMO_VILLAGES.find(x => (x.id === villageId || x.name.toLowerCase() === villageId.toLowerCase()) && (!h || x.hobliId === h.id));
  if (d || t || h || v) {
    return {
      district: d?.name || 'Bengaluru Urban',
      taluk: t?.name || 'Bengaluru North',
      hobli: h?.name || 'Kasaba (North)',
      village: v?.name || 'Peenya'
    };
  }
  return null;
}
