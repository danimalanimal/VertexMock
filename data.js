// Vertex dashboard mock data
// All values illustrative — replace with API calls when wiring to backend.

window.VertexData = (() => {
  const coaches = {
    lin:    { id:'lin',    name:'Coach Lin',    initials:'CL', color:'#59b7ff' },
    rivera: { id:'rivera', name:'Coach Rivera', initials:'CR', color:'#ffbf66' },
    vidal:  { id:'vidal',  name:'Coach Vidal',  initials:'MV', color:'#c89bff' },
  };

  // Radar attributes
  const radarLabels = ['Technical','Tactical','Physical','Mental','Leadership','Consistency'];
  const seasonOne   = [62,58,66,60,49,55];
  const seasonTwo   = [76,79,74,78,63,72];

  // Monthly sample points for attribute sparklines + dev score
  const months = ['Feb 24','Apr','Jun','Aug','Oct','Dec','Feb 25','Apr','Jun','Aug','Sep'];

  const devScoreSeries = [73,74,75,76,76,78,80,81,82,83,84];

  // ---------- Hero athlete (Ava) anthropometric record ----------
  // Single source of truth for age + current measurements; the anthroFor()
  // builder below produces history + projection series from these fields.
  const hero = {
    id:'ava', name:'Ava Thompson', level:'U16 Girls', position:'Combo Guard/Wing',
    age:16, height:175.0, weight:64.5, wingspan:178.6, devScore:84,
  };

  // ---------- Anthropometrics (Age + Weight + Height + Wingspan) ----------
  // Eight history points (Feb 25 \u2192 May 26) + four projected points (Aug 26 \u2192 May 27).
  // Asterisks (*) mark projected labels.
  const anthroLabels = [
    'Feb 25','Apr 25','Jun 25','Aug 25','Oct 25','Dec 25','Feb 26','May 26',
    'Aug 26*','Nov 26*','Feb 27*','May 27*'
  ];

  // Growth rates tuned by age — basketball females decelerate earlier than
  // adolescent males but still gain conditioning weight + wingspan reach.
  const ageGrowth = (a) => {
    if (a.age <= 13) return { heightGain:4.2, weightGain:3.4, wingspanGain:4.6 };
    if (a.age <= 14) return { heightGain:3.8, weightGain:3.6, wingspanGain:4.0 };
    if (a.age <= 15) return { heightGain:2.6, weightGain:3.4, wingspanGain:2.8 };
    if (a.age <= 16) return { heightGain:1.6, weightGain:2.8, wingspanGain:1.8 };
    return            { heightGain:0.8, weightGain:2.2, wingspanGain:1.0 };
  };

  const ramp = (target, gainPerYear) => {
    const monthsHist = [-14,-12,-10,-8,-6,-4,-2,0];
    const monthsProj = [+3,+6,+9,+12];
    const monthly = gainPerYear / 12;
    const hist = monthsHist.map(m => +(target + m * monthly).toFixed(1));
    const proj = monthsProj.map(m => +(target + m * monthly).toFixed(1));
    return { hist, proj };
  };

  const anthroFor = (a) => {
    const g = ageGrowth(a);
    const w = ramp(a.weight,   g.weightGain);
    const h = ramp(a.height,   g.heightGain);
    const s = ramp(a.wingspan, g.wingspanGain);
    const band = (target, projArr, frac) => {
      const hi = [target, ...projArr.map(v => +(target + (v-target) * (1+frac)).toFixed(1))];
      const lo = [target, ...projArr.map(v => +(target + (v-target) * (1-frac)).toFixed(1))];
      const pad = Array(7).fill(null);
      return { hi:[...pad, ...hi], lo:[...pad, ...lo] };
    };
    const padHistOnly = (hist) => [...hist, null, null, null, null];
    const padProjOnly = (curr, proj) => [null,null,null,null,null,null,null, curr, ...proj];
    return {
      labels: anthroLabels,
      weightActual:    padHistOnly(w.hist),
      weightProjected: padProjOnly(a.weight, w.proj),
      weightBandHi:    band(a.weight, w.proj, +0.35).hi,
      weightBandLo:    band(a.weight, w.proj, +0.35).lo,
      heightActual:    padHistOnly(h.hist),
      heightProjected: padProjOnly(a.height, h.proj),
      heightBandHi:    band(a.height, h.proj, +0.30).hi,
      heightBandLo:    band(a.height, h.proj, +0.30).lo,
      wingspanActual:  padHistOnly(s.hist),
      wingspanProjected: padProjOnly(a.wingspan, s.proj),
      wingspanBandHi:  band(a.wingspan, s.proj, +0.30).hi,
      wingspanBandLo:  band(a.wingspan, s.proj, +0.30).lo,
    };
  };

  // ---------- Fitness benchmarks ----------
  // Eight test-date stamps spanning the same 14-month window as anthro history.
  const fitnessLabels = ['Mar 25','May 25','Jul 25','Sep 25','Nov 25','Jan 26','Mar 26','May 26'];

  // Test catalogue (units, direction). Same 8 standardised tests as boxing —
  // industry standard for youth athletic profiling; cross-sport comparable.
  const fitnessCatalogue = [
    { key:'beep',     label:'Beep test (level)',  unit:'level',  lowerBetter:false, baseHero:10.2, spread:2.4 },
    { key:'vertical', label:'Vertical jump',      unit:'cm',     lowerBetter:false, baseHero:52,   spread:12  },
    { key:'broad',    label:'Broad jump',         unit:'cm',     lowerBetter:false, baseHero:208,  spread:30  },
    { key:'sprint20', label:'20m sprint',         unit:'s',      lowerBetter:true,  baseHero:3.18, spread:0.36 },
    { key:'sitReach', label:'Sit-and-reach',      unit:'cm',     lowerBetter:false, baseHero:28,   spread:9   },
    { key:'pushup',   label:'Push-ups (60s)',     unit:'reps',   lowerBetter:false, baseHero:40,   spread:16  },
    { key:'plank',    label:'Plank hold',         unit:'s',      lowerBetter:false, baseHero:150,  spread:50  },
    { key:'rhr',      label:'Resting heart rate', unit:'bpm',    lowerBetter:true,  baseHero:60,   spread:9   },
  ];

  const fitnessFor = (a) => {
    // Basketball roster isn't multi-athlete yet (Ava is hero) — skill factor
    // is 0.5 by default; scaffolded for future expansion when roster lands.
    const sk = 0.6; // Ava sits a touch above mock baseline
    return fitnessCatalogue.map(t => {
      const dir = t.lowerBetter ? -1 : +1;
      const current = +(t.baseHero + dir * (sk - 0.5) * t.spread).toFixed(t.unit === 's' ? 2 : 1);
      const startGap = t.baseHero * 0.12 * dir;
      const histStart = +(current - startGap).toFixed(t.unit === 's' ? 2 : 1);
      const series = Array.from({ length: 8 }, (_, i) =>
        +(histStart + (current - histStart) * (i / 7)).toFixed(t.unit === 's' ? 2 : 1)
      );
      const delta = series[7] - series[0];
      const better = t.lowerBetter ? delta < 0 : delta > 0;
      const magnitude = Math.abs(delta) / Math.max(0.0001, Math.abs(series[0]));
      const trend = magnitude < 0.04 ? 'flat' : (better ? 'up' : 'down');
      return { key:t.key, label:t.label, unit:t.unit, lowerBetter:t.lowerBetter,
               current, first:series[0], series, trend };
    });
  };

  // Per-attribute trends (small multiples). Coach attribution per attribute.
  const attributeTrends = [
    { key:'decision',    label:'Decision-making',    trend:'up',   text:'Processing advantage moments faster and making cleaner second-side reads.',
      series:[55,57,58,62,65,68,70,73,76,78,80], coaches:{lin:0.45, rivera:0.55}, consensus:'aligned' },
    { key:'effort',      label:'Effort',             trend:'up',   text:'Competes through multiple actions more often and recovers better after errors.',
      series:[68,70,71,72,74,75,77,79,80,81,82], coaches:{lin:0.4, rivera:0.35, vidal:0.25}, consensus:'aligned' },
    { key:'defence',     label:'Defensive awareness',trend:'up',   text:'Reads help defence earlier and rotates with better timing from the weak side.',
      series:[52,54,55,58,60,63,66,69,71,73,75], coaches:{lin:0.65, rivera:0.35}, consensus:'aligned' },
    { key:'handle',      label:'Ball handling',      trend:'flat', text:'More composed than Season 1, but still vulnerable when first dribble is rushed.',
      series:[65,66,66,68,67,68,69,69,70,70,71], coaches:{rivera:0.7, lin:0.3}, consensus:'mixed' },
    { key:'shooting',    label:'Shooting confidence',trend:'up',   text:'Improved shot selection under pressure and trust in feet-set catch-and-shoot looks.',
      series:[58,59,60,62,64,66,69,71,73,75,77], coaches:{rivera:0.6, lin:0.4}, consensus:'aligned' },
    { key:'communication',label:'Communication',     trend:'down', text:'Needs to communicate switches earlier, especially in transition and scramble defence.',
      series:[55,54,53,52,52,51,50,50,49,49,48], coaches:{lin:0.55, vidal:0.45}, consensus:'aligned' },
    { key:'coachability',label:'Coachability',       trend:'up',   text:'Responds well to specific cues and generally applies corrections within the same session.',
      series:[70,72,73,75,76,78,79,81,82,83,85], coaches:{lin:0.4, rivera:0.4, vidal:0.2}, consensus:'aligned' },
    { key:'iq',          label:'Game IQ',            trend:'up',   text:'Recognises momentum swings better and increasingly makes possessions easier for teammates.',
      series:[60,61,62,64,66,68,70,72,74,76,78], coaches:{lin:0.5, rivera:0.3, vidal:0.2}, consensus:'mixed' },
  ];

  // Vertex Stat Share — peers for benchmarking.
  // Comparison is only enabled when both players have explicitly consented (mutual friends).
  // 'consent' = mutual share active; 'pending' = request sent or received; 'none' = not connected.
  const statShare = [
    { id:'maya',  name:'Maya Okafor',  pos:'Guard',        team:'Riverside Heat',     devScore:88, delta:+9, consent:'consent', season1:[68,64,72,66,58,64], season2:[82,80,78,80,72,78] },
    { id:'jess',  name:'Jess Tanaka',  pos:'Wing',         team:'North Shore Storm',  devScore:81, delta:+6, consent:'consent', season1:[60,62,68,58,52,58], season2:[74,77,76,72,66,70] },
    { id:'priya', name:'Priya Sharma', pos:'Combo Guard',  team:'South Metro Performance', devScore:79, delta:+4, consent:'pending', season1:[64,60,62,60,55,58], season2:[72,72,70,74,64,68] },
    { id:'kira',  name:'Kira Bell',    pos:'Wing/Forward', team:'East City Elite',    devScore:77, delta:+3, consent:'none',    season1:[58,56,70,62,50,54], season2:[68,70,76,74,60,66] },
  ];

  // Players to watch — NBA pros (past or present) chosen for traits Ava can study
  // to address her growth areas: decision-making, defensive comms, shot selection, leadership.
  const nbaWatch = [
    {
      id:'paul',
      name:'Chris Paul',
      era:'2005 – present',
      pos:'Point Guard',
      teams:'NOH/NOP, LAC, HOU, OKC, PHX, GSW, SAS',
      headline:'Pace control, pick-and-roll reads, on-court voice.',
      studyFocus:['Decision-making','Communication','Leadership'],
      addresses:['decision','communication','iq'],
      reasons:[
        'Manipulates ball-screen defenders with shoulder/hip angles before the read.',
        'Calls coverages and sets teammates before the catch — model for early voice.',
        'Mid-range pull is built on creating space, not raw athleticism.'
      ],
      filmCues:['Late-clock PnR vs drop coverage','Side ball-screen reads vs blitz','Defensive pre-snap pointing'],
      highlight:'https://www.youtube.com/results?search_query=chris+paul+pick+and+roll+breakdown'
    },
    {
      id:'nash',
      name:'Steve Nash',
      era:'1996 – 2014',
      pos:'Point Guard',
      teams:'PHX, DAL, LAL',
      headline:'Spacing IQ, advantage creation, finishing touch.',
      studyFocus:['Decision-making','Shooting','Game IQ'],
      addresses:['decision','shooting','iq'],
      reasons:[
        'Reads tilted closeouts and attacks the trailing foot — direct fit for catch-to-drive growth.',
        'Uses pace change rather than speed to get downhill.',
        'Floater + reverse layup package for contact finishing.'
      ],
      filmCues:['Drag screen reads in early offence','Off-hand finishes vs help','Skip-pass timing windows'],
      highlight:'https://www.youtube.com/results?search_query=steve+nash+pick+and+roll+masterclass'
    },
    {
      id:'payton',
      name:'Gary Payton',
      era:'1990 – 2007',
      pos:'Point Guard',
      teams:'SEA, MIL, LAL, BOS, MIA',
      headline:'Point-of-attack defence and constant communication.',
      studyFocus:['Defensive awareness','Communication','Leadership'],
      addresses:['defence','communication'],
      reasons:[
        'Talks every action — switches, screens, tags — model for the back-line voice gap.',
        'Active hands without reaching; uses chest and angles to deny the strong side.',
        'Anticipatory positioning, not reactive — sets the tone defensively.'
      ],
      filmCues:['On-ball denial vs lead guards','Help-and-recover talk','Pre-rotation pointing'],
      highlight:'https://www.youtube.com/results?search_query=gary+payton+defensive+highlights'
    },
    {
      id:'allen',
      name:'Ray Allen',
      era:'1996 – 2014',
      pos:'Shooting Guard',
      teams:'MIL, SEA, BOS, MIA',
      headline:'Footwork, shot prep, and composure under pressure.',
      studyFocus:['Shooting confidence','Effort','Coachability'],
      addresses:['shooting','effort','coachability'],
      reasons:[
        'Feet-set catch routine is the standard for repeatable shooting confidence.',
        'Off-ball movement creates the advantage before the ball arrives.',
        'Famous pre-game routine — model for habit-led improvement.'
      ],
      filmCues:['Catch-and-shoot footwork','Pin-down to relocation reads','Late-clock confidence shots'],
      highlight:'https://www.youtube.com/results?search_query=ray+allen+shooting+form+breakdown'
    },
  ];

  // Timeline milestones — now with coach attribution
  const timeline = {
    s1: [
      { date:'Feb 2024', text:'Showed strong effort habits in training, but delayed reads on weak-side help limited defensive impact.', coaches:['lin'] },
      { date:'May 2024', text:'Confidence dipped after turnovers against pressure; coaches noted rushed decisions in early offence.', coaches:['rivera','lin'] },
      { date:'Aug 2024', text:'Turning point: started recognising skip-pass windows earlier and made better second-side decisions.', coaches:['lin'] },
    ],
    s2: [
      { date:'Jan 2025', text:'Opened season with improved pace control and more composed handle under full-court pressure.', coaches:['rivera'] },
      { date:'Jun 2025', text:'Major leap in shot selection under pressure; took cleaner paint touches and kick-outs.', coaches:['rivera','vidal'] },
      { date:'Sep 2025', text:'Trusted late in close games after stronger defensive awareness and team-first possessions.', coaches:['lin','vidal'] },
    ],
    turning: [
      { date:'T1', text:'Shifted from reactive help defence to anticipatory positioning.',                  coaches:['lin'] },
      { date:'T2', text:'Started selecting catch-drive-kick options rather than forcing contested pull-ups.',coaches:['rivera'] },
      { date:'T3', text:'Earned more trust from staff through repeated coachable responses after mistakes.', coaches:['lin','rivera','vidal'] },
      { date:'T4', text:'Still needs earlier, more assertive communication to lead the back line consistently.',coaches:['lin'] },
    ],
  };

  // Strengths / growth / focus — with coach attribution
  const lists = {
    strengths: [
      { text:'Reads help defence earlier and rotates with intent.', coaches:['lin'] },
      { text:'Improved shot selection under pressure and late clock possessions.', coaches:['rivera'] },
      { text:'Greater consistency in transition effort and second actions.', coaches:['lin','rivera'] },
    ],
    growth: [
      { text:'Needs to communicate switches earlier and louder.', coaches:['lin','vidal'] },
      { text:'Can still rush first dribble against physical on-ball pressure.', coaches:['rivera'] },
      { text:'Leadership presence drops after mistakes in tight stretches.', coaches:['vidal'] },
    ],
    focus: [
      { text:'Daily decision-making reps from advantage/disadvantage scenarios.', coaches:['rivera'] },
      { text:'Defensive shell communication standards in every team block.', coaches:['lin'] },
      { text:'Finishing balance and pace-change work against contact.', coaches:['rivera','vidal'] },
    ],
  };

  // Observation feed (with explicit coach id for filtering)
  const feed = [
    { date:'12 Feb 2024', coach:'lin',    kind:'Game',     topic:'Help defence',     text:'Reads help defence earlier, but still arrives quiet — needs more early talk behind the line.' },
    { date:'27 Apr 2024', coach:'rivera', kind:'Training', topic:'Decision-making',  text:'Improved shot selection under pressure during constrained advantage drills.' },
    { date:'19 Jun 2024', coach:'lin',    kind:'Review',   topic:'Coachability',     text:'Took feedback well after film session and corrected spacing habits in the next team block.' },
    { date:'14 Sep 2024', coach:'vidal',  kind:'Game',     topic:'Leadership',       text:'Quieter in huddles after early turnovers; staff to reinforce voice cues.' },
    { date:'08 Jan 2025', coach:'rivera', kind:'Game',     topic:'Ball handling',    text:'Handled pressure better with pace change, but first dribble still gets high when sped up.' },
    { date:'22 Mar 2025', coach:'lin',    kind:'Training', topic:'Communication',    text:'Needs to communicate switches earlier in shell and transition coverages.' },
    { date:'14 Jul 2025', coach:'rivera', kind:'Game',     topic:'Shot selection',   text:'Made two strong under-pressure kick-outs rather than forcing contested pull-ups.' },
    { date:'02 Sep 2025', coach:'lin',    kind:'Review',   topic:'Leadership',       text:'More settled after mistakes; beginning to steady teammates with body language, not just effort.' },
    { date:'18 Sep 2025', coach:'vidal',  kind:'Training', topic:'Defence',          text:'Anticipatory positioning evident in shell breakdowns; rotation timing sharper.' },
  ];

  // Observation volume heatmap (categories × months)
  const heatCategories = ['Decision','Defence','Shooting','Handle','Comm.','Leadership'];
  const heatMonths     = ['Feb 24','May 24','Aug 24','Nov 24','Feb 25','May 25','Aug 25','Sep 25'];
  const heatValues = [
    [2,3,2,1,3,4,3,4], // Decision
    [3,2,2,2,3,3,4,4], // Defence
    [1,2,1,2,2,3,3,4], // Shooting
    [2,2,1,1,2,2,2,1], // Handle
    [1,1,2,1,1,2,2,2], // Comm.
    [0,1,1,2,1,1,2,3], // Leadership
  ];

  return {
    coaches, radarLabels, seasonOne, seasonTwo, months, devScoreSeries,
    hero, anthroLabels, anthroFor, fitnessLabels, fitnessCatalogue, fitnessFor,
    attributeTrends, statShare, nbaWatch, timeline, lists, feed,
    heatCategories, heatMonths, heatValues,
  };
})();
