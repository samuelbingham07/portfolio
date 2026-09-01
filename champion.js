// Shared UI sound for the champion-select redesign.
// Fully synthesized, original sound design via Web Audio (no audio files,
// no third-party assets) — layered bell partials plus a filtered noise
// "sparkle" for the lock-in chime, a lighter two-partial pluck for hover/
// blip. Muted by default; preference persists in localStorage.
(function () {
  var STORAGE_KEY = 'champ-sound-on';
  var ctx = null;
  var lastPlay = 0;
  var noiseBuffer = null;

  function isOn() {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
    catch (e) { return false; }
  }

  function setOn(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false'); } catch (e) {}
    var buttons = document.querySelectorAll('[data-champ-sound-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      buttons[i].textContent = on ? '♪ Sound On' : '♪ Sound Off';
    }
  }

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function getNoiseBuffer(audioCtx) {
    if (noiseBuffer) return noiseBuffer;
    var len = Math.floor(audioCtx.sampleRate * 0.08);
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function withAudio(startDelay, fn) {
    if (!isOn()) return;
    var now = performance.now();
    if (now - lastPlay < 45) return;
    lastPlay = now;
    var audioCtx = ensureCtx();
    if (!audioCtx) return;
    var t0 = audioCtx.currentTime + (startDelay || 0);
    fn(audioCtx, t0);
  }

  // A single decaying sine partial with its own attack/decay envelope.
  function partial(audioCtx, freq, t0, duration, peakGain, attack) {
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peakGain, t0 + (attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // A short bandpass-filtered noise burst for the initial "sparkle".
  function sparkle(audioCtx, t0, duration, peakGain, filterFreq) {
    var src = audioCtx.createBufferSource();
    src.buffer = getNoiseBuffer(audioCtx);
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(peakGain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(audioCtx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  // Bell-like chime: inharmonic partials at classic additive-synthesis
  // bell ratios, each decaying at its own rate, plus a bright sparkle
  // transient on the attack. This is a generic, decades-old synthesis
  // technique — not a reproduction of any specific existing sound.
  function bell(freq, duration, peakGain, startDelay) {
    withAudio(startDelay, function (audioCtx, t0) {
      var ratios = [1, 2.756, 5.404, 8.933];
      var gains = [1, 0.5, 0.28, 0.14];
      for (var i = 0; i < ratios.length; i++) {
        var partialDuration = duration / (1 + i * 0.55);
        partial(audioCtx, freq * ratios[i], t0, partialDuration, peakGain * gains[i], 0.004);
      }
      sparkle(audioCtx, t0, 0.05, peakGain * 0.5, freq * 4);
    });
  }

  // A lighter two-partial pluck for hover/tab-switch feedback.
  function pluck(freq, duration, peakGain, startDelay) {
    withAudio(startDelay, function (audioCtx, t0) {
      partial(audioCtx, freq, t0, duration, peakGain, 0.003);
      partial(audioCtx, freq * 1.5, t0, duration * 0.7, peakGain * 0.4, 0.003);
    });
  }

  var ChampAudio = {
    hover: function () { pluck(660, 0.1, 0.05); },
    select: function () { bell(440, 0.55, 0.09); },
    blip: function () { pluck(560, 0.08, 0.055); },
    isOn: isOn,
    setOn: setOn,
    toggle: function () { setOn(!isOn()); }
  };

  window.ChampAudio = ChampAudio;

  document.addEventListener('DOMContentLoaded', function () {
    setOn(isOn());
    var buttons = document.querySelectorAll('[data-champ-sound-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () { ChampAudio.toggle(); });
    }
  });
})();
