// Coach input page — squad roster + basketball-specific phrase library
// Phrases are tuned to each attribute × sentiment slot. Coach picks player(s),
// attribute, sentiment, then taps a phrase to log an observation in 2-4 taps.

window.VertexCoachData = (() => {
  // ---------- 12-player mock squad (South Metro Performance, U16 girls) ----------
  // Ava is the focus athlete for the existing dashboard. The rest are mock squadmates.
  const squad = [
    { id:'ava',   name:'Ava Thompson',    pos:'G/W',  num:5,  initials:'AT', accent:'#9bd2ff' },
    { id:'priya', name:'Priya Sharma',    pos:'G',    num:3,  initials:'PS', accent:'#7ed7c5' },
    { id:'mira',  name:'Mira Velasco',    pos:'G',    num:7,  initials:'MV', accent:'#ffbf66' },
    { id:'kira',  name:'Kira Bell',       pos:'W/F',  num:11, initials:'KB', accent:'#c89bff' },
    { id:'jess',  name:'Jess Tanaka',     pos:'W',    num:8,  initials:'JT', accent:'#ff9bb6' },
    { id:'tess',  name:'Tess O\u2019Connor',  pos:'F',    num:14, initials:'TO', accent:'#8de08a' },
    { id:'lana',  name:'Lana Petrov',     pos:'F',    num:23, initials:'LP', accent:'#ffd56b' },
    { id:'sam',   name:'Sam Whittaker',   pos:'F/C',  num:32, initials:'SW', accent:'#ff8a8a' },
    { id:'noor',  name:'Noor Haddad',     pos:'C',    num:44, initials:'NH', accent:'#6bd5ff' },
    { id:'evie',  name:'Evie Park',       pos:'G',    num:1,  initials:'EP', accent:'#ffafef' },
    { id:'rose',  name:'Rose Adeyemi',    pos:'W',    num:9,  initials:'RA', accent:'#a8e063' },
    { id:'mae',   name:'Mae Lindqvist',   pos:'G/W',  num:6,  initials:'ML', accent:'#bda6ff' },
  ];

  // ---------- Attribute palette ----------
  // Mirrors radarLabels in data.js so entries map cleanly into the dashboard.
  // Each attribute also maps to a feed 'topic' string used by the dashboard.
  const attributes = [
    { key:'technical',    label:'Technical',    short:'TECH',  topic:'Technical skill',  glyph:'\u25C6' },
    { key:'tactical',     label:'Tactical',     short:'TAC',   topic:'Decision-making',  glyph:'\u25B2' },
    { key:'physical',     label:'Physical',     short:'PHYS',  topic:'Physical',         glyph:'\u25CF' },
    { key:'mental',       label:'Mental',       short:'MENT',  topic:'Mental',           glyph:'\u2756' },
    { key:'consistency',  label:'Consistency',  short:'CONS',  topic:'Consistency',      glyph:'\u2261' },
    { key:'leadership',   label:'Leadership',   short:'LEAD',  topic:'Leadership',       glyph:'\u2605' },
  ];

  // ---------- Coaches (mirror data.js) ----------
  const coaches = [
    { id:'lin',    name:'Coach Lin',    initials:'CL', color:'#59b7ff' },
    { id:'rivera', name:'Coach Rivera', initials:'CR', color:'#ffbf66' },
    { id:'vidal',  name:'Coach Vidal',  initials:'MV', color:'#c89bff' },
  ];

  // Session kinds match data.js feed.kind values
  const sessionKinds = ['Training','Game','Review'];

  // ---------- Phrase library ----------
  // 6 attributes × 3 sentiments × ~8 phrases = ~144 seed phrases.
  // sentiment: '+' commend, '=' neutral note, '-' critique.
  // Written in coaching shorthand; courtside-readable.
  const phrases = {
    technical: {
      '+': [
        'Clean catch-and-shoot footwork on the move',
        'Inside-pivot to face up was textbook tonight',
        'Off-hand finish around the rim — both sides',
        'Floater touch over the drop big',
        'Sharp jab series before the drive',
        'Tight pocket pass out of the PnR',
        'Reverse layup choice instead of forced layup',
        'Strong two-foot stop on the catch in the paint',
      ],
      '=': [
        'Working on hop-step into the pull-up',
        'Trying the new pin-down footwork',
        'Adding a left-hand finish package',
        'Testing the runner from the elbow',
        'Reps on inside-out dribble release',
        'Adjusted shooting base width this week',
        'New ball-screen footwork being introduced',
        'Experimenting with eurostep timing',
      ],
      '-': [
        'Travels on the gather step under pressure',
        'Drops the off-hand before the shot',
        'Releases off the front foot when rushed',
        'Picks the ball up too early on the drive',
        'No second move once the first is denied',
        'Flat shooting arc when contested',
        'Loses the dribble on the change-of-direction',
        'Footwork breaks down on pump-fake recovery',
      ],
    },
    tactical: {
      '+': [
        'Read the second defender before the catch',
        'Reset tempo after the trigger pass',
        'Found the skip-pass window on the swing',
        'Called the coverage early in PnR',
        'Used pace change instead of speed to get downhill',
        'Drew help and kicked to the open corner',
        'Recognised the mismatch and posted immediately',
        'Took the catch-drive-kick option over the contested pull-up',
      ],
      '=': [
        'Walking through the side-PnR reads on the whiteboard',
        'Reviewing late-clock decision tree',
        'Talking through advantage/disadvantage cues',
        'Testing trigger reads in 3v3 constraint',
        'Working on early-offence drag screen entries',
        'New coverage call being learned this week',
        'Adjusting spacing on the weak-side cut',
        'Looking at film of last week\u2019s broken plays',
      ],
      '-': [
        'Forced contested pull-up with a kick-out open',
        'Held the ball through the trigger window',
        'Drove into the second defender instead of resetting',
        'Missed the skip read on the swing',
        'Late to the spacing rotation on the drive',
        'Took the first read every time — predictable',
        'Wrong coverage call on the side ball-screen',
        'Drifted into the driver\u2019s lane on the corner cut',
      ],
    },
    physical: {
      '+': [
        'Sprinted the full lane on every transition',
        'Held the box-out through the whistle',
        'Won three loose balls in a row',
        'Recovered to the shooter after losing the screen',
        'Strong base on the catch — no leak',
        'Beat the rebound to the spot, not the ball',
        'Closed out high and short — no leak past',
        'Held position through contact on the post-up',
      ],
      '=': [
        'Returning from minor knock — managed minutes',
        'Working through GPS load review this week',
        'Adjusting strength block focus',
        'Testing new mouthguard fit',
        'Recovery day scheduled tomorrow',
        'Stretching protocol updated post-session',
        'Hydration and sleep flagged green',
        'Conditioning block tomorrow before scrimmage',
      ],
      '-': [
        'Stood and watched after the shot — no crash',
        'Lost the box-out two possessions running',
        'Heavy feet on the closeout, blew past',
        'Stopped sprinting through the third quarter',
        'Soft on contact at the rim',
        'Beaten to every loose ball in the paint',
        'Late to recover after the screen',
        'Dropped intensity on the second defensive effort',
      ],
    },
    mental: {
      '+': [
        'Reset cleanly after the turnover — next play mindset',
        'Composed at the line late in a tight game',
        'Took the corrective coaching cue mid-possession',
        'Stayed locked in during the long timeout',
        'Read the moment and slowed the team down',
        'Bounced back from the missed assignment within a possession',
        'Maintained focus during the officials\u2019 review',
        'Stayed engaged on the bench — clapping correct calls',
      ],
      '=': [
        'Pre-game routine being refined',
        'Working through visualisation script with sports psych',
        'Talking through pressure cues in 1:1 review',
        'Trialing a new mid-game breathing reset',
        'Mindset journal entry shared with staff',
        'Reviewing high-leverage moments from last game',
        'Working on body language between possessions',
        'Pre-shot routine consistency under review',
      ],
      '-': [
        'Shoulders dropped after the missed three',
        'Argued the call instead of running back',
        'Carried the previous turnover into the next two plays',
        'Visibly frustrated after the substitution',
        'Lost focus during the late timeout',
        'Confidence dipped after a single bad rep',
        'Stopped competing once down double digits',
        'Eyes on the floor through the coach\u2019s correction',
      ],
    },
    consistency: {
      '+': [
        'Same shot prep every catch — no shortcuts',
        'Hit the same defensive spot four times in a row',
        'Routine before every free throw was identical',
        'Matched effort in the fourth to effort in the first',
        'Repeated the corrected footwork next possession',
        'Same call-out on every PnR coverage',
        'Stayed locked in across both halves',
        'Maintained spacing discipline every trip down',
      ],
      '=': [
        'New routine being installed this block',
        'Tracking shot mechanics across the week',
        'Comparing first-half vs second-half effort metrics',
        'Reviewing repeatability of free-throw routine',
        'Testing consistency under varied fatigue',
        'Logging defensive stance percentage this session',
        'Pre-shot tempo being measured this week',
        'Drill-to-game transfer review scheduled',
      ],
      '-': [
        'Shot mechanics changed every attempt',
        'Effort dropped sharply in the second half',
        'Routine skipped under pressure',
        'Different defensive stance every possession',
        'Made the correction once then reverted',
        'Hot first quarter, invisible in the third',
        'Spacing discipline only when ball is on her side',
        'Effort tied to scoreline, not standard',
      ],
    },
    leadership: {
      '+': [
        'Steadied teammates after the run with body language',
        'Called the coverage out loud before the screen',
        'First to the huddle after the timeout',
        'Picked up a teammate after their turnover',
        'Set the defensive talk standard early',
        'Took ownership of the rotation breakdown',
        'Modelled the routine for the younger players',
        'Voice carried across the floor in transition',
      ],
      '=': [
        'Captain rotation conversation this week',
        'Working on huddle delivery and tone',
        'Pre-game speech draft shared with staff',
        'Reviewing video of her leadership moments',
        'Mentoring a younger player this block',
        'Volunteered for the captains\u2019 standards meeting',
        'New role: lead the defensive shell call-outs',
        'Working on assertive communication in scramble',
      ],
      '-': [
        'Quieter in the huddle after early mistakes',
        'No call-outs on the back-line through the third',
        'Body language dropped — team followed',
        'Avoided eye contact during the coaching point',
        'Let the turnover spiral without resetting the group',
        'Sat at the end of the bench during the timeout',
        'Pointed at a teammate instead of owning the breakdown',
        'Voice disappeared once the deficit grew',
      ],
    },
  };

  // ---------- Quick-pick recents (mock — coach.js will replace with real usage) ----------
  const seedRecents = {
    player: ['ava','priya','kira'],
    attribute: ['tactical','mental','leadership'],
    phrase: [], // populated as coach uses the page
  };

  return { squad, attributes, coaches, sessionKinds, phrases, seedRecents };
})();
