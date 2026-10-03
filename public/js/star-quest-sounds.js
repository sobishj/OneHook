// Star Quest — sound helpers for Kid Mode. Web Audio API for chimes and
// little music-box tunes (no audio files, no voice). Respects
// prefers-reduced-motion by exposing a flag other modules can check.
// All audio can be muted by the kid/parent; the
// preference persists across visits via localStorage.

const SQ_REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SQ_SOUND_KEY = 'sq_sound_enabled';

function sqSoundEnabled() {
  try {
    const v = localStorage.getItem(SQ_SOUND_KEY);
    return v === null ? true : v === '1';
  } catch (err) {
    return true;
  }
}

function sqSetSoundEnabled(enabled) {
  try { localStorage.setItem(SQ_SOUND_KEY, enabled ? '1' : '0'); } catch (err) { /* ignore */ }
}

let sqAudioCtx = null;
function getAudioCtx() {
  if (!sqAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    sqAudioCtx = new Ctx();
  }
  return sqAudioCtx;
}

function sqPlayTone(freq, duration, delay = 0, gainPeak = 0.15) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const startAt = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

// ---- Music: little music-box tunes (no voice, no audio files). A tune is
// a melody plus an optional bass line, each a list of [note, beats] with
// 'R' for a rest. Only one tune plays at a time — starting a new one
// fades out the last so they never pile up on top of each other. ----
const SQ_NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function sqNoteFreq(note) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  if (!m) return 0;
  const midi = (Number(m[3]) + 1) * 12 + SQ_NOTE_SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// One plucked music-box note: a triangle wave with a soft sine an octave
// up for sparkle, quick attack and a gentle ring-out.
function sqMusicBoxNote(ctx, out, freq, startAt, duration, volume) {
  [[freq, 'triangle', volume], [freq * 2, 'sine', volume * 0.25]].forEach(([f, type, vol]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    osc.connect(gain);
    gain.connect(out);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(vol, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + Math.max(0.25, duration * 1.6));
    osc.start(startAt);
    osc.stop(startAt + Math.max(0.25, duration * 1.6) + 0.05);
  });
}

let sqCurrentTuneOut = null;
function sqPlayTune(tune) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (sqCurrentTuneOut) {
    const old = sqCurrentTuneOut;
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => old.disconnect(), 400);
  }
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);
  sqCurrentTuneOut = out;

  const beat = 60 / tune.bpm;
  const t0 = ctx.currentTime + 0.05;
  [[tune.melody, 0.13], [tune.bass || [], 0.09]].forEach(([line, volume]) => {
    let t = t0;
    line.forEach(([note, beats]) => {
      if (note !== 'R') sqMusicBoxNote(ctx, out, sqNoteFreq(note), t, beats * beat, volume);
      t += beats * beat;
    });
  });
}

const SQ_TUNES = {
  // The prize is revealed — a bouncy four-bar song in C major (~6s).
  reward: {
    bpm: 150,
    melody: [
      ['C5', 0.5], ['E5', 0.5], ['G5', 0.5], ['C6', 0.5], ['B5', 0.5], ['C6', 0.5], ['G5', 1],
      ['A5', 0.5], ['G5', 0.5], ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['E5', 0.5], ['F5', 1],
      ['E5', 0.5], ['G5', 0.5], ['C6', 0.5], ['E6', 0.5], ['D6', 0.5], ['C6', 0.5], ['A5', 1],
      ['G5', 0.5], ['F5', 0.5], ['D5', 0.5], ['B4', 0.5], ['C5', 0.5], ['G5', 0.5], ['C6', 1]
    ],
    bass: [
      ['C3', 2], ['G2', 2], ['F2', 2], ['C3', 2],
      ['A2', 2], ['F2', 2], ['G2', 2], ['C3', 2]
    ]
  },
  // A gift is waiting / the scratch card opens — playful "ta-da!" (~2.5s).
  surprise: {
    bpm: 170,
    melody: [['G5', 0.5], ['C6', 0.5], ['E6', 0.5], ['G6', 1.5], ['R', 0.5], ['E6', 0.5], ['F6', 0.5], ['G6', 2]],
    bass: [['C3', 2], ['G2', 2], ['C3', 2]]
  },
  // Tapping an opened reward — tiny sparkle.
  twinkle: {
    bpm: 220,
    melody: [['E6', 0.5], ['G6', 0.5], ['C7', 1.5]]
  }
};

// A pool of distinct little jingles for "a star landed in the jar" — picked
// at random each drop so repeated drops don't all sound identical.
const SQ_DROP_CHIMES = [
  () => { sqPlayTone(880, 0.22, 0); sqPlayTone(1318.5, 0.28, 0.09); },
  () => { sqPlayTone(659.25, 0.15, 0); sqPlayTone(830.61, 0.15, 0.08); sqPlayTone(987.77, 0.22, 0.16); },
  () => { sqPlayTone(1046.5, 0.18, 0); sqPlayTone(1318.5, 0.18, 0.07); sqPlayTone(1568, 0.24, 0.14); },
  () => { sqPlayTone(420, 0.1, 0, 0.14); sqPlayTone(840, 0.2, 0.07); },
  () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => sqPlayTone(f, 0.16, i * 0.06)); },
  () => { sqPlayTone(1200, 0.08, 0, 0.12); sqPlayTone(1500, 0.08, 0.05, 0.12); sqPlayTone(1800, 0.16, 0.1); }
];

const SqSounds = {
  reducedMotion: SQ_REDUCED_MOTION,

  get enabled() {
    return sqSoundEnabled();
  },

  setEnabled(enabled) {
    sqSetSoundEnabled(enabled);
    if (!enabled && sqCurrentTuneOut && sqAudioCtx) sqCurrentTuneOut.gain.setTargetAtTime(0, sqAudioCtx.currentTime, 0.05);
  },

  chime() {
    if (!sqSoundEnabled()) return;
    sqPlayTone(880, 0.25, 0);
    sqPlayTone(1318.5, 0.3, 0.1);
  },

  // A different little jingle each time — see SQ_DROP_CHIMES.
  dropChime() {
    if (!sqSoundEnabled()) return;
    const jingle = SQ_DROP_CHIMES[Math.floor(Math.random() * SQ_DROP_CHIMES.length)];
    jingle();
  },

  celebrate() {
    if (!sqSoundEnabled()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => sqPlayTone(freq, 0.3, i * 0.09));
  },

  // Quick twinkly run up the scale — the Kid View jar-tap "magic" sound.
  magic() {
    if (!sqSoundEnabled()) return;
    [1046.5, 1318.5, 1568, 2093, 2637].forEach((freq, i) => sqPlayTone(freq, 0.12, i * 0.045, 0.12));
  },

  scratchTick() {
    if (!sqSoundEnabled()) return;
    sqPlayTone(200 + Math.random() * 100, 0.04, 0, 0.05);
  },

  // One of SQ_TUNES by name: 'reward', 'surprise' or 'twinkle'.
  music(name) {
    if (!sqSoundEnabled() || !SQ_TUNES[name]) return;
    sqPlayTune(SQ_TUNES[name]);
  }
};

window.SqSounds = SqSounds;
