#!/usr/bin/env node
/**
 * seed-metrics.js
 *
 * Produces forms/registry/metrics.json — the seed catalogue of ~150 metrics
 * spanning all sports declared in the contract (§6 SPORTS enum).
 *
 * Usage: node scripts/seed-metrics.js > metrics.seed.json
 *
 * Conventions (see CONTEXT.md):
 *  - keys are snake_case, no leading digit
 *  - canonical units match contract §6.1
 *  - sports: ['*'] = applies to all sports; otherwise an explicit list
 *  - category: one of the seeded picker categories
 *  - formula is null for direct metrics, non-empty string for computed
 *  - bilateral metrics ship as two separate keys (e.g. grip_strength_left/right)
 */

const NOW = '2026-05-25T12:00:00Z';

// Helper to keep entries compact in source while emitting full records.
const m = (key, label, kind, canonicalUnit, displayUnits, min, max, decimals, category, sports, formula = null) => ({
  key, label, kind, canonicalUnit, displayUnits, min, max, decimals,
  category, sports, formula,
  status: 'active',
  source: 'seed',
  createdAt: NOW,
  updatedAt: NOW,
});

const ALL = ['*'];
const items = [

  // ─────────────────────────────────────────────────────────────────
  // ANTHROPOMETRY (applies to all sports)
  // ─────────────────────────────────────────────────────────────────
  m('body_height',         'Body height',            'length',   'm',  ['cm','in','ft'], 1.0, 2.3, 1, 'anthropometry', ALL),
  m('body_mass',           'Body mass',              'weight',   'kg', ['kg','lb'],      30,  200, 1, 'anthropometry', ALL),
  m('wingspan',            'Wingspan',               'length',   'm',  ['cm','in'],      1.0, 2.5, 1, 'anthropometry', ALL),
  m('standing_reach',      'Standing reach',         'length',   'm',  ['cm','in'],      1.5, 3.0, 1, 'anthropometry', ALL),
  m('seated_height',       'Seated height',          'length',   'm',  ['cm','in'],      0.6, 1.2, 1, 'anthropometry', ALL),
  m('hand_length',         'Hand length',            'length',   'm',  ['cm','in'],      0.10,0.30, 1, 'anthropometry', ALL),
  m('hand_span',           'Hand span',              'length',   'm',  ['cm','in'],      0.10,0.32, 1, 'anthropometry', ALL),
  m('arm_length',          'Arm length',             'length',   'm',  ['cm','in'],      0.4, 1.0, 1, 'anthropometry', ALL),

  // ─────────────────────────────────────────────────────────────────
  // BODY COMPOSITION
  // ─────────────────────────────────────────────────────────────────
  m('body_fat_pct',        'Body fat %',             'percentage','%', ['%'],            2,   45,  1, 'body-comp',    ALL),
  m('lean_mass',           'Lean body mass',         'weight',   'kg', ['kg','lb'],      30,  150, 1, 'body-comp',    ALL),
  m('fat_mass',            'Fat mass',               'weight',   'kg', ['kg','lb'],      2,   80,  1, 'body-comp',    ALL),
  m('skinfold_sum_7',      'Skinfold sum (7-site)',  'length',   'm',  ['mm'],           0.020,0.300, 1, 'body-comp', ALL),
  m('bmi',                 'BMI',                    'ratio',    '',   [''],             10,  50,  1, 'body-comp',    ALL,
    'body_mass / (body_height * body_height)'),

  // ─────────────────────────────────────────────────────────────────
  // JUMPS
  // ─────────────────────────────────────────────────────────────────
  m('cmj_height',          'CMJ height',                       'length','m', ['cm','in'],     0, 1.2, 1, 'jumps', ALL),
  m('cmj_contact_time',    'CMJ ground contact time',          'time',  's', ['ms','s'],     0, 1.5, 3, 'jumps', ALL),
  m('cmj_peak_power',      'CMJ peak power',                   'power', 'W', ['W','kW'],     0, 8000, 0, 'jumps', ALL),
  m('cmj_peak_force',      'CMJ peak force',                   'force', 'N', ['N','kgf'],    0, 5000, 0, 'jumps', ALL),
  m('squat_jump_height',   'Squat jump height (no countermove)','length','m',['cm','in'],    0, 1.2, 1, 'jumps', ALL),
  m('drop_jump_height',    'Drop jump height',                 'length','m', ['cm','in'],     0, 1.2, 1, 'jumps', ALL),
  m('drop_jump_contact_time','Drop jump contact time',          'time', 's', ['ms','s'],     0, 1.0, 3, 'jumps', ALL),
  m('broad_jump_distance', 'Standing broad jump',              'length','m', ['cm','m','in','ft'], 0, 4.0, 2, 'jumps', ALL),
  m('vertical_jump_run',   'Running vertical (max reach jump)','length','m', ['cm','in'],     0, 1.5, 1, 'jumps', ALL,
    null),
  m('approach_jump_height','Approach jump height',             'length','m', ['cm','in'],     0, 1.5, 1, 'jumps', ['basketball','volleyball','netball']),
  m('block_jump_height',   'Block jump height',                'length','m', ['cm','in'],     0, 1.2, 1, 'jumps', ['volleyball','basketball']),
  m('spike_jump_height',   'Spike/attack jump height',         'length','m', ['cm','in'],     0, 1.4, 1, 'jumps', ['volleyball']),
  m('single_leg_cmj_left', 'Single-leg CMJ (left)',            'length','m', ['cm','in'],     0, 0.9, 1, 'jumps', ALL),
  m('single_leg_cmj_right','Single-leg CMJ (right)',           'length','m', ['cm','in'],     0, 0.9, 1, 'jumps', ALL),
  m('rsi',                 'RSI (reactive strength index)',     'ratio', '',  [''],           0, 5.0, 2, 'jumps', ALL,
    'drop_jump_height / drop_jump_contact_time'),
  m('rsi_modified',        'RSI-modified (CMJ)',                'ratio', '',  [''],           0, 1.5, 2, 'jumps', ALL,
    'cmj_height / cmj_contact_time'),
  m('jump_asymmetry_pct',  'Single-leg CMJ asymmetry %',        'percentage','%',['%'],       0, 50,  1, 'jumps', ALL,
    'abs(single_leg_cmj_left - single_leg_cmj_right) / max(single_leg_cmj_left, single_leg_cmj_right) * 100'),

  // ─────────────────────────────────────────────────────────────────
  // SPRINTS (track of all sports + athletics_sprints)
  // ─────────────────────────────────────────────────────────────────
  m('sprint_5m',           '5m sprint',              'time',  's',  ['s','ms'],         0.5, 3.0, 2, 'sprints', ALL),
  m('sprint_10m',          '10m sprint',             'time',  's',  ['s','ms'],         1.0, 4.0, 2, 'sprints', ALL),
  m('sprint_20m',          '20m sprint',             'time',  's',  ['s','ms'],         2.0, 6.0, 2, 'sprints', ALL),
  m('sprint_30m',          '30m sprint',             'time',  's',  ['s','ms'],         3.0, 8.0, 2, 'sprints', ALL),
  m('sprint_40m',          '40m sprint',             'time',  's',  ['s','ms'],         4.0, 9.5, 2, 'sprints', ['athletics_sprints','soccer','afl','rugby_league','rugby_union']),
  m('sprint_40yd',         '40-yard dash',           'time',  's',  ['s','ms'],         4.0, 8.0, 2, 'sprints', ['rugby_league','rugby_union','afl']),
  m('sprint_60m',          '60m sprint',             'time',  's',  ['s','ms'],         5.0, 12,  2, 'sprints', ['athletics_sprints']),
  m('sprint_100m',         '100m',                   'time',  's',  ['s'],              9.0, 20,  2, 'sprints', ['athletics_sprints']),
  m('sprint_200m',         '200m',                   'time',  's',  ['s'],              18,  40,  2, 'sprints', ['athletics_sprints']),
  m('sprint_400m',         '400m',                   'time',  's',  ['s'],              40,  90,  2, 'sprints', ['athletics_sprints','athletics_distance']),
  m('flying_20m',          'Flying 20m (max-velocity phase)','time','s',['s','ms'],     1.6, 3.5, 2, 'sprints', ALL),
  m('max_velocity',        'Peak running velocity',  'speed', 'm/s',['m/s','km/h','mph'], 4,  13,  2, 'sprints', ALL),

  // ─────────────────────────────────────────────────────────────────
  // AGILITY / COD
  // ─────────────────────────────────────────────────────────────────
  m('agility_505_left',    '505 agility (left turn)',           'time','s', ['s','ms'], 1.8, 4.0, 2, 'agility', ALL),
  m('agility_505_right',   '505 agility (right turn)',          'time','s', ['s','ms'], 1.8, 4.0, 2, 'agility', ALL),
  m('agility_505_asymmetry_pct', '505 agility asymmetry %',     'percentage','%',['%'], 0, 30, 1, 'agility', ALL,
    'abs(agility_505_left - agility_505_right) / max(agility_505_left, agility_505_right) * 100'),
  m('t_test',              'T-test',                            'time','s', ['s'],      8,  16,  2, 'agility', ['basketball','tennis','soccer','netball']),
  m('illinois_agility',    'Illinois agility',                  'time','s', ['s'],     12,  25,  2, 'agility', ALL),
  m('three_cone_drill',    '3-cone drill (L-drill)',            'time','s', ['s'],      6,  10,  2, 'agility', ['rugby_league','rugby_union','afl']),
  m('hexagon_agility',     'Hexagon agility',                   'time','s', ['s'],      8,  25,  2, 'agility', ALL),
  m('reactive_agility_avg','Reactive agility avg time',         'time','s', ['s'],      1,  5,   2, 'agility', ALL),
  m('y_balance_anterior',  'Y-balance anterior reach',          'length','m',['cm'],    0.3,1.2, 1, 'agility', ALL),
  m('shuttle_pro_agility', '5-10-5 pro agility shuttle',        'time','s', ['s'],      3,  7,   2, 'agility', ALL),

  // ─────────────────────────────────────────────────────────────────
  // ENDURANCE
  // ─────────────────────────────────────────────────────────────────
  m('beep_test_stage',     'Beep test stage reached',           'rating',  '',   [''],   1, 21,  1, 'endurance', ALL),
  m('beep_test_total_shuttles','Beep test total shuttles',      'count',  'unit',['unit'],0, 250, 0, 'endurance', ALL),
  m('yoyo_ir1_distance',   'Yo-Yo IR1 distance',                'length', 'm', ['m','km'],0, 4000, 0, 'endurance', ALL),
  m('yoyo_ir2_distance',   'Yo-Yo IR2 distance',                'length', 'm', ['m','km'],0, 2500, 0, 'endurance', ALL),
  m('ift_30_15_vel',       '30-15 IFT final velocity',          'speed',  'm/s',['km/h','m/s'], 2, 6, 2, 'endurance', ALL),
  m('cooper_test_distance','Cooper test (12 min) distance',     'length', 'm', ['m','km','mi'], 1000, 5000, 0, 'endurance', ALL),
  m('row_2km_time',        '2km rowing time',                   'time',   's', ['s','min'], 360, 720, 1, 'endurance', ALL),
  m('run_5km_time',        '5km run time',                      'time',   's', ['s','min'], 720, 2400, 0, 'endurance', ['athletics_distance','soccer','rugby_league','rugby_union','afl','hockey']),
  m('vo2max',              'VO2max',                            'ratio',  '',  [''],       20, 90, 1, 'endurance', ALL),
  m('hr_max',              'Max heart rate',                    'frequency','Hz',['bpm'], 0.5, 4.0, 0, 'endurance', ALL),
  m('hr_resting',          'Resting heart rate',                'frequency','Hz',['bpm'], 0.5, 2.0, 0, 'endurance', ALL),
  m('lactate_threshold_hr','Lactate threshold HR',              'frequency','Hz',['bpm'], 1.5, 3.5, 0, 'endurance', ALL),

  // ─────────────────────────────────────────────────────────────────
  // LIFTS
  // ─────────────────────────────────────────────────────────────────
  m('back_squat_1rm',      'Back squat 1RM',                    'weight','kg',['kg','lb'], 0, 400, 1, 'lifts', ALL),
  m('front_squat_1rm',     'Front squat 1RM',                   'weight','kg',['kg','lb'], 0, 350, 1, 'lifts', ALL),
  m('bench_press_1rm',     'Bench press 1RM',                   'weight','kg',['kg','lb'], 0, 300, 1, 'lifts', ALL),
  m('deadlift_1rm',        'Deadlift 1RM',                      'weight','kg',['kg','lb'], 0, 450, 1, 'lifts', ALL),
  m('power_clean_1rm',     'Power clean 1RM',                   'weight','kg',['kg','lb'], 0, 250, 1, 'lifts', ALL),
  m('snatch_1rm',          'Snatch 1RM',                        'weight','kg',['kg','lb'], 0, 200, 1, 'lifts', ALL),
  m('chin_up_max',         'Chin-up max reps',                  'count', 'unit',['unit'],  0, 60,  0, 'lifts', ALL),
  m('pull_up_weighted_1rm','Weighted pull-up 1RM (added load)', 'weight','kg',['kg','lb'], 0, 100, 1, 'lifts', ALL),
  m('bench_pull_1rm',      'Prone bench pull 1RM',              'weight','kg',['kg','lb'], 0, 180, 1, 'lifts', ALL),
  m('strength_to_bw_squat','Squat-to-bodyweight ratio',         'ratio', '',  [''],        0, 4.0, 2, 'lifts', ALL,
    'back_squat_1rm / body_mass'),
  m('strength_to_bw_bench','Bench-to-bodyweight ratio',         'ratio', '',  [''],        0, 3.0, 2, 'lifts', ALL,
    'bench_press_1rm / body_mass'),
  m('isometric_midthigh_pull_peak','IMTP peak force',           'force', 'N', ['N','kgf'], 0, 6000, 0, 'lifts', ALL),

  // ─────────────────────────────────────────────────────────────────
  // POWER / WINGATE
  // ─────────────────────────────────────────────────────────────────
  m('wingate_peak_power',  'Wingate peak power',                'power', 'W', ['W','kW'],  0, 2500, 0, 'power', ALL),
  m('wingate_mean_power',  'Wingate mean power',                'power', 'W', ['W','kW'],  0, 1500, 0, 'power', ALL),
  m('wingate_fatigue_pct', 'Wingate fatigue index %',           'percentage','%',['%'],    0, 80,  1, 'power', ALL),
  m('peak_power_to_bw',    'Peak power-to-bodyweight',          'ratio', '',  [''],        0, 30,  2, 'power', ALL,
    'wingate_peak_power / body_mass'),
  m('bar_velocity_mean',   'Mean bar velocity (load)',          'speed', 'm/s',['m/s'],    0, 2.5, 2, 'power', ALL),
  m('bar_velocity_peak',   'Peak bar velocity (load)',          'speed', 'm/s',['m/s'],    0, 3.5, 2, 'power', ALL),

  // ─────────────────────────────────────────────────────────────────
  // GRIP STRENGTH (bilateral)
  // ─────────────────────────────────────────────────────────────────
  m('grip_strength_left',  'Grip strength (left)',              'force','N',  ['kgf','N','lbf'], 0, 1000, 0, 'grip-strength', ALL),
  m('grip_strength_right', 'Grip strength (right)',             'force','N',  ['kgf','N','lbf'], 0, 1000, 0, 'grip-strength', ALL),
  m('grip_asymmetry_pct',  'Grip strength asymmetry %',         'percentage','%',['%'],          0, 50, 1, 'grip-strength', ALL,
    'abs(grip_strength_left - grip_strength_right) / max(grip_strength_left, grip_strength_right) * 100'),

  // ─────────────────────────────────────────────────────────────────
  // FLEXIBILITY / ROM
  // ─────────────────────────────────────────────────────────────────
  m('sit_and_reach',       'Sit-and-reach',                     'length','m', ['cm','in'],-0.3, 0.5, 1, 'flexibility', ALL),
  m('ankle_dorsiflexion_left','Ankle dorsiflexion (left)',      'length','m', ['cm','in'], 0,    0.20, 1, 'flexibility', ALL),
  m('ankle_dorsiflexion_right','Ankle dorsiflexion (right)',    'length','m', ['cm','in'], 0,    0.20, 1, 'flexibility', ALL),
  m('shoulder_flexion_left', 'Shoulder flexion ROM (left)',     'angle', 'deg',['deg'],    0,    200, 0, 'flexibility', ALL),
  m('shoulder_flexion_right','Shoulder flexion ROM (right)',    'angle', 'deg',['deg'],    0,    200, 0, 'flexibility', ALL),
  m('hamstring_passive_sl',  'Active SL hamstring (deg)',       'angle', 'deg',['deg'],    0,    130, 0, 'flexibility', ALL),

  // ─────────────────────────────────────────────────────────────────
  // PERCEPTUAL / WELLNESS
  // ─────────────────────────────────────────────────────────────────
  m('rpe_session',         'sRPE (session)',                    'rating','',  [''],        0, 10, 0, 'perceptual', ALL),
  m('rpe_set',              'RPE (set)',                        'rating','',  [''],        0, 10, 0, 'perceptual', ALL),
  m('wellness_sleep',      'Sleep quality (1-5)',               'rating','',  [''],        1, 5,  0, 'wellness',   ALL),
  m('wellness_soreness',   'Soreness (1-5)',                    'rating','',  [''],        1, 5,  0, 'wellness',   ALL),
  m('wellness_mood',       'Mood (1-5)',                        'rating','',  [''],        1, 5,  0, 'wellness',   ALL),
  m('wellness_stress',     'Stress (1-5)',                      'rating','',  [''],        1, 5,  0, 'wellness',   ALL),
  m('wellness_fatigue',    'Fatigue (1-5)',                     'rating','',  [''],        1, 5,  0, 'wellness',   ALL),
  m('reaction_time_simple','Simple reaction time',              'time',  's', ['ms','s'],  0.1, 1.0, 3, 'perceptual', ALL),
  m('reaction_time_choice','Choice reaction time',              'time',  's', ['ms','s'],  0.2, 2.0, 3, 'perceptual', ALL),
  m('attendance',          'Attended session',                  'boolean','', [''],        0, 1,  0, 'wellness',   ALL),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — Basketball
  // ─────────────────────────────────────────────────────────────────
  m('ft_attempts',         'Free throws attempted',             'count','unit',['unit'],   0, 200, 0, 'skill', ['basketball']),
  m('ft_makes',            'Free throws made',                  'count','unit',['unit'],   0, 200, 0, 'skill', ['basketball']),
  m('ft_pct',              'Free throw %',                      'percentage','%',['%'],    0, 100, 1, 'skill', ['basketball'],
    'ft_makes / ft_attempts * 100'),
  m('three_point_attempts','Three-point attempts',              'count','unit',['unit'],   0, 200, 0, 'skill', ['basketball']),
  m('three_point_makes',   'Three-point makes',                 'count','unit',['unit'],   0, 200, 0, 'skill', ['basketball']),
  m('three_point_pct',     'Three-point %',                     'percentage','%',['%'],    0, 100, 1, 'skill', ['basketball'],
    'three_point_makes / three_point_attempts * 100'),
  m('lane_agility',        'Lane agility drill (NBA)',          'time','s',  ['s'],        9, 16,  2, 'agility', ['basketball']),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — Soccer
  // ─────────────────────────────────────────────────────────────────
  m('soccer_pass_attempts',     'Passes attempted',             'count','unit',['unit'],   0, 200, 0, 'skill', ['soccer']),
  m('soccer_pass_completed',    'Passes completed',             'count','unit',['unit'],   0, 200, 0, 'skill', ['soccer']),
  m('soccer_pass_pct',          'Pass completion %',            'percentage','%',['%'],    0, 100, 1, 'skill', ['soccer'],
    'soccer_pass_completed / soccer_pass_attempts * 100'),
  m('soccer_shot_attempts',     'Shots attempted',              'count','unit',['unit'],   0, 50,  0, 'skill', ['soccer']),
  m('soccer_shot_on_target',    'Shots on target',              'count','unit',['unit'],   0, 50,  0, 'skill', ['soccer']),
  m('soccer_juggle_max',        'Juggling max reps',            'count','unit',['unit'],   0, 1000,0, 'skill', ['soccer']),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — Netball
  // ─────────────────────────────────────────────────────────────────
  m('netball_shot_attempts',    'Shot attempts',                'count','unit',['unit'],   0, 100, 0, 'skill', ['netball']),
  m('netball_shot_makes',       'Shots made',                   'count','unit',['unit'],   0, 100, 0, 'skill', ['netball']),
  m('netball_shot_pct',         'Shooting %',                   'percentage','%',['%'],    0, 100, 1, 'skill', ['netball'],
    'netball_shot_makes / netball_shot_attempts * 100'),
  m('netball_intercepts',       'Intercepts',                   'count','unit',['unit'],   0, 30,  0, 'skill', ['netball']),
  m('netball_centre_pass_wins', 'Centre pass wins',             'count','unit',['unit'],   0, 60,  0, 'skill', ['netball']),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — Hockey (field hockey)
  // ─────────────────────────────────────────────────────────────────
  m('hockey_pass_attempts',     'Hit pass attempts',            'count','unit',['unit'],   0, 200, 0, 'skill', ['hockey']),
  m('hockey_pass_completed',    'Hit passes completed',         'count','unit',['unit'],   0, 200, 0, 'skill', ['hockey']),
  m('hockey_pass_pct',          'Hit pass %',                   'percentage','%',['%'],    0, 100, 1, 'skill', ['hockey'],
    'hockey_pass_completed / hockey_pass_attempts * 100'),
  m('hockey_circle_entries',    'Circle entries',               'count','unit',['unit'],   0, 50,  0, 'skill', ['hockey']),
  m('hockey_short_corners_won', 'Short corners won',            'count','unit',['unit'],   0, 20,  0, 'skill', ['hockey']),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — Rugby League
  // ─────────────────────────────────────────────────────────────────
  m('rl_tackle_attempts',       'Tackle attempts',              'count','unit',['unit'],   0, 60,  0, 'skill', ['rugby_league']),
  m('rl_tackle_completed',      'Tackles completed',            'count','unit',['unit'],   0, 60,  0, 'skill', ['rugby_league']),
  m('rl_tackle_pct',            'Tackle completion %',          'percentage','%',['%'],    0, 100, 1, 'skill', ['rugby_league'],
    'rl_tackle_completed / rl_tackle_attempts * 100'),
  m('rl_metres_run',            'Metres run',                   'length','m', ['m'],       0, 400, 0, 'skill', ['rugby_league']),
  m('rl_line_breaks',           'Line breaks',                  'count','unit',['unit'],   0, 10,  0, 'skill', ['rugby_league']),
  m('rl_offloads',              'Offloads',                     'count','unit',['unit'],   0, 15,  0, 'skill', ['rugby_league']),
  m('rl_goal_kick_attempts',    'Goal kick attempts',           'count','unit',['unit'],   0, 15,  0, 'skill', ['rugby_league']),
  m('rl_goal_kick_makes',       'Goal kicks made',              'count','unit',['unit'],   0, 15,  0, 'skill', ['rugby_league']),
  m('rl_goal_kick_pct',         'Goal kick %',                  'percentage','%',['%'],    0, 100, 1, 'skill', ['rugby_league'],
    'rl_goal_kick_makes / rl_goal_kick_attempts * 100'),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — Rugby Union
  // ─────────────────────────────────────────────────────────────────
  m('ru_tackle_attempts',       'Tackle attempts',              'count','unit',['unit'],   0, 60,  0, 'skill', ['rugby_union']),
  m('ru_tackle_completed',      'Tackles completed',            'count','unit',['unit'],   0, 60,  0, 'skill', ['rugby_union']),
  m('ru_tackle_pct',            'Tackle completion %',          'percentage','%',['%'],    0, 100, 1, 'skill', ['rugby_union'],
    'ru_tackle_completed / ru_tackle_attempts * 100'),
  m('ru_lineout_wins',          'Lineouts won',                 'count','unit',['unit'],   0, 30,  0, 'skill', ['rugby_union']),
  m('ru_scrum_wins',            'Scrums won',                   'count','unit',['unit'],   0, 25,  0, 'skill', ['rugby_union']),
  m('ru_goal_kick_attempts',    'Goal kick attempts',           'count','unit',['unit'],   0, 15,  0, 'skill', ['rugby_union']),
  m('ru_goal_kick_makes',       'Goal kicks made',              'count','unit',['unit'],   0, 15,  0, 'skill', ['rugby_union']),
  m('ru_goal_kick_pct',         'Goal kick %',                  'percentage','%',['%'],    0, 100, 1, 'skill', ['rugby_union'],
    'ru_goal_kick_makes / ru_goal_kick_attempts * 100'),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — AFL
  // ─────────────────────────────────────────────────────────────────
  m('afl_disposals',            'Disposals',                    'count','unit',['unit'],   0, 50,  0, 'skill', ['afl']),
  m('afl_kicks',                'Kicks',                        'count','unit',['unit'],   0, 30,  0, 'skill', ['afl']),
  m('afl_handballs',            'Handballs',                    'count','unit',['unit'],   0, 30,  0, 'skill', ['afl']),
  m('afl_marks',                'Marks',                        'count','unit',['unit'],   0, 20,  0, 'skill', ['afl']),
  m('afl_tackles',              'Tackles',                      'count','unit',['unit'],   0, 20,  0, 'skill', ['afl']),
  m('afl_goal_attempts',        'Set-shot goal attempts',       'count','unit',['unit'],   0, 15,  0, 'skill', ['afl']),
  m('afl_goal_makes',           'Set-shot goals made',          'count','unit',['unit'],   0, 15,  0, 'skill', ['afl']),
  m('afl_goal_pct',             'Set-shot goal %',              'percentage','%',['%'],    0, 100, 1, 'skill', ['afl'],
    'afl_goal_makes / afl_goal_attempts * 100'),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — Tennis
  // ─────────────────────────────────────────────────────────────────
  m('tennis_serve_speed',       'Serve speed',                  'speed','m/s',['km/h','mph','m/s'], 20, 80, 1, 'skill', ['tennis']),
  m('tennis_first_serve_in',    'First serves in',              'count','unit',['unit'],   0, 200, 0, 'skill', ['tennis']),
  m('tennis_first_serve_attempts','First serve attempts',       'count','unit',['unit'],   0, 200, 0, 'skill', ['tennis']),
  m('tennis_first_serve_pct',   'First serve %',                'percentage','%',['%'],    0, 100, 1, 'skill', ['tennis'],
    'tennis_first_serve_in / tennis_first_serve_attempts * 100'),
  m('tennis_aces',              'Aces',                         'count','unit',['unit'],   0, 50,  0, 'skill', ['tennis']),
  m('tennis_double_faults',     'Double faults',                'count','unit',['unit'],   0, 30,  0, 'skill', ['tennis']),
  m('tennis_winners',           'Winners',                      'count','unit',['unit'],   0, 100, 0, 'skill', ['tennis']),
  m('tennis_unforced_errors',   'Unforced errors',              'count','unit',['unit'],   0, 100, 0, 'skill', ['tennis']),

  // ─────────────────────────────────────────────────────────────────
  // SKILL — Volleyball
  // ─────────────────────────────────────────────────────────────────
  m('vb_serve_speed',           'Serve speed',                  'speed','m/s',['km/h','mph','m/s'], 10, 50, 1, 'skill', ['volleyball']),
  m('vb_attack_attempts',       'Attack attempts',              'count','unit',['unit'],   0, 50,  0, 'skill', ['volleyball']),
  m('vb_attack_kills',          'Kills',                        'count','unit',['unit'],   0, 30,  0, 'skill', ['volleyball']),
  m('vb_attack_pct',            'Attack efficiency %',          'percentage','%',['%'],   -100, 100, 1, 'skill', ['volleyball'],
    'vb_attack_kills / vb_attack_attempts * 100'),
  m('vb_blocks',                'Blocks',                       'count','unit',['unit'],   0, 20,  0, 'skill', ['volleyball']),
  m('vb_digs',                  'Digs',                         'count','unit',['unit'],   0, 50,  0, 'skill', ['volleyball']),
  m('vb_aces',                  'Service aces',                 'count','unit',['unit'],   0, 20,  0, 'skill', ['volleyball']),

  // ─────────────────────────────────────────────────────────────────
  // COMBAT — Boxing
  // ─────────────────────────────────────────────────────────────────
  m('boxing_punches_thrown',    'Punches thrown',               'count','unit',['unit'],   0, 1000,0, 'combat', ['boxing']),
  m('boxing_punches_landed',    'Punches landed',               'count','unit',['unit'],   0, 1000,0, 'combat', ['boxing']),
  m('boxing_punch_accuracy_pct','Punch accuracy %',             'percentage','%',['%'],    0, 100, 1, 'combat', ['boxing'],
    'boxing_punches_landed / boxing_punches_thrown * 100'),
  m('boxing_punches_per_min',   'Punches per minute',           'frequency','Hz',['bpm'],  0, 5,   0, 'combat', ['boxing']),
  m('boxing_sparring_rounds',   'Sparring rounds completed',    'count','unit',['unit'],   0, 30,  0, 'combat', ['boxing']),
  m('boxing_reaction_time',     'Pad reaction time',            'time','s',  ['ms','s'],   0.1, 1.0,3, 'combat', ['boxing']),
  m('boxing_jab_speed',         'Jab speed',                    'speed','m/s',['m/s'],     2, 12,  1, 'combat', ['boxing']),
  m('boxing_cross_speed',       'Cross speed',                  'speed','m/s',['m/s'],     2, 13,  1, 'combat', ['boxing']),
  m('boxing_round_time',        'Round time',                   'time','s',  ['s','min'],  60, 240,0, 'combat', ['boxing']),

  // ─────────────────────────────────────────────────────────────────
  // ATHLETICS — Throws & Jumps (event-specific)
  // ─────────────────────────────────────────────────────────────────
  m('high_jump_height',         'High jump height',             'length','m',['m','cm'],   1.0, 2.5, 2, 'jumps', ['athletics_jumps']),
  m('long_jump_distance',       'Long jump distance',           'length','m',['m','cm'],   3.0, 9.0, 2, 'jumps', ['athletics_jumps']),
  m('triple_jump_distance',     'Triple jump distance',         'length','m',['m','cm'],   6.0, 19, 2, 'jumps', ['athletics_jumps']),
  m('pole_vault_height',        'Pole vault height',            'length','m',['m','cm'],   1.0, 6.5, 2, 'jumps', ['athletics_jumps']),
  m('shot_put_distance',        'Shot put distance',            'length','m',['m'],        4, 25,  2, 'skill', ['athletics_throws']),
  m('discus_distance',          'Discus throw distance',        'length','m',['m'],        10, 75, 2, 'skill', ['athletics_throws']),
  m('javelin_distance',         'Javelin distance',             'length','m',['m'],        10, 100,2, 'skill', ['athletics_throws']),
  m('hammer_distance',          'Hammer throw distance',        'length','m',['m'],        10, 90, 2, 'skill', ['athletics_throws']),

  // ─────────────────────────────────────────────────────────────────
  // DERIVED / CROSS-DOMAIN
  // ─────────────────────────────────────────────────────────────────
  m('cmj_force_to_bw',          'CMJ peak force-to-bodyweight', 'ratio','',  [''],         0, 6,  2, 'derived', ALL,
    'cmj_peak_force / (body_mass * 9.80665)'),
  m('hr_recovery_60s',          'HR recovery (60s post-effort)','frequency','Hz',['bpm'], 0.1, 2.0, 0, 'endurance', ALL),
];

const out = {
  version: 1,
  items,
};

if (require.main === module) {
  // Sanity-check: keys unique + match contract rule (snake_case, no leading digit)
  const KEY_RE = /^[a-z][a-z0-9_]*$/;
  const seen = new Set();
  for (const it of items) {
    if (!KEY_RE.test(it.key)) {
      console.error(`BAD KEY (must be snake_case, no leading digit): ${it.key}`);
      process.exit(1);
    }
    if (seen.has(it.key)) {
      console.error(`DUPLICATE KEY: ${it.key}`);
      process.exit(1);
    }
    seen.add(it.key);
  }

  // Sanity-check: formulas reference real keys
  for (const it of items) {
    if (!it.formula) continue;
    const refs = (it.formula.match(/[a-z_][a-z0-9_]*/g) || []).filter(
      tok => !['min','max','abs'].includes(tok)
    );
    for (const ref of refs) {
      if (!seen.has(ref) && !items.some(x => x.key === ref)) {
        console.error(`UNKNOWN FORMULA REF in ${it.key}: ${ref}`);
        process.exit(1);
      }
    }
  }

  console.log(JSON.stringify(out, null, 2));
  console.error(`✓ Emitted ${items.length} metrics, all keys unique, all formula refs valid.`);
}

module.exports = out;
