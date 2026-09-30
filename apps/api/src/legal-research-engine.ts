/**
/**
 * Legal Research Engine - Karnataka & Pan-India Real Estate Due Diligence
 * Covers statutory provisions, regulatory buffers, case law precedents,
 * and practitioner checklists for title diligence.
 */

export interface LegalPrecedent {
  caseName: string;
  citation: string;
  court: string;
  year: number;
  bench?: string;
  ratio: string;
  dueDiligenceImpact: string;
}

export interface StatutoryProvision {
  id: string;
  actName: string;
  actShortCode: string;
  section: string;
  category: 
    | 'agricultural_ceiling'
    | 'sc_st_ptcl'
    | 'land_conversion'
    | 'registration_stamp'
    | 'title_transfer'
    | 'urban_planning'
    | 'environmental_buffer'
    | 'inheritance_succession'
    | 'rera_compliance';

  severity: 'critical' | 'high' | 'medium';
  title: string;
  summary: string;
  statutoryText: string;
  practitionerNotes: string;
  keyPrecedents: LegalPrecedent[];
  relevantDocTypes: string[];
  mandatoryChecks: string[];
}

export const STATUTORY_PROVISIONS: StatutoryProvision[] = [
  {
    id: 'ptcl_1978_sec4_5',
    actName: 'Karnataka SC & ST (Prohibition of Transfer of Certain Lands) Act, 1978',
    actShortCode: 'PTCL Act 1978',
    section: 'Sections 4 & 5',
    category: 'sc_st_ptcl',
    severity: 'critical',
    title: 'Nullification of Transfer of Granted Lands to SC/ST Persons',
    summary: 'Any transfer of land granted by the Government to persons belonging to Scheduled Castes or Scheduled Tribes made without prior permission of the State Government is void ab initio. Assistant Commissioners possess summary powers to resume and restore such lands to the original grantee or their legal heirs.',
    statutoryText: 'Section 4(1): Notwithstanding anything in any law, agreement, contract or decree, any transfer of granted land made either before or after the commencement of this Act, in contravention of the terms of the grant or of the law, or without prior permission of the State Government, shall be null and void and no right, title or interest shall be conveyed.',
    practitionerNotes: 'Crucial for Karnataka title search: Always trace the original grant (Saguvali Chit). Check whether the land was granted to a member of SC/ST with non-alienation conditions. Even if 30+ years have passed, verify whether prior sanction from the Deputy Commissioner was obtained. Note the Supreme Court doctrine of reasonable time in Nekkanti Rama Lakshmi, but do not rely on limitation alone without revenue enquiry.',
    keyPrecedents: [
      {
        caseName: 'Nekkanti Rama Lakshmi v. State of Karnataka',
        citation: '(2020) 14 SCC 232',
        court: 'Supreme Court of India',
        year: 2020,
        bench: 'R. Banumathi, A.S. Bopanna JJ.',
        ratio: 'Even where no period of limitation is prescribed under Section 5 of the PTCL Act, application for resumption/restoration must be filed within a reasonable time (typically 20-25 years). Delay of 25+ years without plausible justification invalidates resumption proceedings.',
        dueDiligenceImpact: 'While delay may protect bona fide purchasers in court, revenue authorities still initiate proceedings. Require seller indemnity and check AC court pending register.'
      },
      {
        caseName: 'Satyan v. Deputy Commissioner',
        citation: '(2020) 14 SCC 285',
        court: 'Supreme Court of India',
        year: 2020,
        bench: 'U.U. Lalit, Vineet Saran JJ.',
        ratio: 'Delay of 8 years in approaching the Assistant Commissioner under PTCL Act is not unreasonable, whereas delay of 25 years without explanation is fatal.',
        dueDiligenceImpact: 'Any transaction within 10-15 years of an alleged grant violation remains vulnerable to resumption.'
      }
    ],
    relevantDocTypes: ['sale_deed', 'mutation', 'rtc', 'grant_certificate'],
    mandatoryChecks: [
      'Inspect Saguvali Chit / Grant Certificate for caste status and non-alienation clause',
      'Verify prior DC Permission under Section 4(2) if transfer occurred post-1978',
      'Check Assistant Commissioner / DC Revenue Court pending cases register',
      'Inspect Village Chawdi mutation registers for PTCL caveats'
    ]
  },
  {
    id: 'klra_1961_sec79ab',
    actName: 'Karnataka Land Reforms Act, 1961',
    actShortCode: 'KLRA 1961',
    section: 'Sections 79A, 79B & 80',
    category: 'agricultural_ceiling',
    severity: 'critical',
    title: 'Prohibition on Acquisition of Agricultural Land by Non-Agriculturists',
    summary: 'Prohibited non-agriculturists and persons with non-agricultural income exceeding statutory thresholds from purchasing agricultural land. Although omitted/amended by Karnataka Act 56 of 2020, title transactions executed prior to the 2020 amendment where proceedings were already initiated or pending remain vulnerable to scrutiny.',
    statutoryText: 'Section 79A: Bar on acquisition of land by certain persons having non-agricultural income. Section 80: Transfer to non-agriculturists barred. Section 83: Inquiry by Assistant Commissioner regarding illegal transactions and forfeiture to State Government.',
    practitionerNotes: 'For all historical title links between 1974 and November 2020, verify that the purchaser had agricultural status or obtained Assistant Commissioner exemption under Section 109. Check whether Form 7 / Form 7A occupancy rights or Section 83 forfeiture notices were ever served.',
    keyPrecedents: [
      {
        caseName: 'B.R. Ganesh v. State of Karnataka',
        citation: 'ILR 2004 KAR 2215',
        court: 'High Court of Karnataka',
        year: 2004,
        bench: 'Division Bench',
        ratio: 'A company or artificial juridical person is not an agriculturist and cannot acquire agricultural land without statutory exemption under Section 109 of KLRA.',
        dueDiligenceImpact: 'Deeds in favour of private limited companies before land conversion must show Section 109 Government notification.'
      }
    ],
    relevantDocTypes: ['sale_deed', 'conversion_order', 'rtc', 'mutation'],
    mandatoryChecks: [
      'Check if purchaser prior to Nov 2020 held agriculturist status',
      'Verify Section 109 Government exemption order if acquired by corporate entities',
      'Inspect Land Tribunal orders (Form 10) for tenanted land history'
    ]
  },
  {
    id: 'klr_1964_sec95',
    actName: 'Karnataka Land Revenue Act, 1964',
    actShortCode: 'KLR Act 1964',
    section: 'Section 95',
    category: 'land_conversion',
    severity: 'high',
    title: 'Conversion of Agricultural Land for Non-Agricultural Purposes',
    summary: 'No agricultural land in Karnataka can be utilized for residential, commercial, industrial, or institutional development without prior formal conversion order passed by the Deputy Commissioner under Section 95. Unauthorized diversion attracts penal forfeiture and demolition.',
    statutoryText: 'Section 95(2): If any occupant wishes to divert agriculture land to any other purpose, he shall apply to the Deputy Commissioner for permission. Section 96: Penalty for using agricultural land for other purpose without permission.',
    practitionerNotes: 'Verify the official DC Conversion Order signed by the Deputy Commissioner / Special DC. Confirm payment of conversion fine / challan receipt. Check conversion conditions regarding setback, road widening, and drainage. Cross-verify with Tahsildar conversion register to guard against forged conversion orders.',
    keyPrecedents: [
      {
        caseName: 'State of Karnataka v. Shankara Textiles Mills Ltd.',
        citation: '(1995) 1 SCC 295',
        court: 'Supreme Court of India',
        year: 1995,
        ratio: 'Merely paying property tax to a local municipality or inclusion in town planning limits does not automatically convert agricultural land. Formal DC Conversion under Section 95 is mandatory.',
        dueDiligenceImpact: 'Panchayat or BBMP khata without DC conversion order does not confer valid non-agricultural title.'
      }
    ],
    relevantDocTypes: ['conversion_order', 'rtc', 'sanction_plan'],
    mandatoryChecks: [
      'Match Survey Number, Village, and exact Extent in DC Conversion Order',
      'Verify Treasury Challan payment receipt for conversion fine',
      'Check whether conversion condition precedent (e.g. road surrender) was fulfilled',
      'Verify subsequent RTC reflects non-agricultural status (Karab / Parivarthane)'
    ]
  },
  {
    id: 'ira_1908_sec25',
    actName: 'Registration Act, 1908',
    actShortCode: 'Registration Act 1908',
    section: 'Sections 23 & 25',
    category: 'registration_stamp',
    severity: 'critical',
    title: 'Time Limit for Presentation of Documents for Registration',
    summary: 'Under Section 23, no document shall be accepted for registration unless presented within 4 months (120 days) from the date of its execution. Section 25 provides that in cases of urgent necessity or unavoidable accident, the Registrar may condone a delay of not more than 4 additional months on payment of a fine up to 10 times the registration fee.',
    statutoryText: 'Section 23: Subject to the provisions contained in sections 24, 25 and 26, no document other than a will shall be accepted for registration unless presented for that purpose to the proper officer within four months from the date of its execution. Section 25(1): Delay not exceeding four months may be condoned by Registrar.',
    practitionerNotes: 'Strict limitation: Any deed presented after 8 months (120 days normal + 120 days maximum extension) is void for want of jurisdiction by the Sub-Registrar. Check dates of execution and registration stamps carefully.',
    keyPrecedents: [
      {
        caseName: 'Raj Kumar Dey v. Tarapada Dey',
        citation: '(1987) 4 SCC 398',
        court: 'Supreme Court of India',
        year: 1987,
        ratio: 'The period of 4 months under Section 23 is mandatory. Unless condoned strictly within Section 25, registration after the statutory limit is without jurisdiction.',
        dueDiligenceImpact: 'Flag any document where registrationDate - executionDate > 120 days without an explicit Section 25 District Registrar condonation endorsement.'
      }
    ],
    relevantDocTypes: ['sale_deed', 'gift_deed', 'mortgage_deed'],
    mandatoryChecks: [
      'Calculate days between execution date and presentation/registration stamp',
      'Inspect SRO endorsement for Section 25 fine receipt if delay > 120 days',
      'Flag invalid registration if total elapsed time exceeds 240 days'
    ]
  },
  {
    id: 'tpa_1882_sec52',
    actName: 'Transfer of Property Act, 1882',
    actShortCode: 'TPA 1882',
    section: 'Section 52',
    category: 'title_transfer',
    severity: 'critical',
    title: 'Doctrine of Lis Pendens - Transfers Pending Court Litigation',
    summary: 'During the pendency in any court of any suit or proceeding which is not collusive and in which any right to immovable property is directly and specifically in question, the property cannot be transferred or otherwise dealt with by any party so as to affect the rights of any other party thereto under any decree or order.',
    statutoryText: 'Section 52: During the pendency in any Court having authority within the limits of India... of any suit or proceeding... the property cannot be transferred or otherwise dealt with by any party to the suit or proceeding so as to affect the rights of any other party thereto.',
    practitionerNotes: 'A buyer of property subject to pending litigation is bound by the eventual decree, even if they had no actual notice and purchased in good faith for value. Always conduct comprehensive court litigation searches in Civil Courts, High Court, and DRT across all family/seller names for the last 30 years.',
    keyPrecedents: [
      {
        caseName: 'Thomson Press (India) Ltd. v. Nanak Builders and Investors P. Ltd.',
        citation: '(2013) 5 SCC 397',
        court: 'Supreme Court of India',
        year: 2013,
        ratio: 'A sale pendente lite is not void ab initio, but is subservient to the rights of the parties to the litigation. The transferee pendente lite acquires no higher right than the transferor.',
        dueDiligenceImpact: 'Court litigation search is non-negotiable. Require explicit seller affidavit of no pending litigation.'
      }
    ],
    relevantDocTypes: ['sale_deed', 'court_decree', 'encumbrance_certificate'],
    mandatoryChecks: [
      'Search e-Courts portal by Survey Number and party names across Bengaluru City Civil and Rural Courts',
      'Verify Encumbrance Certificate for registered attachments or lis pendens notices',
      'Review pending partition or maintenance suits among coparceners'
    ]
  },
  {
    id: 'ngt_lake_swd_buffers',
    actName: 'National Green Tribunal & Karnataka Buffer Zone Regulations',
    actShortCode: 'NGT & BDA Zonal Regs',
    section: 'BDA RMP 2015 & NGT Guidelines',
    category: 'environmental_buffer',
    severity: 'critical',
    title: 'Statutory Buffer Zones for Lakes, Water Bodies & Stormwater Drains (Rajakaluves)',
    summary: 'Bengaluru Revised Master Plan and NGT directions prescribe strict non-buildable buffer zones from water bodies: 30 meters from the boundary of any lake/tank; 50 meters from the centre of Primary Stormwater Drains (Rajakaluve); 25 meters from Secondary Drains; and 15 meters from Tertiary Drains.',
    statutoryText: 'BDA Revised Master Plan 2015 / 2031 Zonal Regulations Clause 4.1.2: A buffer of 30m shall be maintained around lakes. Buffers of 50m, 25m, 15m from primary, secondary and tertiary valley/SWD lines shall be kept as no-construction green zones.',
    practitionerNotes: 'Construction within SWD or Lake buffer zones is illegal and subject to summary demolition by BBMP / Revenue authorities under Section 192A of KLR Act without compensation. Always overlay survey parcel boundaries with KSRSAC / BDA Valley maps.',
    keyPrecedents: [
      {
        caseName: 'Forward Foundation v. State of Karnataka (Bellandur Lake Case)',
        citation: 'Civil Appeal No. 5016 of 2016',
        court: 'Supreme Court of India',
        year: 2019,
        bench: 'Ranjan Gogoi CJI, Deepak Gupta, Sanjiv Khanna JJ.',
        ratio: 'Set aside retrospective application of NGT 75m lake buffer expansion, upholding the 30m lake buffer and 50m/25m/15m SWD buffers as prescribed in the Karnataka Revised Master Plan 2015.',
        dueDiligenceImpact: '30-meter buffer around lake periphery and 50m/25m/15m Rajakaluve buffers are statutorily enforceable.'
      }
    ],
    relevantDocTypes: ['sanction_plan', 'survey_sketch', 'conversion_order'],
    mandatoryChecks: [
      'Overlay cadastral survey polygon on BBMP SWD primary/secondary drain layers',
      'Measure exact perpendicular distance to lake boundary (minimum 30m clearance)',
      'Inspect Village Cadastral Map for historical Halla / Nala paths',
      'Verify that sanctioned building plan excludes buffer zones from built footprint'
    ]
  },
  {
    id: 'hindu_succession_2005_sec6',
    actName: 'Hindu Succession Act, 1956 (as amended in 2005)',
    actShortCode: 'HSA 1956',
    section: 'Section 6',
    category: 'inheritance_succession',
    severity: 'critical',
    title: 'Equal Coparcenary Rights of Daughters in Joint Hindu Family Property',
    summary: 'Under the 2005 Amendment to Section 6, daughters are coparceners by birth with identical rights and liabilities as sons in ancestral property. A conveyance of ancestral joint family property executed without the consent and signature of all living daughters or their legal heirs is vulnerable to partition challenges.',
    statutoryText: 'Section 6(1): On and from the commencement of the Hindu Succession (Amendment) Act, 2005, in a Joint Hindu family governed by the Mitakshara law, the daughter of a coparcener shall by birth become a coparcener in her own right the same manner as the son.',
    practitionerNotes: 'Whenever a property is acquired through ancestral inheritance, partition deed, or release deed, verify that all daughters and sisters joined in the conveyance. Any registered partition prior to December 20, 2004 is protected, but post-2004 deeds require daughter execution.',
    keyPrecedents: [
      {
        caseName: 'Vineeta Sharma v. Rakesh Sharma',
        citation: '(2020) 9 SCC 1',
        court: 'Supreme Court of India',
        year: 2020,
        bench: 'Arun Mishra, S. Abdul Nazeer, M.R. Shah JJ. (3-Judge Bench)',
        ratio: 'The coparcenary right of a daughter under amended Section 6 is retroactive and confers rights by birth, irrespective of whether the father was alive on September 9, 2005.',
        dueDiligenceImpact: 'Title deeds based on release deeds or family settlements where daughters were omitted are high risk. Obtain registered ratification deeds from omitted female heirs.'
      }
    ],
    relevantDocTypes: ['sale_deed', 'partition_deed', 'mutation', 'rtc'],
    mandatoryChecks: [
      'Review Family Genealogical Tree (Vamsha Vruksha) issued by Revenue Inspector / Tahsildar',
      'Verify whether all surviving daughters / sisters signed as executing or consenting parties',
      'Check date of partition deed (must be prior to 20 Dec 2004 to be exempt)'
    ]
  },
  {
    id: 'rera_2016_sec3',
    actName: 'Real Estate (Regulation and Development) Act, 2016',
    actShortCode: 'RERA 2016',
    section: 'Section 3 & 4',
    category: 'rera_compliance',
    severity: 'high',
    title: 'Mandatory Prior Registration of Real Estate Projects',
    summary: 'No promoter shall advertise, market, book, sell or offer for sale any plot, apartment or building in any real estate project exceeding 500 square meters or more than 8 apartments without first registering the project with the Karnataka Real Estate Regulatory Authority (K-RERA).',
    statutoryText: 'Section 3(1): No promoter shall advertise, market, book, sell or offer for sale, or invite persons to purchase in any manner any plot, apartment or building, as the case may be, in any real estate project... without registering the real estate project with the Real Estate Regulatory Authority.',
    practitionerNotes: 'For plotted layouts and apartment purchases, obtain the K-RERA Registration Certificate (PRM number). Verify that the sanctioned layout plan deposited with RERA matches the ground reality and marketing brochures.',
    keyPrecedents: [
      {
        caseName: 'Newtech Promoters and Developers v. State of UP',
        citation: '2021 SCC OnLine SC 1044',
        court: 'Supreme Court of India',
        year: 2021,
        ratio: 'RERA applies to all ongoing projects where completion certificate had not been issued prior to commencement of the Act. Regulatory obligations are retroactive.',
        dueDiligenceImpact: 'Ensure project registration is active and promoter has not defaulted on escrow deposits.'
      }
    ],
    relevantDocTypes: ['sanction_plan', 'rera_certificate', 'sale_agreement'],
    mandatoryChecks: [
      'Verify active K-RERA PRM registration number on rera.karnataka.gov.in',
      'Cross-check quarterly compliance reports and construction milestones',
      'Verify dedicated 70% separate escrow account compliance'
    ]
  },
  {
    id: 'karnataka_stamp_act_1957',
    actName: 'Karnataka Stamp Act, 1957',
    actShortCode: 'Stamp Act 1957',
    section: 'Sections 33 & 34',
    category: 'registration_stamp',
    severity: 'medium',
    title: 'Admissibility & Impounding of Instruments Not Duly Stamped',
    summary: 'Instruments chargeable with duty are inadmissible in evidence for any purpose, nor shall they be acted upon, registered or authenticated by any public officer or court, unless duly stamped. Deficits attract mandatory penalty equal to ten times the amount of the proper duty.',
    statutoryText: 'Section 34: No instrument chargeable with duty shall be admitted in evidence for any purpose by any person having by law or consent of parties authority to receive evidence, or shall be acted upon, registered or authenticated by any such person... unless such instrument is duly stamped.',
    practitionerNotes: 'Agreements of sale with possession (Article 5(e)) and Powers of Attorney conferring development rights require full ad-valorem conveyance stamp duty in Karnataka. Unregistered or insufficiently stamped agreements cannot be enforced in court without paying 10x penalty.',
    keyPrecedents: [
      {
        caseName: 'SMS Tea Estates (P) Ltd. v. Chandmari Tea Co. (P) Ltd.',
        citation: '(2011) 14 SCC 66',
        court: 'Supreme Court of India',
        year: 2011,
        ratio: 'Court cannot act upon or enforce arbitration clauses in an unstamped or insufficiently stamped agreement until the deficit duty and penalty are paid.',
        dueDiligenceImpact: 'Verify stamp duty stamps on Agreements of Sale, GPAs, and Memorandums of Understanding.'
      }
    ],
    relevantDocTypes: ['sale_agreement', 'power_of_attorney', 'sale_deed'],
    mandatoryChecks: [
      'Verify stamp duty paid matches Karnataka Guidance Value schedule',
      'Check whether Power of Attorney with development rights paid stamp duty under Article 41',
      'Inspect e-Stamp certificate authenticity on Stock Holding Corporation (SHCIL) portal'
    ]
  }
];

export class LegalResearchEngine {
  private provisions: StatutoryProvision[] = STATUTORY_PROVISIONS;

  /**
   * Search statutory provisions and case laws with relevance scoring
   */
  search(query: string, category?: string): StatutoryProvision[] {
    const q = (query || '').toLowerCase().trim();
    const cat = (category || '').toLowerCase().trim();

    return this.provisions
      .filter(item => {
        if (cat && cat !== 'all' && item.category.toLowerCase() !== cat) {
          return false;
        }
        if (!q) return true;

        const haystack = [
          item.actName,
          item.actShortCode,
          item.section,
          item.title,
          item.summary,
          item.statutoryText,
          item.practitionerNotes,
          ...item.mandatoryChecks,
          ...item.keyPrecedents.map(p => `${p.caseName} ${p.citation} ${p.ratio}`)
        ].join(' ').toLowerCase();

        const terms = q.split(/\s+/).filter(t => t.length > 1);
        return terms.every(t => haystack.includes(t));
      })
      .sort((a, b) => {
        // Prioritize critical severity first
        const severityScore = (s: string) => s === 'critical' ? 3 : s === 'high' ? 2 : 1;
        return severityScore(b.severity) - severityScore(a.severity);
      });
  }

  /**
   * Get specific statutory provision by ID
   */
  getById(id: string): StatutoryProvision | undefined {
    return this.provisions.find(p => p.id === id);
  }

  /**
   * Get all categories with item counts
   */
  getCategories(): { category: string; label: string; count: number }[] {
    const labels: Record<string, string> = {
      all: 'All Legal Domains',
      agricultural_ceiling: 'Agricultural Land & Ceilings (KLRA)',
      sc_st_ptcl: 'SC/ST Granted Lands (PTCL Act)',
      land_conversion: 'Land Conversion (KLR Act Sec 95)',
      registration_stamp: 'Registration & Stamp Duty',
      title_transfer: 'Transfer of Property & Lis Pendens',
      urban_planning: 'Urban Planning & Layout Sanction',
      environmental_buffer: 'Lake & SWD Environmental Buffers',
      inheritance_succession: 'Hindu Succession & Coparcenary'
    };

    const counts: Record<string, number> = { all: this.provisions.length };
    for (const p of this.provisions) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }

    return Object.keys(labels).map(cat => ({
      category: cat,
      label: labels[cat],
      count: counts[cat] || 0
    }));
  }

  /**
   * Return citations relevant to a specific document type
   */
  getByDocType(docType: string): StatutoryProvision[] {
    return this.provisions.filter(p => p.relevantDocTypes.includes(docType));
  }
}

export const legalResearchEngine = new LegalResearchEngine();
