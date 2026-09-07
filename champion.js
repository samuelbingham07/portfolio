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

  // Ability bar: ARIA tabs pattern (tablist/tab/tabpanel), click + arrow-key
  // navigation, and the fade-swap transition. Centralized here so every
  // detail page gets identical, correct behavior from one place.
  function initAbilityBar() {
    var bar = document.getElementById('ability-bar');
    var panel = document.getElementById('ability-panel');
    if (!bar || !panel) return;

    function selectTab(btn) {
      if (!btn || btn.getAttribute('aria-selected') === 'true') return;
      var buttons = bar.querySelectorAll('.champ-ability-icon');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('is-active');
        buttons[i].setAttribute('aria-selected', 'false');
        buttons[i].setAttribute('tabindex', '-1');
      }
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      btn.setAttribute('tabindex', '0');
      ChampAudio.blip();
      var target = btn.dataset.target;
      panel.classList.add('is-swapping');
      setTimeout(function () {
        var items = document.querySelectorAll('.champ-ability-panel-item');
        for (var j = 0; j < items.length; j++) {
          items[j].classList.toggle('is-active', items[j].dataset.item === target);
        }
        panel.classList.remove('is-swapping');
      }, 130);
    }

    bar.addEventListener('click', function (e) {
      selectTab(e.target.closest('.champ-ability-icon'));
    });

    bar.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var buttons = Array.prototype.slice.call(bar.querySelectorAll('.champ-ability-icon'));
      var idx = buttons.indexOf(document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      var next = e.key === 'ArrowRight'
        ? (idx + 1) % buttons.length
        : (idx - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
      selectTab(buttons[next]);
    });
  }

  // Header parallax: the backdrop already drifts slowly (ken-burns); this
  // adds a pointer-follow tilt on top, via a CSS custom property so it
  // composites with the keyframe animation instead of fighting it.
  function initHeaderParallax() {
    var header = document.querySelector('.champ-header');
    var bg = header && header.querySelector('.champ-header-bg');
    if (!header || !bg) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return; // touch devices: no cursor to follow

    var maxShift = 14;
    header.addEventListener('mousemove', function (e) {
      var rect = header.getBoundingClientRect();
      var relX = (e.clientX - rect.left) / rect.width - 0.5;
      var relY = (e.clientY - rect.top) / rect.height - 0.5;
      bg.style.setProperty('--px', (relX * -maxShift).toFixed(1) + 'px');
      bg.style.setProperty('--py', (relY * -maxShift).toFixed(1) + 'px');
    });
    header.addEventListener('mouseleave', function () {
      bg.style.setProperty('--px', '0px');
      bg.style.setProperty('--py', '0px');
    });
  }

  // Match history: tracks which champions (projects) this visitor has
  // opened this session, via localStorage, and renders a "recently
  // viewed" strip on the roster page. Real, honest data about actual
  // browsing, not a fabricated stat.
  var HISTORY_KEY = 'champ-viewed';
  var HISTORY_MAX = 8;
  var PROJECTS = {
    'vt-epson': { href: 'project-epson.html', name: 'Epson', img: 'images/epsonThumbnail.png?v=2' },
    'vt-hiki': { href: 'project-hiki.html', name: 'Project HIKI', img: 'images/hikiThumbnail.png' },
    'vt-jpnla': { href: 'project-jpnla.html', name: 'JPNLAvintage', img: 'images/jpnlaThumbnail.png' },
    'vt-clicktionary': { href: 'project-clicktionary.html', name: 'Clicktionary', img: 'images/clicktionaryThumbnail.png' },
    'vt-paretopresents': { href: 'project-paretoPresents.html', name: 'Pareto Presents', img: 'images/paretoPresentsThumbnail.png' },
    'vt-5c2c': { href: 'project-5c2c.html', name: '5C2C', img: 'images/5C2CThumbnail.png' },
    'vt-mumei': { href: 'project-mumei.html', name: 'Mumei', img: 'images/mumeiThumbnail.png' },
    'vt-tellasketch': { href: 'side-project-tellASketch.html', name: 'Tell-A-Sketch', img: 'images/tellASketchThumbnail.png' },
    'vt-quickdraw': { href: 'side-project-quickDraw.html', name: 'QuickDraw', img: 'images/quickDrawThumbnail.png' },
    'vt-narrativegame': { href: 'side-project-narrativeGame.html', name: 'Narrative Game', img: 'images/narrativeGame3.png' },
    'vt-dancegame': { href: 'side-project-danceGame.html', name: 'Dance Game', img: 'images/danceGameThumbnail.png' },
    'vt-thevault': { href: 'side-project-theVault.html', name: 'TheVault.', img: 'images/theVaultThumbnail.png' },
    'vt-isoge': { href: 'side-project-racinggame.html', name: 'ISOGE 急げ', img: 'images/isogePhoto3.png' },
    'vt-rpg': { href: 'side-project-rpg.html', name: 'Whitcomb Manor', img: 'images/rpgThumbnail.png' },
    'vt-artgame': { href: 'side-project-artgame.html', name: 'Terms of Service', img: 'images/artgameThumbnail.png' },
    'vt-mlart': { href: 'side-project-mlArt.html', name: 'Machine Learning Art', img: 'images/mlArtThumbnail.png' },
    'vt-hobbies': { href: 'projects-hobbies.html', name: 'Hobbies', img: 'images/backpackingThumbnail.png' }
  };

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch (e) { return []; }
  }

  function recordView(key) {
    if (!PROJECTS[key]) return;
    var list = getHistory().filter(function (k) { return k !== key; });
    list.unshift(key);
    if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (e) {}
  }

  // On a detail page: record this page as viewed, keyed by its own
  // view-transition-name (already unique per project, no extra markup).
  function recordCurrentPage() {
    var header = document.querySelector('.champ-header');
    if (!header) return;
    var key = header.style.viewTransitionName;
    if (key) recordView(key);
  }

  // On the roster page: render the strip if there's any history.
  function renderHistoryStrip() {
    var strip = document.getElementById('champ-history');
    var itemsEl = document.getElementById('champ-history-items');
    if (!strip || !itemsEl) return;
    var list = getHistory().filter(function (k) { return PROJECTS[k]; });
    if (!list.length) return;
    itemsEl.innerHTML = '';
    list.forEach(function (key) {
      var p = PROJECTS[key];
      var a = document.createElement('a');
      a.className = 'champ-history-item';
      a.href = p.href;
      a.title = p.name;
      var img = document.createElement('img');
      img.src = p.img;
      img.alt = p.name;
      a.appendChild(img);
      itemsEl.appendChild(a);
    });
    strip.hidden = false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    setOn(isOn());
    var buttons = document.querySelectorAll('[data-champ-sound-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () { ChampAudio.toggle(); });
    }
    initAbilityBar();
    initHeaderParallax();
    recordCurrentPage();
    renderHistoryStrip();
  });
})();
