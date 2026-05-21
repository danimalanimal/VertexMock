// Vertex boxer dashboard mock data.
// Mirrors data.js shape so the dashboard render code can stay nearly identical.
// Hero athlete (Mateo Reyes) gets full per-attribute trends + timeline + lists.
// The other 11 workshop athletes get summary cards for the roster switcher.

window.BoxerData = (() => {
  const coaches = {
    kade:   { id:'kade',   name:'Coach Kade',   initials:'CK', color:'#59b7ff' },
    reyes:  { id:'reyes',  name:'Coach Reyes',  initials:'CR', color:'#ffbf66' },
    okafor: { id:'okafor', name:'Coach Okafor', initials:'CO', color:'#c89bff' },
  };

  // ---------- 12-athlete workshop roster ----------
  // Same identities as boxing-data.js (the input page). Each has its own radar,
  // dev score, and current satisfaction overlay.
  const athletes = [
    {
      id:'mateo',  name:'Mateo Reyes',   level:'Advanced',     stance:'Orthodox',
      ageGroup:'Youth \u00b7 13 yrs', team:'Rage Boxing Workshop', portrait:'assets/boxer-photo.jpeg',
      initials:'MR', accent:'#9bd2ff',
      age:13, height:158, weight:48, wingspan:160,
      devScore:84, delta:+12, confidence:'8.9/10', stage:'Build \u2192 Perform', readiness:'Workshop lead+',
      season1:[64,58,55,60,62], season2:[80,78,76,78,82],
      satisfaction:[82,78,72,80,84],   // current coach slider snapshot per attribute
      hero:true,
    },
    { id:'jaylen', name:'Jaylen Brooks',  level:'Intermediate', stance:'Orthodox', initials:'JB', accent:'#7ed7c5',
      age:14, height:163, weight:52, wingspan:166,
      devScore:74, delta:+8,  season1:[58,55,52,54,60], season2:[72,70,66,68,78], satisfaction:[72,70,62,68,80] },
    { id:'zaid',   name:'Zaid Karim',     level:'Beginner',     stance:'Orthodox', initials:'ZK', accent:'#ffbf66',
      age:12, height:152, weight:44, wingspan:153,
      devScore:62, delta:+10, season1:[44,40,42,46,52], season2:[60,58,60,62,72], satisfaction:[58,52,55,60,72] },
    { id:'tariq',  name:'Tariq Owens',    level:'Intermediate', stance:'Southpaw', initials:'TO', accent:'#c89bff',
      age:15, height:170, weight:60, wingspan:173,
      devScore:71, delta:+5,  season1:[60,58,54,56,58], season2:[70,72,66,66,74], satisfaction:[70,72,62,62,76] },
    { id:'leon',   name:'Leon Petros',    level:'Advanced',     stance:'Orthodox', initials:'LP', accent:'#ff9bb6',
      age:16, height:174, weight:64, wingspan:177,
      devScore:81, delta:+6,  season1:[68,64,64,70,68], season2:[80,78,76,82,82], satisfaction:[78,76,72,82,84] },
    { id:'kofi',   name:'Kofi Annang',    level:'Beginner',     stance:'Orthodox', initials:'KA', accent:'#8de08a',
      age:11, height:147, weight:39, wingspan:148,
      devScore:60, delta:+9,  season1:[48,44,42,40,52], season2:[60,58,56,54,72], satisfaction:[58,52,50,48,70] },
    { id:'devin',  name:'Devin Mahoney',  level:'Intermediate', stance:'Orthodox', initials:'DM', accent:'#ffd56b',
      age:14, height:165, weight:54, wingspan:167,
      devScore:73, delta:+7,  season1:[58,60,52,56,60], season2:[72,74,66,68,76], satisfaction:[72,72,60,66,76] },
    { id:'marcus', name:'Marcus Cole',    level:'Advanced',     stance:'Southpaw', initials:'MC', accent:'#ff8a8a',
      age:15, height:172, weight:61, wingspan:175,
      devScore:79, delta:+4,  season1:[68,66,62,66,66], season2:[78,76,72,80,78], satisfaction:[78,76,68,82,80] },
    { id:'andre',  name:'Andre Volkov',   level:'Intermediate', stance:'Orthodox', initials:'AV', accent:'#6bd5ff',
      age:13, height:160, weight:50, wingspan:161,
      devScore:72, delta:+6,  season1:[58,56,56,54,60], season2:[70,72,66,64,76], satisfaction:[68,72,64,62,76] },
    { id:'omar',   name:'Omar Daher',     level:'Beginner',     stance:'Orthodox', initials:'OD', accent:'#ffafef',
      age:11, height:144, weight:37, wingspan:144,
      devScore:58, delta:+8,  season1:[42,40,40,42,48], season2:[58,56,54,56,68], satisfaction:[56,52,50,54,68] },
    { id:'kai',    name:'Kai Nakamura',   level:'Intermediate', stance:'Southpaw', initials:'KN', accent:'#a8e063',
      age:14, height:166, weight:55, wingspan:168,
      devScore:75, delta:+9,  season1:[60,58,58,56,60], season2:[74,74,70,68,78], satisfaction:[74,72,68,66,78] },
    { id:'rico',   name:'Rico Bautista',  level:'Advanced',     stance:'Orthodox', initials:'RB', accent:'#bda6ff',
      age:16, height:175, weight:66, wingspan:179,
      devScore:82, delta:+7,  season1:[70,66,66,68,70], season2:[82,78,76,82,80], satisfaction:[82,78,76,84,82] },
  ];

  // Workshop cohort = squad average across the 12 athletes
  const cohort = (() => {
    const avg = i => Math.round(athletes.reduce((s, a) => s + a.season2[i], 0) / athletes.length);
    return [0,1,2,3,4].map(avg);
  })();

  // ---------- Radar attributes (boxing) ----------
  const radarLabels = ['Fundamentals','Focus Mitts','Noodle','Shields','Partner Work'];

  // Monthly sample points + dev score (hero athlete: Mateo)
  const months = ['Feb 25','Apr','Jun','Aug','Oct','Dec','Feb 26','Apr','May'];
  const devScoreSeries = [72,73,75,76,77,79,81,83,84];

  // ---------- Anthropometrics (Age + Weight + Height + Wingspan) ----------
  // Eight history points (Feb 25 \u2192 May 26) + four projected points (Aug 26 \u2192 May 27).
  // Asterisks (*) mark projected labels.
  const anthroLabels = [
    'Feb 25','Apr 25','Jun 25','Aug 25','Oct 25','Dec 25','Feb 26','May 26',
    'Aug 26*','Nov 26*','Feb 27*','May 27*'
  ];

  // Build per-athlete history + projection series for weight, height, wingspan.
  // Inputs are the current (May 26) values on the athlete record. Growth rates
  // are tuned by age: 11\u201312 grow fast, 13\u201314 peak velocity, 15\u201316 decelerate.
  const ageGrowth = (a) => {
    if (a.age <= 12) return { heightGain:5.0,  weightGain:3.2, wingspanGain:5.4 };
    if (a.age <= 13) return { heightGain:5.6,  weightGain:3.6, wingspanGain:6.0 };
    if (a.age <= 14) return { heightGain:5.4,  weightGain:4.0, wingspanGain:5.6 };
    if (a.age <= 15) return { heightGain:3.8,  weightGain:4.2, wingspanGain:4.0 };
    return            { heightGain:2.0,  weightGain:3.6, wingspanGain:2.2 };
  };

  // 8 history months span the last 12 months; projection runs another 12.
  // We back-cast from the current measurement using the same rate so the
  // history slopes match the projected slope (smooth handover at May 26).
  const ramp = (target, gainPerYear, historyMonths = 12, projMonths = 12) => {
    // historyPoints = 8 covers months -14..0 (every ~2 months)
    // projectedPoints = 4 covers months +3, +6, +9, +12 from May 26
    const monthsHist = [-14,-12,-10,-8,-6,-4,-2,0];
    const monthsProj = [+3,+6,+9,+12];
    const monthly = gainPerYear / 12;
    const hist = monthsHist.map(m => +(target + m * monthly).toFixed(1));
    const proj = monthsProj.map(m => +(target + m * monthly).toFixed(1));
    return { hist, proj };
  };

  // Per-athlete anthro series builder used both for hero and roster picker.
  const anthroFor = (a) => {
    const g = ageGrowth(a);
    const w = ramp(a.weight,   g.weightGain);
    const h = ramp(a.height,   g.heightGain);
    const s = ramp(a.wingspan, g.wingspanGain);

    // Bands: \u00b1 a fraction of next-12-mo gain.
    const band = (target, projArr, frac) => {
      const hi = [target, ...projArr.map((v,i) => +(v + (projArr[i]-target) * frac).toFixed(1))];
      const lo = [target, ...projArr.map((v,i) => +(v - (projArr[i]-target) * frac).toFixed(1))];
      // pad with leading nulls so the band only paints over the projection window
      const pad = Array(7).fill(null);
      return {
        hi: [...pad, ...hi],
        lo: [...pad, ...lo],
      };
    };

    // Pad nulls so history and projection align in the same labels array (length 12).
    const histPad = Array(4).fill(null);
    const projLead = [a.weight, ...w.proj];  // dummy first cell replaced per-series

    const padHistOnly = (hist) => [...hist, null, null, null, null];
    const padProjOnly = (curr, proj) => [null,null,null,null,null,null,null, curr, ...proj];

    // Conditioning index (VO\u2082 proxy) keyed off the beep test result.
    const baseVo2 = 42 + Math.round((a.devScore - 60) * 0.25); // 42\u201348-ish
    const condHist = [-14,-12,-10,-8,-6,-4,-2,0].map(m => +(baseVo2 + (m + 14) * 0.55).toFixed(1));

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
      conditioningActual: padHistOnly(condHist),
    };
  };

  // ---------- Fitness benchmarks (tracked over time) ----------
  // Eight test-date stamps spanning the same 14-month window as anthro history.
  const fitnessLabels = ['Mar 25','May 25','Jul 25','Sep 25','Nov 25','Jan 26','Mar 26','May 26'];

  // Per-athlete fitness curve. Each athlete's current (latest) result is
  // derived from their devScore so stronger athletes test better; history is
  // a smooth ramp to that current value.
  // Test catalogue (units, direction): higher-is-better unless 'lowerBetter'.
  const fitnessCatalogue = [
    { key:'beep',     label:'Beep test (level)',  unit:'level',  lowerBetter:false, baseHero:11.2, spread:2.8 },
    { key:'vertical', label:'Vertical jump',      unit:'cm',     lowerBetter:false, baseHero:48,   spread:10  },
    { key:'broad',    label:'Broad jump',         unit:'cm',     lowerBetter:false, baseHero:212,  spread:34  },
    { key:'sprint20', label:'20m sprint',         unit:'s',      lowerBetter:true,  baseHero:3.20, spread:0.42 },
    { key:'sitReach', label:'Sit-and-reach',      unit:'cm',     lowerBetter:false, baseHero:24,   spread:9   },
    { key:'pushup',   label:'Push-ups (60s)',     unit:'reps',   lowerBetter:false, baseHero:46,   spread:18  },
    { key:'plank',    label:'Plank hold',         unit:'s',      lowerBetter:false, baseHero:140,  spread:50  },
    { key:'rhr',      label:'Resting heart rate', unit:'bpm',    lowerBetter:true,  baseHero:58,   spread:10  },
  ];

  const fitnessFor = (a) => {
    // Skill factor: 0 (lowest devScore in roster) \u2192 1 (highest)
    const minScore = Math.min(...athletes.map(x => x.devScore));
    const maxScore = Math.max(...athletes.map(x => x.devScore));
    const sk = (a.devScore - minScore) / Math.max(1, (maxScore - minScore));

    return fitnessCatalogue.map(t => {
      const dir = t.lowerBetter ? -1 : +1;
      // Current value scales with skill
      const current = +(t.baseHero + dir * (sk - 0.5) * t.spread).toFixed(t.unit === 's' ? 2 : 1);
      // History: 8 points improving over time. Starts ~12% worse, ends at current.
      const startGap = t.baseHero * 0.12 * dir;
      const series = Array.from({ length: 8 }, (_, i) => {
        const t01 = i / 7;
        const v = (current - startGap) + (startGap) * (1 - t01) + (current - (current - startGap)) * t01;
        // smoother: linear from (current - startGap) \u2192 current
        const lerp = (current - startGap) + (startGap) * t01;
        return +lerp.toFixed(t.unit === 's' ? 2 : 1);
      });
      // Replace the formula above with a clean linear lerp.
      const histStart = +(current - startGap).toFixed(t.unit === 's' ? 2 : 1);
      const lerpSeries = Array.from({ length: 8 }, (_, i) => {
        const v = histStart + (current - histStart) * (i / 7);
        return +v.toFixed(t.unit === 's' ? 2 : 1);
      });
      // Trend label: improving when latest beats first by enough margin.
      const delta = lerpSeries[7] - lerpSeries[0];
      const better = t.lowerBetter ? delta < 0 : delta > 0;
      const magnitude = Math.abs(delta) / Math.max(0.0001, Math.abs(lerpSeries[0]));
      const trend = magnitude < 0.04 ? 'flat' : (better ? 'up' : 'down');

      return {
        key: t.key,
        label: t.label,
        unit: t.unit,
        lowerBetter: t.lowerBetter,
        current,
        first: lerpSeries[0],
        series: lerpSeries,
        trend,
      };
    });
  };

  // ---------- Per-attribute trends (the small multiples panel) ----------
  // Boxing-specific themes that map to fundamentals/mitts/noodle/shields/partner.
  const attributeTrends = [
    { key:'jab',          label:'Jab discipline',
      trend:'up',
      text:'Jab snapping back to guard cleanly and resetting stance under fatigue.',
      series:[58,60,62,65,68,70,72,75,78], coaches:{kade:0.5, reyes:0.5}, consensus:'aligned' },
    { key:'cross',        label:'Cross rotation',
      trend:'up',
      text:'Rear-hip rotation showing up consistently in shield work; finishing through the target.',
      series:[55,57,58,60,63,66,69,72,75], coaches:{reyes:0.6, kade:0.4}, consensus:'aligned' },
    { key:'mittAccuracy', label:'Mitt accuracy',
      trend:'up',
      text:'Centre-target hits sustained through four-punch combinations.',
      series:[60,62,63,66,68,71,73,76,78], coaches:{kade:0.7, reyes:0.3}, consensus:'aligned' },
    { key:'slip',         label:'Slip & footwork',
      trend:'flat',
      text:'Slip plane is consistent, but pivot-exit timing still lags under sustained pressure.',
      series:[62,63,64,65,65,66,67,68,68], coaches:{okafor:0.6, kade:0.4}, consensus:'mixed' },
    { key:'guardReturn',  label:'Guard return',
      trend:'up',
      text:'Hands returning home after every shot — visible in the mitt block.',
      series:[54,57,60,63,66,69,72,75,78], coaches:{reyes:0.55, kade:0.45}, consensus:'aligned' },
    { key:'stamina',      label:'Round stamina',
      trend:'up',
      text:'Holds output across all four shield rounds; second-wind point arriving later.',
      series:[60,62,64,66,69,72,74,77,80], coaches:{reyes:0.5, okafor:0.5}, consensus:'aligned' },
    { key:'composure',    label:'Partner composure',
      trend:'up',
      text:'Controlled pace for partner reps and resets calmly when drills drift.',
      series:[66,68,70,72,74,76,78,81,83], coaches:{okafor:0.7, kade:0.3}, consensus:'aligned' },
    { key:'coachability', label:'Coachability',
      trend:'up',
      text:'Applies corrections within the same round — visible in mitt cue calls.',
      series:[68,70,72,74,76,78,80,82,85], coaches:{kade:0.4, reyes:0.4, okafor:0.2}, consensus:'aligned' },
  ];

  // ---------- Strengths / growth / focus (Mateo) ----------
  const lists = {
    strengths: [
      { text:'Jab snapping back to guard fast and consistent across rounds.', coaches:['kade'] },
      { text:'Centre-target accuracy holding through long mitt combinations.', coaches:['reyes','kade'] },
      { text:'Round-by-round stamina above workshop average.', coaches:['reyes'] },
    ],
    growth: [
      { text:'Pivot-exit timing slips when slip-and-counter chains get longer.', coaches:['okafor'] },
      { text:'Lead-hook elbow path widens late in the conditioning round.', coaches:['kade','reyes'] },
      { text:'Composure dips for one or two reps when partners mistime cues.', coaches:['okafor'] },
    ],
    focus: [
      { text:'Three-count slip-pivot drill at sustained tempo every block.', coaches:['okafor'] },
      { text:'Mirror-cued lead-hook reps to lock elbow-line consistency.', coaches:['kade'] },
      { text:'Partner reset language so composure is verbal as well as physical.', coaches:['okafor','reyes'] },
    ],
  };

  // ---------- Timeline (Mateo's two-season story) ----------
  const timeline = {
    s1: [
      { date:'Feb 2025', text:'Jab discipline inconsistent; rear hand often dropped on lead-hook delivery.', coaches:['kade'] },
      { date:'May 2025', text:'Stance widened under fatigue; rear-hip rotation absent late in shield rounds.', coaches:['reyes'] },
      { date:'Aug 2025', text:'Turning point: hand-return discipline locked in across mitt block.',          coaches:['kade'] },
    ],
    s2: [
      { date:'Feb 2026', text:'Opened block with cleaner cross rotation; centre-target accuracy held all session.', coaches:['reyes'] },
      { date:'Mar 2026', text:'Major step in stamina \u2014 finished four shield rounds without form drop.',          coaches:['reyes','okafor'] },
      { date:'May 2026', text:'Started leading partner resets with calm language; coachability visibly upward.',    coaches:['okafor','kade'] },
    ],
    turning: [
      { date:'T1', text:'Switched from arm-swinging hooks to a true pivot-driven hook.',         coaches:['kade'] },
      { date:'T2', text:'Stopped overcommitting on the cross \u2014 stance now recovers cleanly.', coaches:['reyes'] },
      { date:'T3', text:'Earned coach trust to demo combinations for newer workshop members.',  coaches:['kade','reyes','okafor'] },
      { date:'T4', text:'Still needs faster pivot-exit when slip chains run past three counts.', coaches:['okafor'] },
    ],
  };

  // ---------- Observation volume heatmap (categories \u00d7 months) ----------
  const heatCategories = ['Fundamentals','Mitts','Noodle','Shields','Partner'];
  const heatMonths     = ['Feb 25','May 25','Aug 25','Nov 25','Feb 26','May 26'];
  const heatValues = [
    [3,3,4,3,4,4], // Fundamentals
    [2,3,3,3,4,4], // Mitts
    [2,2,2,3,2,3], // Noodle
    [3,3,3,3,4,4], // Shields
    [1,1,2,2,3,3], // Partner
  ];

  // ---------- Workshop cohort comparison (stat share equivalent) ----------
  // Mateo is connected to a small in-workshop friend list.
  // Same consent shape as basketball.
  const statShare = [
    { id:'rico',   name:'Rico Bautista', level:'Advanced',     stance:'Orthodox', devScore:82, delta:+7,  consent:'consent', season1:[70,66,66,68,70], season2:[82,78,76,82,80] },
    { id:'leon',   name:'Leon Petros',   level:'Advanced',     stance:'Orthodox', devScore:81, delta:+6,  consent:'consent', season1:[68,64,64,70,68], season2:[80,78,76,82,82] },
    { id:'marcus', name:'Marcus Cole',   level:'Advanced',     stance:'Southpaw', devScore:79, delta:+4,  consent:'pending', season1:[68,66,62,66,66], season2:[78,76,72,80,78] },
    { id:'kai',    name:'Kai Nakamura',  level:'Intermediate', stance:'Southpaw', devScore:75, delta:+9,  consent:'none',    season1:[60,58,58,56,60], season2:[74,74,70,68,78] },
  ];

  // ---------- Observation feed seed ----------
  // The boxing coach-input page already pushes live entries (tagged
  // discipline:'boxing') into window.VertexData.feed. This local feed seeds
  // the dashboard so it has historical content even on a cold start.
  const seedFeed = [
    { date:'12 Feb 2025', coach:'kade',   kind:'Workshop',    topic:'Fundamentals', text:'Jab returning to guard, but cross still loses rear-hip rotation late in the round.', discipline:'boxing' },
    { date:'27 Apr 2025', coach:'reyes',  kind:'Open Gym',    topic:'Focus mitts',  text:'Centre-target accuracy improved during constrained three-punch ladder.',          discipline:'boxing' },
    { date:'19 Jun 2025', coach:'kade',   kind:'Skills Block',topic:'Noodle',       text:'Slip plane consistent today; pivot-exit timing still slow on long chains.',       discipline:'boxing' },
    { date:'14 Sep 2025', coach:'okafor', kind:'Workshop',    topic:'Partner work', text:'Stayed coachable through three corrections; demoed reset language to the group.', discipline:'boxing' },
    { date:'08 Jan 2026', coach:'reyes',  kind:'Workshop',    topic:'Shields',      text:'Held output across all four shield rounds; finishing through the target.',        discipline:'boxing' },
    { date:'22 Mar 2026', coach:'kade',   kind:'Skills Block',topic:'Fundamentals', text:'Lead-hook elbow path drifted late in the conditioning block.',                    discipline:'boxing' },
    { date:'14 Apr 2026', coach:'reyes',  kind:'Workshop',    topic:'Focus mitts',  text:'Reaction on the random mitt cue arriving on the first frame.',                    discipline:'boxing' },
    { date:'02 May 2026', coach:'okafor', kind:'Open Gym',    topic:'Partner work', text:'Calm reset language with newer partner; controlled pace for partner safety.',     discipline:'boxing' },
    { date:'18 May 2026', coach:'kade',   kind:'Skills Block',topic:'Fundamentals', text:'Stance recovery between combinations crisp \u2014 visibly cleaner than last block.',  discipline:'boxing' },
  ];

  return {
    coaches, athletes, cohort, radarLabels, months, devScoreSeries,
    // Anthro + fitness helpers
    anthroLabels, fitnessLabels, anthroFor, fitnessFor, fitnessCatalogue,
    attributeTrends, statShare, timeline, lists, seedFeed,
    heatCategories, heatMonths, heatValues,
  };
})();
