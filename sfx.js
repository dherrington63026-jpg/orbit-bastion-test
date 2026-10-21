'use strict';
/* Orbit Bastion sound: everything is synthesized in the browser (no audio files, no fees). */
const SFX = (() => {
  const THEMES = [[[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]], [[146.8, 174.6, 220], [233.1, 293.7, 349.2], [174.6, 220, 261.6], [261.6, 329.6, 392]], [[164.8, 196, 246.9], [261.6, 329.6, 392], [196, 246.9, 293.7], [146.8, 185, 220]]];
  let theme = 0, bossOn = false, bossTimer = null, ac = null, master = null, musicGain = null, on = true, musicOn = true, last = {}, musicStarted = false;
  try { on = localStorage.getItem('orbitbastion_sfx') !== '0'; musicOn = localStorage.getItem('orbitbastion_music') !== '0'; } catch (e) {}
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = on ? .55 : 0;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
      master.connect(comp); comp.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = musicOn ? .5 : 0; musicGain.connect(master);
      startMusic();
    } catch (e) { ac = null; }
  }
  const noiseBuf = () => { if (noiseBuf.b) return noiseBuf.b; const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (noiseBuf.b = b); };
  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f0, f1, dur, peak, delay, dest) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, .005, dur, peak); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, peak, type, f0, f1, delay, q) {
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = noiseBuf(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    env(g, t, .004, dur, peak); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .05);
  }
  const SOUNDS = {
    pulse: () => { tone('sine', 260, 70, .32, .5); noise(.28, .14, 'bandpass', 2400, 400); },
    rail: () => { noise(.12, .5, 'highpass', 1500, 6000); tone('sawtooth', 1200, 90, .35, .28); tone('sine', 70, 40, .35, .5); },
    missile: () => { noise(.45, .22, 'bandpass', 500, 2600, 0, 2); tone('triangle', 140, 400, .4, .12); },
    boom: () => { noise(.55, .5, 'lowpass', 1800, 120); tone('sine', 110, 38, .5, .7); },
    flak: () => { noise(.14, .3, 'highpass', 2500, 7000); tone('square', 520, 180, .12, .12); },
    flakburst: () => { noise(.22, .3, 'bandpass', 1400, 500, 0, 3); },
    arc: () => { for (let i = 0; i < 4; i++) tone('sawtooth', 900 + Math.random() * 1500, 300, .06, .14, i * .03); noise(.2, .18, 'bandpass', 3000, 900, 0, 4); },
    cryo: () => { tone('sine', 1760, 1320, .5, .12); tone('sine', 2640, 2000, .4, .06, .05); },
    hit: () => { noise(.04, .1, 'highpass', 3000, 5000); },
    die: () => { noise(.2, .22, 'bandpass', 1200, 300, 0, 1.5); tone('sine', 180, 60, .18, .25); },
    bigdie: () => { noise(.7, .5, 'lowpass', 1600, 90); tone('sine', 90, 30, .7, .8); tone('sawtooth', 300, 40, .6, .2); },
    build: () => { tone('square', 330, 660, .12, .12); tone('square', 660, 990, .12, .1, .09); noise(.1, .08, 'highpass', 4000); },
    upgrade: () => { tone('triangle', 440, 440, .12, .2); tone('triangle', 660, 660, .12, .2, .1); tone('triangle', 880, 880, .22, .22, .2); },
    merge: () => { [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, .5, .18, i * .07)); noise(.5, .15, 'highpass', 3000, 8000, .2); },
    sell: () => { tone('square', 500, 250, .15, .12); },
    click: () => { tone('square', 700, 500, .04, .07); },
    wave: () => { tone('sawtooth', 110, 110, .7, .22); tone('sawtooth', 165, 165, .7, .18, .05); tone('sawtooth', 220, 220, .55, .12, .1); },
    warn: () => { for (let i = 0; i < 3; i++) { tone('square', 880, 880, .18, .2, i * .35); tone('square', 660, 660, .18, .2, i * .35 + .18); } },
    leak: () => { tone('sawtooth', 200, 50, .45, .4); noise(.35, .3, 'lowpass', 900, 100); },
    clear: () => { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, .3, .2, i * .09)); },
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, .5, .22, i * .12)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * .98, .5, .16, i * .2)); },
    strike: () => { tone('sawtooth', 2000, 60, .8, .3); noise(.9, .5, 'lowpass', 2500, 80, .35); tone('sine', 80, 30, .8, .8, .35); },
    freeze: () => { noise(.8, .25, 'highpass', 4000, 9000); tone('sine', 1400, 300, .8, .18); },
    boost: () => { tone('sawtooth', 200, 1200, .5, .22); tone('triangle', 600, 1800, .5, .12, .1); },
    repair: () => { tone('sine', 520, 780, .4, .2); tone('sine', 780, 1040, .4, .2, .15); },
    beam: () => { tone('sawtooth', 180, 220, .4, .07); tone('sine', 900, 1100, .35, .05); },
    gravity: () => { tone('sine', 90, 40, .9, .22); noise(.9, .07, 'lowpass', 400, 80); },
    roar: () => { tone('sawtooth', 60, 35, 1.6, .5); noise(1.5, .35, 'lowpass', 500, 60); tone('square', 90, 45, 1.2, .18, .1); },
    spawn: () => { tone('sine', 120, 480, .3, .12); },
    portal: () => { tone('sawtooth', 70, 140, .9, .13); noise(.9, .08, 'bandpass', 300, 1200); }
  };
  // minimum gap between the same sound (several towers firing at once should not turn into noise)
  const GAP = { pulse: .09, rail: .08, missile: .1, boom: .07, flak: .06, flakburst: .06, arc: .08, cryo: .5, hit: .05, die: .05, bigdie: .2, spawn: .12 };
  function play(name) {
    if (!ac || !on) return;
    const now = ac.currentTime, g = GAP[name] || 0;
    if (g && last[name] && now - last[name] < g) return; last[name] = now;
    try { SOUNDS[name] && SOUNDS[name](); } catch (e) {}
  }
  // calm generative pad: Am - F - C - G, slow filter drift
  function startMusic() {
    if (musicStarted || !ac) return; musicStarted = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = .7; lp.connect(musicGain);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .07; lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const bar = 8; let n = 0;
    function chord() {
      const t = ac.currentTime, c = THEMES[theme][n % 4]; n++;
      c.concat([c[0] / 2]).forEach((f, i) => {
        [-6, 6].forEach(det => { const o = ac.createOscillator(), g = ac.createGain(); o.type = i === 3 ? 'sine' : 'sawtooth'; o.frequency.value = f; o.detune.value = det;
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(i === 3 ? .09 : .035, t + 2.2); g.gain.linearRampToValueAtTime(0.0001, t + bar + .4);
          o.connect(g); g.connect(lp); o.start(t); o.stop(t + bar + .6); });
      });
      // soft pulse arpeggio
      c.forEach((f, i) => { for (let k = 0; k < 4; k++) { const tt = t + k * 2 + i * .5; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f * 2; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(.025, tt + .03); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.2); o.connect(g); g.connect(lp); o.start(tt); o.stop(tt + 1.3); } });
    }
    chord(); setInterval(chord, bar * 1000);
  }
  function bossBeat() {
    if (!ac || !bossOn || !musicOn) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .18);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .25); o.connect(g); g.connect(master); o.start(t); o.stop(t + .3);
    const b = ac.createOscillator(), bg = ac.createGain(); b.type = 'sawtooth'; b.frequency.value = THEMES[theme][0][0] / 2; bg.gain.setValueAtTime(.0001, t); bg.gain.exponentialRampToValueAtTime(.12, t + .02); bg.gain.exponentialRampToValueAtTime(.0001, t + .35);
    const lpf = ac.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 400; b.connect(lpf); lpf.connect(bg); bg.connect(master); b.start(t); b.stop(t + .4);
  }
  return {
    init, play,
    theme(n) { theme = Math.max(0, Math.min(THEMES.length - 1, n | 0)); },
    boss(on) { bossOn = on; if (on && !bossTimer) bossTimer = setInterval(bossBeat, 420); if (!on && bossTimer) { clearInterval(bossTimer); bossTimer = null; } },
    get on() { return on; }, get music() { return musicOn; },
    setOn(v) { on = v; try { localStorage.setItem('orbitbastion_sfx', v ? '1' : '0'); } catch (e) {} if (master) master.gain.value = v ? .55 : 0; },
    setMusic(v) { musicOn = v; try { localStorage.setItem('orbitbastion_music', v ? '1' : '0'); } catch (e) {} if (musicGain) musicGain.gain.value = v ? .5 : 0; }
  };
})();
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => SFX.init(), { once: false, passive: true }));
document.addEventListener('visibilitychange', () => { /* audio context resumes on next tap */ });
