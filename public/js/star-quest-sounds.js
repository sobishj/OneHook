// Star Quest — sound + speech helpers for Kid Mode. Web Audio API for
// simple chimes (no audio files needed), Web Speech API for TTS. Respects
// prefers-reduced-motion by exposing a flag other modules can check.
// All audio (chimes and speech) can be muted by the kid/parent; the
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
    if (!enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
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

  scratchTick() {
    if (!sqSoundEnabled()) return;
    sqPlayTone(200 + Math.random() * 100, 0.04, 0, 0.05);
  },

  speak(text) {
    if (!sqSoundEnabled() || !text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.1;
    window.speechSynthesis.speak(utter);
  }
};

window.SqSounds = SqSounds;
