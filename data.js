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

  // Height in cm — actual samples then projected to U18 (Sep 26)
  const heightLabels = [
    'Feb 24','May 24','Aug 24','Nov 24','Feb 25','May 25','Aug 25','Sep 25',
    'Dec 25*','Mar 26*','Jun 26*','Sep 26*'
  ];
  const heightActual    = [170.2,171.1,172.0,172.8,173.6,174.3,174.8,175.0,null,null,null,null];
  // Projected continues smoothly; linear-ish with decelerating growth
  const heightProjected = [null,null,null,null,null,null,null,175.0,175.6,176.1,176.5,176.8];
  const heightBandHi    = [null,null,null,null,null,null,null,175.0,176.8,177.5,178.1,178.6];
  const heightBandLo    = [null,null,null,null,null,null,null,175.0,174.4,174.7,174.9,175.0];
  const wingspanActual  = [173.5,174.4,175.2,176.1,177.0,177.8,178.4,178.6,null,null,null,null];

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

  // Player watchlist — peers for benchmarking
  const watchlist = [
    { id:'maya',  name:'Maya Okafor',  pos:'Guard',        devScore:88, delta:+9, season1:[68,64,72,66,58,64], season2:[82,80,78,80,72,78] },
    { id:'jess',  name:'Jess Tanaka',  pos:'Wing',         devScore:81, delta:+6, season1:[60,62,68,58,52,58], season2:[74,77,76,72,66,70] },
    { id:'priya', name:'Priya Sharma', pos:'Combo Guard',  devScore:79, delta:+4, season1:[64,60,62,60,55,58], season2:[72,72,70,74,64,68] },
    { id:'kira',  name:'Kira Bell',    pos:'Wing/Forward', devScore:77, delta:+3, season1:[58,56,70,62,50,54], season2:[68,70,76,74,60,66] },
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
    heightLabels, heightActual, heightProjected, heightBandHi, heightBandLo, wingspanActual,
    attributeTrends, watchlist, timeline, lists, feed,
    heatCategories, heatMonths, heatValues,
  };
})();
