// Vertex — Organisation Dashboard Demo data
// Two sports (basketball, boxing). Market tiers are sourced (see `sources`);
// pricing models are NOTIONAL and clearly labelled as such in the UI; the
// athlete cohort is generated deterministically (seeded) so every demo run
// shows the same people, and the named roster athletes from the existing
// mockups (Ava Thompson, Mateo Reyes, …) are present so drill-downs can link
// back to their full dashboards.
//
// Shape is stable: org-dashboard.js consumes `window.VertexOrgData` only.

window.VertexOrgData = (() => {
  'use strict';

  /* ====================================================================
     1. MARKET — participation pyramids (apex → base), AUD pricing defaults
     ==================================================================== */

  // Each tier stores REACH (cumulative people at-or-above that rung) for a
  // low / mid / high reading. The pyramid wants exclusive tier sizes, which
  // org-dashboard.js derives as reach[i] − reach[i−1].
  const market = {
    boxing: {
      sport: 'boxing',
      label: 'Boxing',
      series: ['MEN', 'WOMEN'],
      title: 'Boxing in Australia — participation, aspiration and active boxers',
      summary: 'About 192,000 Australian adults box in a year (the one verified figure); roughly 20,000 want to compete, ~10,000 register as amateurs, ~5,000 have a bout, and ~600 are active pros. The verified anchor is AusPlay; the rest is triangulated from state combat-sport regulators and club counts.',
      defaultTier: 'club',
      tiers: [
        { key: 'pro',        label: 'Active pros',               short: 'Pros',
          reach: { low: 500,    mid: 600,    high: 700 },    male: 0.85,
          status: 'Medium',  statusTone: 'warn',
          basis: 'Bout in the last 12 months. Victoria supervised 58 pro promotions and 652 match-ups (all disciplines, 2023–24); NSW granted 204 contest permits (2024–25). Unverified against BoxRec.' },
        { key: 'bout',       label: 'Amateur bout this year',    short: 'Bouts',
          reach: { low: 4000,   mid: 5000,   high: 6000 },   male: 0.80,
          status: 'Low–medium', statusTone: 'warn',
          basis: 'Registered boxers who get matched — roughly half of registrations.' },
        { key: 'registered', label: 'Registered amateurs',       short: 'Registered',
          reach: { low: 9000,   mid: 10500,  high: 12000 },  male: 0.80,
          status: 'Medium',  statusTone: 'warn',
          basis: 'NSW Combat Sports Authority: 7,500 registered combatants at 30 June 2025 (+67% in three years); ~45% boxing; NSW ≈ 31% of national population.' },
        { key: 'aspire',     label: 'Aspire to compete',         short: 'Aspirants',
          reach: { low: 15000,  mid: 20000,  high: 30000 },  male: 0.75,
          status: 'Estimate', statusTone: 'warn',
          basis: '8–15% of all boxing participants; 25–35% of club trainees (coach rule of thumb). Heavily aged 16–30, concentrated in Qld, NSW and Vic.' },
        { key: 'club',       label: 'Train at a boxing club',    short: 'Club trainees',
          reach: { low: 60000,  mid: 75000,  high: 90000 },  male: 0.70,
          status: 'Estimate', statusTone: 'warn',
          basis: '600–900 Boxing Australia-affiliated clubs nationally, extrapolated from Boxing Queensland\u2019s 150+. Bags, pads and sparring available — the coached population.' },
        { key: 'ausplay',    label: 'AusPlay boxers (15+)',      short: 'AusPlay',
          reach: { low: 190000, mid: 192000, high: 210000 }, male: 0.565,
          status: 'Verified', statusTone: 'ok',
          basis: 'AusPlay 2025: 192,000 Australians aged 15+ boxed at least once in the year (108,000 men, 83,000 women), plus ~18,000 children aged 0–14.' },
        { key: 'fitness',    label: 'Boxing-fitness, all-in',    short: 'Boxfit',
          reach: { low: 350000, mid: 450000, high: 550000 }, male: 0.40,
          status: 'Estimate', statusTone: 'warn',
          basis: 'AusPlay files most boxing-style gym training (UBX, F45-style boxfit, PT pad work) under Fitness/Gym. UBX alone had 95 Australian clubs at its 2022 rebrand, >65% female.' },
      ],
      facts: [
        { label: 'Verified adult boxers', value: '192,000', hint: 'AusPlay 2025 · aged 15+' },
        { label: 'Children 0–14', value: '~18,000', hint: 'AusPlay 2025' },
        { label: 'Women share', value: '43%', hint: 'of AusPlay boxers · ~65% of boutique members' },
        { label: 'Affiliated clubs', value: '600–900', hint: 'Boxing Australia network · Qld 150+' },
        { label: 'NSW registered combatants', value: '7,500', hint: '+67% in 3 yrs · all disciplines' },
        { label: 'Competitor conversion', value: '<5%', hint: 'at every rung below the AusPlay line' },
      ],
      insight: 'The drop from fitness participant to competitor is more than 95% at every rung below the AusPlay line; the pro tier is a sliver. Fitness boxing is a female-skewed market, competitive boxing is not.',
      strategy: [
        { segment: 'Boxing clubs (600–900)', why: 'The coached population: bags, pads, sparring. Every aspirant passes through here.', channel: 'State associations (Boxing Qld, NSW, Vic), club visits, workshop days', message: 'Verified test data your athletes can see improve — fitness battery to fight-readiness.', priority: 'Beachhead' },
        { segment: 'Aspirants 16–30 (15–30k)', why: 'Highest willingness to pay; want proof they are ready to register and be matched.', channel: 'Through clubs, coaches, PCYC programs', message: 'Know where you stand before your first bout.', priority: 'Pull-through' },
        { segment: 'Boutique boxfit networks (UBX, 9Round)', why: '350–550k people, >65% female, retention-driven franchise economics.', channel: 'Franchisor partnerships, pilot in 3–5 studios', message: 'Member progress as a retention product.', priority: 'Expansion' },
        { segment: 'Registered amateurs & pros (≈11k)', why: 'Small but high-value; regulators already require records.', channel: 'Combat sports authorities, promoters, ANBF', message: 'Performance evidence for matchmaking and medical clearance.', priority: 'Credibility' },
      ],
      pricing: {
        athlete:  { price: 15, adoption: 3,  churn: 25, costPerAthlete: 2.5 },
        club:     { perClub: 80,  licence: 2400, adoption: 6, coachSeats: 4, seatPrice: 240, costPerClub: 600 },
        workshop: { fee: 45, perYear: 2, adoption: 4, deliveryCost: 15 },
      },
      sources: [
        { label: 'ASC Clearinghouse — Boxing (AusPlay 2025; Boxing Australia Annual Report 2024–25)', url: 'https://www.ausport.gov.au/clearinghouse/research/archive/boxing' },
        { label: 'Combat Sports Authority of NSW Annual Report 2024/25', url: 'https://www.sport.nsw.gov.au/sites/default/files/2025-11/CSA-Annual-Report-2024-2025.pdf' },
        { label: 'Combat Sports Authority of NSW Annual Report 2023/24', url: 'https://www.sport.nsw.gov.au/sites/default/files/2024-11/Combat%20Sport%20Annual%20Report%202023-2024_WEB.pdf' },
        { label: 'Combat Sports Authority of NSW Annual Report 2021/22', url: 'https://www.sport.nsw.gov.au/sites/default/files/2022-11/Combat-Sport-Annual-Report-2021-2022.pdf' },
        { label: 'Victorian Professional Boxing and Combat Sports Board Report 2023–24', url: 'https://djsir.vic.gov.au/__data/assets/pdf_file/0011/2334359/Professional-Boxing-and-Combat-Sports-Board-Report-23-24.pdf' },
        { label: 'ANBF Rules and Regulations, April 2025', url: 'https://www.dlgsc.wa.gov.au/docs/default-source/sport-and-recreation/combat-sports-commission/boxing/attachment-2---anbf-rules.pdf?sfvrsn=3d1413c_5' },
        { label: 'Boxing Queensland — Clubs', url: 'https://www.boxingqueenslandinc.org/clubs' },
        { label: 'Sport for All — AusPlay 2024 findings', url: 'https://www.sportforall.com.au/understanding-sports-participation-in-australia-insights-from-the-ausplay-survey/' },
        { label: 'Clearinghouse — Fitness/Gym State of Play', url: 'https://www.clearinghouseforsport.gov.au/__data/assets/pdf_file/0009/762093/State_of_Play_Report_-_Fitness_Gym.pdf' },
        { label: 'Business News Australia — 12RND/UBX growth', url: 'https://www.businessnewsaustralia.com/articles/boxing-franchise-12rnd-enters-uk-ring-through-empowered-brands-deal.html' },
        { label: 'Sunshine Valley Gazette — UBX Nambour rebrand (95 clubs)', url: 'https://www.sunshinevalleygazette.com.au/blog/nambour-ubx-fitness-rebrand' },
      ],
    },

    basketball: {
      sport: 'basketball',
      label: 'Basketball',
      series: ['MALE', 'FEMALE'],
      title: 'Basketball in Australia — participation, organised play and the representative pathway',
      summary: 'AusPlay 2025 counts 1,024,000 adults (15+) and 342,000 children who played basketball in the year — about 1.37 million people and the country\u2019s second-biggest team sport. Roughly 640,000 pay to play organised basketball; the representative pathway (club rep programs, state teams, NBL1) is where coached, assessed athletes concentrate.',
      defaultTier: 'rep',
      tiers: [
        { key: 'pro',       label: 'Professional (NBL / WNBL) & national squads', short: 'Pro',
          reach: { low: 200,     mid: 250,     high: 300 },     male: 0.55,
          status: 'Estimate', statusTone: 'warn',
          basis: '10 NBL and 8 WNBL rosters of ~12 plus national-team programs. Derived from roster sizes, not a published headcount.' },
        { key: 'nbl1',      label: 'NBL1 semi-professional',                     short: 'NBL1',
          reach: { low: 1500,    mid: 1750,    high: 2000 },    male: 0.50,
          status: 'Medium', statusTone: 'warn',
          basis: '72 clubs across five NBL1 conferences, each with a men\u2019s and women\u2019s team of ~12.' },
        { key: 'elite',     label: 'State teams, junior nationals & academies',    short: 'State',
          reach: { low: 5000,    mid: 7000,    high: 9000 },    male: 0.50,
          status: 'Estimate', statusTone: 'warn',
          basis: 'State U16–U20 squads, Australian Junior Championships, Centre of Excellence and association academy programs; championship-grade junior teams.' },
        { key: 'rep',       label: 'Junior & senior representative programs',     short: 'Representative',
          reach: { low: 45000,   mid: 60000,   high: 80000 },   male: 0.55,
          status: 'Estimate', statusTone: 'warn',
          basis: 'Victoria\u2019s VJBL alone fields 1,248–1,700 representative teams from 50+ associations (13,000–17,000 players). Extrapolated nationally with Victoria\u2019s outsized share.' },
        { key: 'organised', label: 'Paying / organised players',                  short: 'Organised',
          reach: { low: 600000,  mid: 641500,  high: 700000 },  male: 0.72,
          status: 'Verified', statusTone: 'ok',
          basis: 'AusPlay 2025: 415,500 adults pay to play organised basketball ($661/yr avg) and 226,000 children ($551/yr) — a $400M participation economy.' },
        { key: 'ausplay',   label: 'All participants (AusPlay 2025)',             short: 'AusPlay',
          reach: { low: 1300000, mid: 1366000, high: 1400000 }, male: 0.72,
          status: 'Verified', statusTone: 'ok',
          basis: 'AusPlay 2025: 1,024,000 adults aged 15+ (758,500 men, 263,500 women) and 342,000 children aged 0–14 played at least once in the year.' },
      ],
      facts: [
        { label: 'Adults who played (15+)', value: '1,024,000', hint: 'AusPlay 2025 · 4.5–4.7% of adults' },
        { label: 'Children 0–14 (organised)', value: '342,000', hint: 'AusPlay 2025' },
        { label: 'Paying participants', value: '641,500', hint: '415.5k adults + 226k children' },
        { label: 'Spend on organised play', value: '$400M', hint: '$275M adults + $125M parents' },
        { label: 'Female share (adults)', value: '26%', hint: '263,500 women vs 758,500 men' },
        { label: 'Aged 15–17', value: '18.3%', hint: 'of all participants (2022–23)' },
      ],
      insight: 'Basketball is a $400M participation economy with a steep representative funnel: fewer than one in ten organised players sit in a coached rep program, and that is where parents already spend most and ask for evidence of development.',
      strategy: [
        { segment: 'Associations & rep programs (≈60k athletes)', why: 'Coached weekly, tryouts every season, parents paying $500–$1,500/yr and asking “is my kid progressing?”.', channel: 'State bodies (Basketball Vic/NSW/Qld), association rep directors, PlayHQ ecosystem', message: 'Selection and development evidence every coach and parent can see.', priority: 'Beachhead' },
        { segment: 'Domestic/organised players (≈640k)', why: 'Largest paying base; season-long engagement; testing days as a club service.', channel: 'Association workshop days, school holiday camps', message: 'A personal scorecard at every holiday camp.', priority: 'Volume' },
        { segment: 'State teams, academies & NBL1 (≈9k)', why: 'Need longitudinal, source-verified metrics for selection and transition to pro/college.', channel: 'High-performance managers, NBL1 club GMs', message: 'Provenance-stamped testing that travels with the athlete.', priority: 'Credibility' },
        { segment: 'Schools & community (1.37M participants)', why: 'Casual and school play is 47% informal — a top-of-funnel discovery layer.', channel: 'School sport associations, PCYC, council stadiums', message: 'Try a Vertex station day.', priority: 'Expansion' },
      ],
      pricing: {
        athlete:  { price: 12, adoption: 2,  churn: 25, costPerAthlete: 2.5 },
        club:     { perClub: 220, licence: 3600, adoption: 4, coachSeats: 8, seatPrice: 240, costPerClub: 900 },
        workshop: { fee: 40, perYear: 2, adoption: 2, deliveryCost: 14 },
      },
      sources: [
        { label: 'ASC Clearinghouse — Basketball (AusPlay 2025 participation)', url: 'https://www.ausport.gov.au/clearinghouse/research/archive/basketball' },
        { label: 'Basketball Australia — AusPlay 2025: Australians spend $400M to play organised basketball', url: 'https://www.basketball.com.au/news/ausplay-2025-data-shows-australians-spend-400m-to-play-organised-basketball-each-year' },
        { label: 'Basketball Australia — 1.3 million Aussies play the game', url: 'https://www.basketball.com.au/news/basketball-participation-in-australia-in-2025-boast-one-million-three-hundred-thousands-players' },
        { label: 'Basketball Australia — participation by age group (2022–23)', url: 'https://www.basketball.com.au/news/basketball-in-australia-has-more-participants-than-afl-and-rugby-league-combined' },
        { label: 'ASC Clearinghouse — Men in Sport (boys 0–14 basketball 230,000)', url: 'https://www.ausport.gov.au/clearinghouse/evidence/men-in-sport' },
        { label: 'ASC Clearinghouse — Children and youth in sport (girls 0–14 basketball 116,000)', url: 'https://www.ausport.gov.au/clearinghouse/evidence/children-and-youth-in-sport' },
        { label: 'Basketball Victoria — VJBL about us (1,700+ teams, 17,000+ participants)', url: 'https://www.basketballvictoria.com.au/vjbl/about-us' },
        { label: 'Broadmeadows Basketball — VJBL 1,248 teams from 54 associations', url: 'https://www.broncosbasketball.com.au/vjbl' },
        { label: 'NBL1 — 72 clubs across five conferences (Wikipedia)', url: 'https://en.wikipedia.org/wiki/NBL1' },
        { label: 'ASC — New Participation Picture 2025 (47% of basketball informal)', url: 'https://www.ausport.gov.au/media-centre/news/australians-are-redefining-the-way-they-play' },
      ],
    },
  };

  // Pricing model definitions shared by both sports (defaults come from
  // market[sport].pricing). All figures NOTIONAL, AUD, ex-GST.
  const pricingModels = [
    { key: 'athlete', name: 'Athlete subscription', tag: 'B2C / parent-pays',
      blurb: 'Each athlete (or parent) pays a monthly subscription for their profile, verified metrics and reports. Clubs and coaches use Vertex free.',
      inputs: [
        { key: 'price',          label: 'Price per athlete / month', unit: '$', min: 4,  max: 40,  step: 1 },
        { key: 'adoption',       label: 'Adoption of target tier by year 3', unit: '%', min: 0.5, max: 25, step: 0.5 },
        { key: 'churn',          label: 'Annual churn', unit: '%', min: 5, max: 60, step: 5 },
        { key: 'costPerAthlete', label: 'Cost to serve / athlete / month', unit: '$', min: 0.5, max: 10, step: 0.5 },
      ] },
    { key: 'club', name: 'Club / organisation licence', tag: 'B2B SaaS',
      blurb: 'The club, association or gym licenses Vertex annually for all its athletes, plus paid coach seats. Athletes and parents get access included.',
      inputs: [
        { key: 'licence',     label: 'Licence per club / year', unit: '$', min: 600, max: 15000, step: 100 },
        { key: 'perClub',     label: 'Athletes per club (average)', unit: '', min: 20, max: 600, step: 10 },
        { key: 'adoption',    label: 'Clubs adopted by year 3', unit: '%', min: 0.5, max: 30, step: 0.5 },
        { key: 'coachSeats',  label: 'Paid coach seats per club', unit: '', min: 0, max: 30, step: 1 },
        { key: 'seatPrice',   label: 'Coach seat / year', unit: '$', min: 0, max: 1200, step: 20 },
        { key: 'costPerClub', label: 'Cost to serve / club / year', unit: '$', min: 100, max: 5000, step: 50 },
      ] },
    { key: 'workshop', name: 'Assessment workshops', tag: 'Service + report',
      blurb: 'Vertex (or a certified partner) runs station-based testing days. Price per athlete per workshop, personal report included; data stays on the platform between events.',
      inputs: [
        { key: 'fee',          label: 'Fee per athlete / workshop', unit: '$', min: 10, max: 150, step: 5 },
        { key: 'perYear',      label: 'Workshops per athlete / year', unit: '', min: 1, max: 6, step: 1 },
        { key: 'adoption',     label: 'Athletes assessed by year 3', unit: '%', min: 0.5, max: 25, step: 0.5 },
        { key: 'deliveryCost', label: 'Delivery cost / athlete / workshop', unit: '$', min: 2, max: 80, step: 1 },
      ] },
  ];

  // Year-by-year ramp towards the year-3 adoption target.
  const ramp = [0.35, 0.70, 1.00];

  /* ====================================================================
     2. COHORT — deterministic synthetic athletes + coaches per sport
     ==================================================================== */

  const months = ['Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26'];

  // mulberry32 — tiny seeded PRNG so the demo is identical every load.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const between = (r, lo, hi) => lo + r() * (hi - lo);
  const gauss = (r) => { // Box–Muller, clamped to ±3
    const u = Math.max(1e-9, r()), v = r();
    return Math.max(-3, Math.min(3, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
  };
  const round = (v, d = 0) => { const m = Math.pow(10, d); return Math.round(v * m) / m; };
  // standard normal CDF (Abramowitz–Stegun) → percentile
  const pct = (z) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) p = 1 - p;
    return Math.round(p * 100);
  };

  const firstF = ['Ava', 'Priya', 'Mira', 'Kira', 'Jess', 'Tess', 'Lana', 'Sam', 'Noor', 'Evie', 'Rose', 'Mae', 'Zara', 'Isla', 'Harper', 'Amara', 'Keira', 'Sienna', 'Ruby', 'Maia', 'Talia', 'Imogen', 'Layla', 'Hana', 'Grace', 'Indi', 'Chloe', 'Aroha', 'Freya', 'Nia', 'Olive', 'Pippa', 'Willow', 'Zoe', 'Elsie', 'Bonnie', 'Leilani', 'Matilda'];
  const firstM = ['Mateo', 'Jaylen', 'Zaid', 'Tariq', 'Leon', 'Kofi', 'Devin', 'Marcus', 'Andre', 'Omar', 'Kai', 'Rico', 'Elijah', 'Noah', 'Hugo', 'Tane', 'Jordan', 'Luca', 'Isaac', 'Rangi', 'Caleb', 'Ethan', 'Finn', 'Levi', 'Malik', 'Nico', 'Oscar', 'Rafael', 'Seb', 'Theo', 'Wiremu', 'Xavier', 'Yusuf', 'Ari', 'Bodhi', 'Cruz', 'Darius', 'Eli'];
  const last = ['Thompson', 'Sharma', 'Velasco', 'Bell', 'Tanaka', 'O\u2019Connor', 'Petrov', 'Whittaker', 'Haddad', 'Park', 'Adeyemi', 'Lindqvist', 'Reyes', 'Brooks', 'Karim', 'Owens', 'Petros', 'Annang', 'Mahoney', 'Cole', 'Volkov', 'Daher', 'Nakamura', 'Bautista', 'Ngata', 'Singh', 'Walker', 'Nguyen', 'Costa', 'Ibrahim', 'Fitzgerald', 'Mason', 'Kaur', 'Hughes', 'Tuilagi', 'Dawson', 'Okoro', 'Lee', 'Marsh', 'Ferreira', 'Abbas', 'Byrne', 'Kealoha', 'Moreau', 'Stewart', 'Tran', 'Wallace', 'Yilmaz', 'Zhang', 'Hale'];

  const sports = {
    basketball: {
      label: 'Basketball',
      attributes: ['Technical', 'Tactical', 'Physical', 'Mental', 'Leadership', 'Consistency'],
      roles: ['G', 'G/W', 'W', 'W/F', 'F', 'F/C', 'C'],
      roleLabel: 'Position',
      clubs: [
        { id: 'south-metro', name: 'South Metro Performance', coaches: ['lin', 'rivera', 'vidal'], size: 34 },
        { id: 'northside',   name: 'Northside Academy',       coaches: ['adebayo', 'marsh'],       size: 26 },
        { id: 'bayside',     name: 'Bayside Breakers',        coaches: ['nguyen'],                 size: 20 },
        { id: 'westgate',    name: 'Westgate Wolves',         coaches: ['marsh', 'nguyen'],        size: 16 },
      ],
      coaches: [
        { id: 'lin',     name: 'Coach Lin',     initials: 'CL', focusAttr: 0, focus: 'Skill & shooting',      since: 'Feb 2024', accreditation: 'BA Club Coach · L2' },
        { id: 'rivera',  name: 'Coach Rivera',  initials: 'CR', focusAttr: 1, focus: 'Tactical & game review', since: 'Feb 2024', accreditation: 'BA Association Coach' },
        { id: 'vidal',   name: 'Coach Vidal',   initials: 'MV', focusAttr: 2, focus: 'Physical & S&C',         since: 'Aug 2024', accreditation: 'ASCA L1 · BA Club Coach' },
        { id: 'adebayo', name: 'Coach Adebayo', initials: 'TA', focusAttr: 0, focus: 'Guard development',      since: 'Jan 2026', accreditation: 'BA Club Coach' },
        { id: 'marsh',   name: 'Coach Marsh',   initials: 'EM', focusAttr: 4, focus: 'Rep program director',   since: 'Nov 2025', accreditation: 'BA Association Coach' },
        { id: 'nguyen',  name: 'Coach Nguyen',  initials: 'HN', focusAttr: 5, focus: 'Junior fundamentals',    since: 'Mar 2026', accreditation: 'BA Community Coach' },
      ],
      // Named roster from coach-data.js / data.js — kept so the demo links back.
      named: [
        { id: 'ava',   name: 'Ava Thompson',   sex: 'F', age: 16, role: 'G/W', club: 'south-metro', devScore: 84, delta: 11, hero: true, link: 'dashboard.html', linkLabel: 'Open full player dashboard',
          coaches: ['lin', 'rivera', 'vidal'], height: 175.0, weight: 64.5, wingspan: 178.6, s1: [62, 58, 66, 60, 49, 55], s2: [76, 79, 74, 78, 63, 72], values: { cmj: 52, broad: 208, beep: 10.2 } },
        { id: 'priya', name: 'Priya Sharma',   sex: 'F', age: 15, role: 'G',   club: 'south-metro' },
        { id: 'mira',  name: 'Mira Velasco',   sex: 'F', age: 16, role: 'G',   club: 'south-metro' },
        { id: 'kira',  name: 'Kira Bell',      sex: 'F', age: 15, role: 'W/F', club: 'south-metro' },
        { id: 'jess',  name: 'Jess Tanaka',    sex: 'F', age: 16, role: 'W',   club: 'south-metro' },
        { id: 'tess',  name: 'Tess O\u2019Connor', sex: 'F', age: 15, role: 'F', club: 'south-metro' },
        { id: 'lana',  name: 'Lana Petrov',    sex: 'F', age: 16, role: 'F',   club: 'south-metro' },
        { id: 'sam',   name: 'Sam Whittaker',  sex: 'F', age: 15, role: 'F/C', club: 'south-metro' },
        { id: 'noor',  name: 'Noor Haddad',    sex: 'F', age: 16, role: 'C',   club: 'south-metro' },
        { id: 'evie',  name: 'Evie Park',      sex: 'F', age: 14, role: 'G',   club: 'south-metro' },
        { id: 'rose',  name: 'Rose Adeyemi',   sex: 'F', age: 15, role: 'W',   club: 'south-metro' },
        { id: 'mae',   name: 'Mae Lindqvist',  sex: 'F', age: 16, role: 'G/W', club: 'south-metro' },
      ],
      metrics: [
        { key: 'cmj',    label: 'CMJ height',        unit: 'cm',    higherBetter: true,  base: (a, m) => 22 + (a - 10) * 2.4 + (m ? 4 : 0), sd: 5,   d: 1, sources: ['video_240fps', 'video_240fps', 'video_240fps', 'lidar_arkit', 'manual', 'audio_impact'] },
        { key: 'broad',  label: 'Broad jump',        unit: 'cm',    higherBetter: true,  base: (a, m) => 140 + (a - 10) * 9 + (m ? 12 : 0),  sd: 16,  d: 0, sources: ['manual', 'manual', 'video_240fps'] },
        { key: 'lane',   label: 'Lane agility',      unit: 's',     higherBetter: false, base: (a, m) => 14.8 - (a - 10) * 0.35 - (m ? 0.3 : 0), sd: 0.6, d: 2, sources: ['manual', 'manual', 'video_240fps'] },
        { key: 'beep',   label: 'Beep test',         unit: 'level', higherBetter: true,  base: (a, m) => 5.5 + (a - 10) * 0.55 + (m ? 0.8 : 0), sd: 1.3, d: 1, sources: ['manual', 'audio_impact', 'manual'] },
        { key: 'ft',     label: 'Free throw %',      unit: '%',     higherBetter: true,  base: (a) => 48 + (a - 10) * 3.2, sd: 10, d: 0, sources: ['manual'] },
      ],
      keyMetric: 'cmj',
      feedbackLabel: 'coach observations',
      seed: 20261015,
      total: 96,
      ages: [11, 17],
      femaleShare: 0.5,
    },
    boxing: {
      label: 'Boxing',
      attributes: ['Fundamentals', 'Focus Mitts', 'Noodle', 'Shields', 'Partner Work'],
      roles: ['Orthodox', 'Orthodox', 'Orthodox', 'Southpaw'],
      roleLabel: 'Stance',
      clubs: [
        { id: 'rage',      name: 'Rage Boxing Workshop',   coaches: ['kade', 'reyes', 'okafor'], size: 24 },
        { id: 'pcyc',      name: 'Southside PCYC Boxing',  coaches: ['hale'],                   size: 18 },
        { id: 'ironworks', name: 'Ironworks Gym',          coaches: ['tuilagi'],                size: 14 },
        { id: 'northshore',name: 'Northshore Boxing Club', coaches: ['hale', 'tuilagi'],        size: 12 },
      ],
      coaches: [
        { id: 'kade',    name: 'Coach Kade',    initials: 'CK', focusAttr: 0, focus: 'Fundamentals & footwork', since: 'Mar 2025', accreditation: 'Boxing Australia Bronze' },
        { id: 'reyes',   name: 'Coach Reyes',   initials: 'CR', focusAttr: 1, focus: 'Mitts & combinations',    since: 'Mar 2025', accreditation: 'Boxing Australia Silver' },
        { id: 'okafor',  name: 'Coach Okafor',  initials: 'CO', focusAttr: 4, focus: 'Conditioning & partner work', since: 'Jun 2025', accreditation: 'Boxing Australia Bronze · S&C' },
        { id: 'hale',    name: 'Coach Hale',    initials: 'JH', focusAttr: 2, focus: 'Youth program lead',      since: 'Dec 2025', accreditation: 'PCYC Boxing Coach' },
        { id: 'tuilagi', name: 'Coach Tuilagi', initials: 'ST', focusAttr: 3, focus: 'Amateur bout preparation', since: 'Feb 2026', accreditation: 'Boxing Australia Silver' },
      ],
      named: [
        { id: 'mateo',  name: 'Mateo Reyes',    sex: 'M', age: 13, role: 'Orthodox', club: 'rage', devScore: 84, delta: 12, hero: true, link: 'boxer-dashboard.html', linkLabel: 'Open full boxer dashboard', height: 158, weight: 48, wingspan: 160, s1: [64, 58, 55, 60, 62], s2: [80, 78, 76, 78, 82], coaches: ['kade', 'reyes', 'okafor'] },
        { id: 'jaylen', name: 'Jaylen Brooks',  sex: 'M', age: 14, role: 'Orthodox', club: 'rage', devScore: 74, delta: 8, height: 163, weight: 52, wingspan: 166, s1: [58, 55, 52, 54, 60], s2: [72, 70, 66, 68, 78] },
        { id: 'zaid',   name: 'Zaid Karim',     sex: 'M', age: 12, role: 'Orthodox', club: 'rage', devScore: 62, delta: 10, height: 152, weight: 44, wingspan: 153, s1: [44, 40, 42, 46, 52], s2: [60, 58, 60, 62, 72] },
        { id: 'tariq',  name: 'Tariq Owens',    sex: 'M', age: 15, role: 'Southpaw', club: 'rage', devScore: 71, delta: 5, height: 170, weight: 60, wingspan: 173, s1: [60, 58, 54, 56, 58], s2: [70, 72, 66, 66, 74] },
        { id: 'leon',   name: 'Leon Petros',    sex: 'M', age: 16, role: 'Orthodox', club: 'rage', devScore: 81, delta: 6, height: 174, weight: 64, wingspan: 177, s1: [68, 64, 64, 70, 68], s2: [80, 78, 76, 82, 82] },
        { id: 'kofi',   name: 'Kofi Annang',    sex: 'M', age: 11, role: 'Orthodox', club: 'rage', devScore: 60, delta: 9, height: 147, weight: 39, wingspan: 148, s1: [48, 44, 42, 40, 52], s2: [60, 58, 56, 54, 72] },
        { id: 'devin',  name: 'Devin Mahoney',  sex: 'M', age: 14, role: 'Orthodox', club: 'rage', devScore: 73, delta: 7, height: 165, weight: 54, wingspan: 167, s1: [58, 60, 52, 56, 60], s2: [72, 74, 66, 68, 76] },
        { id: 'marcus', name: 'Marcus Cole',    sex: 'M', age: 15, role: 'Southpaw', club: 'rage', devScore: 79, delta: 4, height: 172, weight: 61, wingspan: 175, s1: [68, 66, 62, 66, 66], s2: [78, 76, 72, 80, 78] },
        { id: 'andre',  name: 'Andre Volkov',   sex: 'M', age: 13, role: 'Orthodox', club: 'rage', devScore: 72, delta: 6, height: 160, weight: 50, wingspan: 161, s1: [58, 56, 56, 54, 60], s2: [70, 72, 66, 64, 76] },
        { id: 'omar',   name: 'Omar Daher',     sex: 'M', age: 11, role: 'Orthodox', club: 'rage', devScore: 58, delta: 8, height: 144, weight: 37, wingspan: 144, s1: [42, 40, 40, 42, 48], s2: [58, 56, 54, 56, 68] },
        { id: 'kai',    name: 'Kai Nakamura',   sex: 'M', age: 14, role: 'Southpaw', club: 'rage', devScore: 75, delta: 9, height: 166, weight: 55, wingspan: 168, s1: [60, 58, 58, 56, 60], s2: [74, 74, 70, 68, 78] },
        { id: 'rico',   name: 'Rico Bautista',  sex: 'M', age: 16, role: 'Orthodox', club: 'rage', devScore: 82, delta: 7, height: 175, weight: 66, wingspan: 179, s1: [70, 66, 66, 68, 70], s2: [82, 78, 76, 82, 80] },
      ],
      metrics: [
        { key: 'ppm',    label: 'Punches per minute', unit: 'ppm', higherBetter: true,  base: (a, m) => 120 + (a - 10) * 9 + (m ? 6 : 0),  sd: 18,  d: 0, sources: ['audio_impact', 'audio_impact', 'manual', 'video_240fps'] },
        { key: 'cmj',    label: 'CMJ height',         unit: 'cm',  higherBetter: true,  base: (a, m) => 20 + (a - 10) * 2.2 + (m ? 4 : 0),  sd: 5,   d: 1, sources: ['video_240fps', 'video_240fps', 'lidar_arkit', 'manual'] },
        { key: 'react',  label: 'Hand reaction time', unit: 'ms',  higherBetter: false, base: (a) => 320 - (a - 10) * 9,                     sd: 28,  d: 0, sources: ['video_240fps', 'manual'] },
        { key: 'plank',  label: 'Plank hold',         unit: 's',   higherBetter: true,  base: (a, m) => 60 + (a - 10) * 11 + (m ? 8 : 0),   sd: 25,  d: 0, sources: ['manual', 'manual'] },
        { key: 'beep',   label: 'Beep test',          unit: 'level', higherBetter: true, base: (a, m) => 5 + (a - 10) * 0.5 + (m ? 0.9 : 0), sd: 1.2, d: 1, sources: ['manual', 'audio_impact'] },
      ],
      keyMetric: 'ppm',
      feedbackLabel: 'coach observations',
      seed: 19741202,
      total: 68,
      ages: [11, 19],
      femaleShare: 0.3,
    },
  };

  const VERIFIED = new Set(['video_240fps', 'lidar_arkit', 'force_plate']);
  const sourceLabel = {
    video_240fps: 'Video 240fps', lidar_arkit: 'LiDAR / ARKit', force_plate: 'Force plate',
    audio_impact: 'Audio impact', imu_pocket: 'Pocket IMU', manual: 'Manual', computed: 'Computed', self: 'Self-report',
  };

  function ageBand(age) {
    if (age <= 12) return 'U12';
    if (age <= 14) return 'U14';
    if (age <= 16) return 'U16';
    if (age <= 18) return 'U18';
    return 'Open';
  }

  function buildCohort(sportKey) {
    const S = sports[sportKey];
    const r = rng(S.seed);
    const clubs = S.clubs.map((c) => ({ ...c }));
    const coachById = Object.fromEntries(S.coaches.map((c) => [c.id, { ...c }]));
    const athletes = [];
    const used = new Set();

    const makeOne = (seedPerson) => {
      const sex = seedPerson.sex || (r() < S.femaleShare ? 'F' : 'M');
      const age = seedPerson.age || Math.round(between(r, S.ages[0], S.ages[1]));
      let name = seedPerson.name;
      if (!name) {
        let tries = 0;
        do { name = pick(r, sex === 'F' ? firstF : firstM) + ' ' + pick(r, last); tries++; } while (used.has(name) && tries < 40);
      }
      used.add(name);
      const id = seedPerson.id || name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '');
      const club = clubs.find((c) => c.id === seedPerson.club) || pick(r, clubs);
      const clubCoaches = club.coaches.slice();
      const nCoach = Math.min(clubCoaches.length, 1 + (r() < 0.6 ? 1 : 0) + (r() < 0.25 ? 1 : 0));
      const coaches = seedPerson.coaches ? seedPerson.coaches.slice() : [];
      while (coaches.length < nCoach) { const c = pick(r, clubCoaches); if (!coaches.includes(c)) coaches.push(c); }
      const m = sex === 'M';

      // --- development trajectory (12 months) ---
      const talent = gauss(r);                             // where they sit
      const growth = Math.max(0.2, 1 + gauss(r) * 0.55);  // how fast they move
      const joinedMonthsAgo = seedPerson.hero ? 12 : Math.min(12, Math.max(2, Math.round(between(r, 2, 14))));
      const endScore = seedPerson.devScore != null ? seedPerson.devScore : Math.round(Math.max(38, Math.min(94, 66 + talent * 10 + (age - 13) * 1.2)));
      const delta = seedPerson.delta != null ? seedPerson.delta : Math.round(Math.max(-3, Math.min(18, 5 * growth + gauss(r) * 1.5)));
      const dev = months.map((_, i) => {
        const since = i - (12 - joinedMonthsAgo);
        if (since < 0) return null;
        const f = joinedMonthsAgo <= 1 ? 1 : since / (joinedMonthsAgo - 1);
        const eased = 1 - Math.pow(1 - f, 1.6);
        return Math.round(endScore - delta + delta * eased + gauss(r) * 0.6);
      });
      dev[11] = endScore;

      // --- radar attributes season 1 → season 2 ---
      const s2 = seedPerson.s2 || S.attributes.map(() => Math.round(Math.max(30, Math.min(96, endScore + gauss(r) * 7))));
      const s1 = seedPerson.s1 || s2.map((v) => Math.round(Math.max(25, Math.min(95, v - delta - between(r, -3, 5)))));

      // --- metrics with provenance ---
      const metrics = {};
      S.metrics.forEach((def) => {
        const dir = def.higherBetter ? 1 : -1;
        const z = talent * 0.6 + gauss(r) * 0.8;
        const override = seedPerson.values && seedPerson.values[def.key];
        const value = override != null ? override : round(def.base(age, m) + dir * z * def.sd, def.d);
        if (override != null) { /* keep z consistent with the overridden value */ }
        const zz = override != null ? round(dir * (value - def.base(age, m)) / def.sd, 2) : z;
        const first = round(value - dir * (delta / 12) * def.sd * 0.9 + gauss(r) * def.sd * 0.15, def.d);
        const source = pick(r, def.sources);
        metrics[def.key] = { value, first, source, verified: VERIFIED.has(source), z: round(zz, 2) };
      });

      // --- anthropometrics vs age/sex ---
      const a = Math.min(age, 18);
      const hMean = sex === 'M' ? 141 + (a - 11) * 7.2 : 144 + (a - 11) * 4.6;
      const hz = talent * 0.3 + gauss(r) * 0.95;
      const height = seedPerson.height != null ? seedPerson.height : round(hMean + hz * 7, 1);
      const hz2 = (height - hMean) / 7;
      const wz0 = hz2 * 0.7 + gauss(r) * 0.7;
      const wingspan = seedPerson.wingspan != null ? seedPerson.wingspan : round(height * 1.02 + wz0 * 3.2, 1);
      const wz = (wingspan - height * 1.02) / 3.2;
      const wMean = sex === 'M' ? 35 + (a - 11) * 6 : 36 + (a - 11) * 4.6;
      const bz0 = hz2 * 0.5 + gauss(r) * 0.85;
      const weight = seedPerson.weight != null ? seedPerson.weight : round(wMean + bz0 * 6, 1);
      const bz = (weight - wMean) / 6;

      // --- coach feedback (retention & dedication) ---
      const cadence = Math.max(0.3, 2.2 + talent * 0.4 + gauss(r) * 1.3); // entries / month baseline
      const byMonth = months.map((_, i) => {
        if (dev[i] == null) return 0;
        const seasonal = (i === 1 || i === 2) ? 0.55 : 1;     // Dec–Jan dip
        return Math.max(0, Math.round(cadence * seasonal * between(r, 0.5, 1.6)));
      });
      const total = byMonth.reduce((s, v) => s + v, 0);
      const byCoach = {};
      coaches.forEach((c, i) => { byCoach[c] = 0; });
      for (let k = 0; k < total; k++) { const c = coaches[Math.min(coaches.length - 1, Math.floor(Math.pow(r(), 1.4) * coaches.length))]; byCoach[c]++; }
      const pos = Math.round(total * between(r, 0.38, 0.62));
      const neg = Math.round((total - pos) * between(r, 0.2, 0.45));
      const sentiment = { pos, neu: total - pos - neg, neg };
      const sessions = Math.round(joinedMonthsAgo * between(r, 3, 8));
      const lastActive = seedPerson.hero ? 2 : r() < 0.82 ? Math.round(between(r, 0, 13)) : Math.round(between(r, 14, 75));
      const streak = lastActive > 14 ? 0 : Math.round(between(r, 1, Math.max(1, joinedMonthsAgo * 3.5)));

      // --- attribute mix of coach entries ---
      const attrMix = S.attributes.map(() => between(r, 0.5, 1.5));
      const attrSum = attrMix.reduce((s2_, v) => s2_ + v, 0);

      return {
        id, name, sex, age, band: ageBand(age), role: seedPerson.role || pick(r, S.roles),
        club: club.id, clubName: club.name, coaches,
        joinedMonthsAgo, dev, devScore: endScore, devDelta: delta,
        s1, s2, metrics,
        anthro: { height, weight, wingspan, heightPct: pct(hz2), wingspanPct: pct(wz), weightPct: pct(bz) },
        feedback: { byMonth, byCoach, total, sentiment, sessions, lastActive, streak, cadence: round(total / Math.max(1, joinedMonthsAgo), 1) },
        attrMix: attrMix.map((v) => round(v / attrSum, 3)),
        hero: !!seedPerson.hero, link: seedPerson.link || null, linkLabel: seedPerson.linkLabel || null,
      };
    };

    S.named.forEach((n) => athletes.push(makeOne(n)));
    // fill each club to size
    clubs.forEach((c) => {
      let have = athletes.filter((a) => a.club === c.id).length;
      while (have < c.size) { athletes.push(makeOne({ club: c.id })); have++; }
    });
    while (athletes.length < S.total) athletes.push(makeOne({}));

    // --- coach aggregates ---
    const coaches = S.coaches.map((c) => {
      const mine = athletes.filter((a) => a.coaches.includes(c.id));
      const entries = mine.reduce((s, a) => s + (a.feedback.byCoach[c.id] || 0), 0);
      const byMonth = months.map((_, i) => mine.reduce((s, a) => {
        const share = a.feedback.total ? (a.feedback.byCoach[c.id] || 0) / a.feedback.total : 0;
        return s + a.feedback.byMonth[i] * share;
      }, 0)).map((v) => Math.round(v));
      const attr = S.attributes.map((_, i) => mine.reduce((s, a) => s + a.attrMix[i] * (a.feedback.byCoach[c.id] || 0), 0) * (i === c.focusAttr ? 2.1 : 1));
      const attrSum = attr.reduce((s, v) => s + v, 0) || 1;
      const sentiment = mine.reduce((acc, a) => {
        const share = a.feedback.total ? (a.feedback.byCoach[c.id] || 0) / a.feedback.total : 0;
        acc.pos += a.feedback.sentiment.pos * share; acc.neu += a.feedback.sentiment.neu * share; acc.neg += a.feedback.sentiment.neg * share; return acc;
      }, { pos: 0, neu: 0, neg: 0 });
      const avgDelta = mine.length ? mine.reduce((s, a) => s + a.devDelta, 0) / mine.length : 0;
      const avgScore = mine.length ? mine.reduce((s, a) => s + a.devScore, 0) / mine.length : 0;
      const clubsOf = [...new Set(mine.map((a) => a.clubName))];
      const verifiedShare = (() => {
        let v = 0, n = 0; mine.forEach((a) => Object.values(a.metrics).forEach((mm) => { n++; if (mm.verified) v++; })); return n ? v / n : 0;
      })();
      return {
        ...c, athletes: mine.map((a) => a.id), athleteCount: mine.length, entries, byMonth,
        attrMix: attr.map((v) => round(v / attrSum, 3)),
        sentiment: { pos: Math.round(sentiment.pos), neu: Math.round(sentiment.neu), neg: Math.round(sentiment.neg) },
        cadence: mine.length ? round(entries / mine.length / 12 * (12 / Math.max(1, Math.min(12, mine.reduce((s, a) => s + a.joinedMonthsAgo, 0) / mine.length))), 1) : 0,
        avgDelta: round(avgDelta, 1), avgScore: Math.round(avgScore), clubs: clubsOf, verifiedShare: round(verifiedShare, 2),
        activeShare: mine.length ? round(mine.filter((a) => a.feedback.lastActive <= 14).length / mine.length, 2) : 0,
      };
    });

    return { sport: sportKey, label: S.label, attributes: S.attributes, roleLabel: S.roleLabel, metrics: S.metrics, keyMetric: S.keyMetric, clubs, coaches, athletes, months };
  }

  const cohorts = {};
  const cohort = (sportKey) => cohorts[sportKey] || (cohorts[sportKey] = buildCohort(sportKey));

  /* ====================================================================
     3. EXAMPLES — links into the existing Vertex surfaces
     ==================================================================== */
  const examples = {
    shared: {
      workshopReports: [
        { title: 'Workshop progress report — Mateo Reyes (9-page printable)', href: 'boxer-progress-report.html', desc: 'The individual report each athlete takes home after a workshop block: coach note, where they are now, how they are growing, the eight re-tested measures, attribute movement and the next twelve weeks.' },
      ],
      coachProfiles: [], // filled per sport from the cohort (org dashboard coach drill-downs)
    },
    basketball: {
      coachInterfaces: [
        { title: 'Coach Input — courtside observation logger', href: 'coach.html', desc: 'Tap player → attribute → sentiment → phrase. Bulk mode for multiple players.' },
        { title: 'Form Designer', href: 'form-designer.html', desc: 'Build the observation forms coaches run (draft → live → archived).' },
        { title: 'Phrase Library', href: 'phrase-library.html', desc: 'The 540-phrase coaching vocabulary behind fast capture.' },
        { title: 'Standing Broad Jump', href: 'broad-jump.html', desc: 'Best of 3, roster grid, age-band scoring.' },
        { title: 'CMJ (Tape)', href: 'cmj.html', desc: 'Counter-movement jump — flight time from the tape rip.' },
        { title: 'Drop Jump (mic)', href: 'vertical-jump.html', desc: 'Impact-detected height + RSI, manual fallback.' },
        { title: 'NBA Lane Agility / T-Test', href: 'agility-tests.html?proto=lane', desc: 'Change-of-direction protocols, best of 2.' },
        { title: 'Shuttle tests (Beep · Yo-Yo · 30-15)', href: 'shuttle-tests.html', desc: 'Group cadence test with one-tap eliminations.' },
        { title: 'Free Throw %', href: 'free-throw.html', desc: 'Make / miss per attempt, set sizes 10–100.' },
        { title: 'Plank Timer', href: 'plank-test.html', desc: 'Group plank with milestone beeps.' },
        { title: 'Hand Reaction Time', href: 'reaction-time.html', desc: '5 trials, trimmed mean.' },
        { title: 'Time Trial', href: 'time-trial.html', desc: '400m to 5km, tap each athlete at the line.' },
      ],
      playerProfiles: [
        { title: 'Ava Thompson — Player Dashboard', href: 'dashboard.html', desc: 'U16 Girls · two-season radar, height projection, Stat Share, coach observations, insights.' },
      ],
    },
    boxing: {
      coachInterfaces: [
        { title: 'Boxing Workshop Coach Input', href: 'boxing.html', desc: 'Five attribute blocks with satisfaction sliders, tagged into the unified feed.' },
        { title: 'Form Designer', href: 'form-designer.html', desc: 'Build the observation forms coaches run (draft → live → archived).' },
        { title: 'Phrase Library', href: 'phrase-library.html', desc: 'Reusable coaching phrases keyed by attribute and sentiment.' },
        { title: 'Punches Per Minute', href: 'punches-per-min.html', desc: 'Centre-screen tap pad; 30s, 60s and 3-min rounds.' },
        { title: 'Sparring Round Counter', href: 'sparring-rounds.html', desc: 'Work/rest cycles, auto-bell, knockdown and standing-8 log.' },
        { title: 'CMJ (Tape)', href: 'cmj.html', desc: 'Counter-movement jump — flight time from the tape rip.' },
        { title: 'Hand Reaction Time', href: 'reaction-time.html', desc: '5 trials, trimmed mean.' },
        { title: 'Plank Timer', href: 'plank-test.html', desc: 'Group plank with milestone beeps.' },
        { title: 'Shuttle tests (Beep · Yo-Yo · 30-15)', href: 'shuttle-tests.html', desc: 'Group cadence test with one-tap eliminations.' },
        { title: 'Time Trial', href: 'time-trial.html', desc: '400m to 5km, tap each athlete at the line.' },
      ],
      playerProfiles: [
        { title: 'Mateo Reyes — Boxer Dashboard', href: 'boxer-dashboard.html', desc: 'Youth · 13 yrs · skill radar with coach-satisfaction overlay, weight & conditioning projection, 12-athlete roster picker.' },
      ],
    },
  };

  return { market, pricingModels, ramp, months, sports, cohort, examples, sourceLabel, VERIFIED, ageBand };
})();
