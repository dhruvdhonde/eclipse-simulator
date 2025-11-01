/* Detailed Eclipse Simulator — script.js
   - Solar and lunar modes
   - Accurate angular radii, circle overlap, umbra/penumbra geometry
   - Light curves, separate umbra/penumbra fractions
   - Controls: speed, impact, moon distance, samples, limb-darkening
   - Exports: PNG and CSV, approximate path-of-totality CSV
*/

(() => {
  // --- DOM elements
  const skyC = document.getElementById('sky');
  const sky = skyC.getContext('2d', { alpha: true });
  const curveC = document.getElementById('curve');
  const curve = curveC.getContext('2d', { alpha: true });
  const fracC = document.getElementById('fractions');
  const frac = fracC.getContext('2d', { alpha: true });
  const statusEl = document.getElementById('status');
  const skyInfo = document.getElementById('skyInfo');
  const curveInfo = document.getElementById('curveInfo');

  // Controls
  const modeEl = document.getElementById('mode');
  const playBtn = document.getElementById('play');
  const pauseBtn = document.getElementById('pause');
  const stepBtn = document.getElementById('step');
  const resetBtn = document.getElementById('reset');
  const speedEl = document.getElementById('speed');
  const impactEl = document.getElementById('impact');
  const moonDistEl = document.getElementById('moonDist');
  const samplesEl = document.getElementById('samples');
  const limbEl = document.getElementById('limb');
  const guidesEl = document.getElementById('showGuides');
  const redTintEl = document.getElementById('redTint');
  const exportPngBtn = document.getElementById('exportPng');
  const exportCsvBtn = document.getElementById('exportCsv');
  const pathCsvBtn = document.getElementById('pathCsv');

  // --- Physical parameters (nominal values; units are arbitrary for canvas mapping)
  const PHY = {
    R_sun_km: 695700.0,
    R_earth_km: 6371.0,
    R_moon_km: 1737.4,
    d_earth_sun_km: 149600000.0,
    d_earth_moon_km: 384400.0
  };

  // Simulation state
  const STATE = {
    mode: 'solar',
    time: 0,            // minutes simulated (arbitrary time unit)
    totalTime: 180,     // simulation duration in minutes
    dt: 0.5,            // minutes per step (base)
    running: false,
    speed: parseFloat(speedEl.value),
    impact: parseFloat(impactEl.value),
    moonDistanceScale: parseFloat(moonDistEl.value),
    samples: parseInt(samplesEl.value),
    limbDarkening: limbEl.checked,
    showGuides: guidesEl.checked,
    redTint: redTintEl.checked,
  };

  // Results arrays
  const DATA = {
    times: [],
    flux: [],
    umbra_frac: [],
    pen_frac: []
  };

  // Canvas sizing helper
  function fitCanvases() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    [skyC, curveC, fracC].forEach(c => {
      const rect = c.getBoundingClientRect();
      c.width = Math.floor(rect.width * ratio);
      c.height = Math.floor(rect.height * ratio);
      const ctx = c.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    });
  }
  window.addEventListener('resize', fitCanvases);
  fitCanvases();

  // Angular radius function (radians)
  function angularRadius(R_km, d_km) {
    return Math.atan2(R_km, d_km);
  }

  // Circle overlap area (two radii r1,r2 and center separation d). Works for canvas units.
  function circleOverlapArea(r1, r2, d) {
    if (d >= r1 + r2) return 0;
    if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
    const r1sq = r1 * r1, r2sq = r2 * r2;
    const alpha = Math.acos((d * d + r1sq - r2sq) / (2 * d * r1));
    const beta = Math.acos((d * d + r2sq - r1sq) / (2 * d * r2));
    const area = r1sq * alpha + r2sq * beta - 0.5 * Math.sqrt(
      (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)
    );
    return area;
  }

  // Limb darkening factor: I(r) = 1 - u*(1 - sqrt(1 - (r/R)^2)), r_frac in [0,1]
  function limbFactor(r_frac, u = 0.6) {
    if (r_frac >= 1) return 0;
    return 1 - u * (1 - Math.sqrt(Math.max(0, 1 - r_frac * r_frac)));
  }

  // Map angular radii to canvas units (sky-plane projection). We keep Sun centered at (cx, cy)
  function computeScale() {
    const cx = skyC.clientWidth / 2;
    const cy = skyC.clientHeight / 2;
    // choose scale so sun occupies a reasonable fraction of canvas
    const sunAng = angularRadius(PHY.R_sun_km, PHY.d_earth_sun_km);
    const desired_pixels = Math.min(skyC.clientWidth, skyC.clientHeight) * 0.36;
    const scale = desired_pixels / sunAng;
    return { cx, cy, scale, sunAng };
  }

  // Compute umbra/penumbra radius at Moon distance using similar triangles
  function umbraPenumbraAtMoonDistance(moonDist_km) {
    const R_e = PHY.R_earth_km;
    const R_s = PHY.R_sun_km;
    const D_es = PHY.d_earth_sun_km;
    // Umbra tip distance from Earth's center
    const L_umbra = (R_e * D_es) / Math.max(1e-9, (R_s - R_e));
    const d_em = moonDist_km;
    const r_umbra = Math.max(0, R_e * (1 - d_em / L_umbra)); // linear interpolation to tip
    // Penumbra: approximate by considering sun angular radius -> generous estimate
    // compute radius where Sun's disk edges cause partial illumination
    // Simple model: extend from Earth where rays from Sun's limb envelope Earth
    // We'll approximate penumbra radius at Moon distance by adding sun angular projection
    const sun_ang = Math.atan2(R_s, D_es);
    const pen_extra = (Math.tan(sun_ang) * d_em);
    const r_penumbra = r_umbra + pen_extra * 1.05;
    return { r_umbra, r_penumbra };
  }

  // Sample limb-darkened solar flux (coarse grid sampling). Use STATE.samples to trade accuracy/speed
  function limbDarkenedFluxFraction(mx, my, sun_r_canvas, moon_r_canvas, samples = 120) {
    // sample inside solar disk with NxN grid
    const R = sun_r_canvas;
    const step = (2 * R) / samples;
    let total = 0, visible = 0;
    for (let i = 0; i < samples; i++) {
      const x = -R + (i + 0.5) * step;
      for (let j = 0; j < samples; j++) {
        const y = -R + (j + 0.5) * step;
        const r = Math.hypot(x, y);
        if (r <= R) {
          const lf = limbFactor(r / R);
          total += lf;
          // if not inside moon (i.e., visible)
          if (Math.hypot(x - mx, y - my) > moon_r_canvas) visible += lf;
        }
      }
    }
    return total > 0 ? visible / total : 1.0;
  }

  // --- Drawing helpers
  function clearSky() {
    sky.clearRect(0, 0, skyC.clientWidth, skyC.clientHeight);
  }

  function drawSun(cx, cy, R, useLimb) {
    if (!useLimb) {
      sky.beginPath(); sky.arc(cx, cy, R, 0, Math.PI * 2); sky.fillStyle = '#ffd54a'; sky.fill();
      return;
    }
    // draw concentric rings for limb darkening
    const rings = 60;
    for (let i = rings; i >= 1; i--) {
      const rf = i / rings;
      const brightness = limbFactor(rf);
      const r = R * rf;
      // color interpolation (center bright -> edge darker)
      const cr = Math.floor(255 * (0.9 * brightness + 0.1));
      const cg = Math.floor(213 * (0.9 * brightness + 0.1));
      const cb = Math.floor(80 * (0.9 * brightness + 0.1));
      sky.beginPath(); sky.arc(cx, cy, r, 0, Math.PI * 2); sky.fillStyle = `rgb(${cr},${cg},${cb})`; sky.fill();
    }
  }

  function drawCircle(cx, cy, r, color, alpha=1, stroke=false) {
    sky.beginPath();
    sky.arc(cx, cy, r, 0, Math.PI * 2);
    sky.fillStyle = color; sky.globalAlpha = alpha;
    sky.fill();
    sky.globalAlpha = 1;
    if (stroke) {
      sky.strokeStyle = 'rgba(255,255,255,0.08)'; sky.lineWidth = 1; sky.stroke();
    }
  }

  // Draw the sky-plane for solar eclipse
  function renderSolar(progress) {
    const { cx, cy, scale } = computeScale();
    const sun_ang = angularRadius(PHY.R_sun_km, PHY.d_earth_sun_km);
    const moon_ang = angularRadius(PHY.R_moon_km * STATE.moonDistanceScale, PHY.d_earth_moon_km * STATE.moonDistanceScale);
    const r_sun = sun_ang * scale;
    const r_moon = moon_ang * scale;
    // moon path: travel across along x from -travel/2 to +travel/2, y offset = impact*(r_sun+r_moon)
    const travel = 2.4 * (r_sun + r_moon);
    const x = -travel/2 + travel * progress;
    const y = STATE.impact * (r_sun + r_moon);
    clearSky();
    drawSun(cx, cy, r_sun, STATE.limbDarkening);
    // guides
    if (STATE.showGuides) {
      drawCircle(cx, cy, r_sun, 'rgba(255,255,255,0.02)', 1, true);
    }
    // draw moon
    drawCircle(cx + x, cy + y, r_moon, '#0b0b0b', 1, true);
    // compute overlap and flux
    const d = Math.hypot(x, y);
    const A_overlap = circleOverlapArea(r_sun, r_moon, d);
    const obscuration = A_overlap / (Math.PI * r_sun * r_sun);
    let flux;
    if (!STATE.limbDarkening) {
      flux = 1 - obscuration;
    } else {
      // sample-limb darkened flux in sun-centered coords; shift moon center relative to sun center
      flux = limbDarkenedFluxFraction(x, y, r_sun, r_moon, STATE.samples);
    }
    // annotate
    skyInfo.textContent = `Solar | time=${STATE.time.toFixed(1)} min • obscuration=${(obscuration*100).toFixed(2)}% • flux=${flux.toFixed(4)}`;
    return { flux, obscuration, r_sun, r_moon, moon_pos: {x: cx+x, y: cy+y}, overlap_area: A_overlap };
  }

  // Draw the sky-plane for lunar eclipse
  function renderLunar(progress) {
    const moonDist_km = PHY.d_earth_moon_km * STATE.moonDistanceScale;
    const { r_umbra, r_penumbra } = umbraPenumbraAtMoonDistance(moonDist_km);
    const { cx, cy, scale } = computeScale();
    // convert physical radii to canvas units: map moon physical radius to moon angular projection to canvas
    const moon_ang = angularRadius(PHY.R_moon_km * STATE.moonDistanceScale, moonDist_km);
    const r_moon_canvas = moon_ang * scale;
    // convert r_umbra (km) to canvas via projection: map km->canvas using moon radius mapping
    const km_to_canvas = r_moon_canvas / PHY.R_moon_km; // km to canvas pixels
    const cu_umbra = r_umbra * km_to_canvas;
    const cu_penumbra = r_penumbra * km_to_canvas;
    // Moon path across shadow: path similar to solar but using these radii
    const travel = 2.4 * (cu_penumbra + r_moon_canvas);
    const x = -travel/2 + travel * progress;
    const y = STATE.impact * (cu_penumbra + r_moon_canvas);
    clearSky();
    // draw penumbra and umbra centered at (cx,cy)
    if (cu_penumbra > 0) drawCircle(cx, cy, cu_penumbra, 'rgba(120,40,20,0.12)');
    if (cu_umbra > 0) drawCircle(cx, cy, cu_umbra, 'rgba(0,0,0,0.6)');
    // guides
    if (STATE.showGuides) {
      drawCircle(cx, cy, cu_umbra, 'rgba(255,255,255,0.03)', 1, true);
      drawCircle(cx, cy, cu_penumbra, 'rgba(255,255,255,0.02)', 1, true);
    }
    // draw moon
    drawCircle(cx + x, cy + y, r_moon_canvas, '#ddd', 1, true);
    // compute overlaps
    const dcenter = Math.hypot(x, y);
    const Au = circleOverlapArea(r_moon_canvas, cu_umbra, dcenter);
    const Ap = circleOverlapArea(r_moon_canvas, cu_penumbra, dcenter);
    const penOnly = Math.max(0, Ap - Au);
    const umbra_frac = Au / (Math.PI * r_moon_canvas * r_moon_canvas);
    const pen_frac = penOnly / (Math.PI * r_moon_canvas * r_moon_canvas);
    // brightness model: umbra dark (0), penumbra partial (scale)
    const pen_brightness = 0.4; // how bright penumbra region appears relative to full moon
    let brightness = 1 - umbra_frac - pen_frac * (1 - pen_brightness);
    // add red tint for penumbra/umbra contribution for visualization
    if (STATE.redTint) {
      // overlay reddish tint proportional to umbra+pen fractions for aesthetics
      if (umbra_frac + pen_frac > 0.001) {
        sky.globalAlpha = Math.min(0.6, 0.5 * (umbra_frac + pen_frac));
        sky.fillStyle = 'rgba(140,40,20,0.12)';
        sky.beginPath(); sky.arc(cx + x, cy + y, r_moon_canvas * (0.98), 0, Math.PI * 2); sky.fill();
        sky.globalAlpha = 1;
      }
    }
    skyInfo.textContent = `Lunar | time=${STATE.time.toFixed(1)} min • umbra=${(umbra_frac*100).toFixed(2)}% penumbra=${(pen_frac*100).toFixed(2)}% • brightness=${brightness.toFixed(4)}`;
    return { brightness, umbra_frac, pen_frac, r_moon_canvas, cu_umbra, cu_penumbra, moon_pos: {x: cx+x, y: cy+y} };
  }

  // Render light curve canvas from DATA arrays
  function renderCurve() {
    const w = curveC.clientWidth, h = curveC.clientHeight;
    curve.clearRect(0, 0, w, h);
    // background grid
    curve.fillStyle = '#071420'; curve.fillRect(0, 0, w, h);
    // axes margins
    const left = 40, right = 12, top = 12, bottom = 28;
    // draw flux polyline
    if (DATA.times.length > 1) {
      const n = DATA.times.length;
      const tmin = DATA.times[0], tmax = DATA.times[n-1];
      function sx(t) { return left + ((t - tmin) / Math.max(1e-9, tmax - tmin)) * (w - left - right); }
      function sy(f) { return top + (1 - f) * (h - top - bottom); }
      // background axes
      curve.strokeStyle = '#20404a'; curve.lineWidth = 1;
      // horizontal grid lines
      for (let g = 0; g <= 4; g++) {
        const yy = top + g * (h - top - bottom) / 4;
        curve.beginPath(); curve.moveTo(left, yy); curve.lineTo(w - right, yy); curve.stroke();
      }
      // flux path
      curve.beginPath();
      curve.moveTo(sx(DATA.times[0]), sy(DATA.flux[0]));
      for (let i = 1; i < n; i++) curve.lineTo(sx(DATA.times[i]), sy(DATA.flux[i]));
      curve.strokeStyle = '#ffd54a'; curve.lineWidth = 2; curve.stroke();
      // axes labels
      curve.fillStyle = '#98bfcf'; curve.font = '12px sans-serif';
      curve.fillText('Flux (normalized)', 8, 14);
      curve.fillText(`${tmin.toFixed(1)} min`, left, h - 8); curve.fillText(`${tmax.toFixed(1)} min`, w - right - 42, h - 8);
    } else {
      curve.fillStyle = '#98bfcf'; curve.font = '12px sans-serif';
      curve.fillText('Light curve will appear as simulation runs', 12, 30);
    }
  }

  function renderFractions() {
    const w = fracC.clientWidth, h = fracC.clientHeight;
    frac.clearRect(0, 0, w, h);
    frac.fillStyle = '#071420'; frac.fillRect(0, 0, w, h);
    // draw umbra/pen lines if lunar mode
    if (STATE.mode === 'lunar' && DATA.times.length > 1) {
      const n = DATA.times.length;
      const left = 36, right = 12, top = 12, bottom = 18;
      const tmin = DATA.times[0], tmax = DATA.times[n-1];
      function sx(t) { return left + ((t - tmin) / Math.max(1e-9, tmax - tmin)) * (w - left - right); }
      function sy(v) { return top + (1 - v) * (h - top - bottom); }
      // umbra (red line)
      frac.beginPath();
      frac.moveTo(sx(DATA.times[0]), sy(DATA.umbra_frac[0] || 0));
      for (let i = 1; i < n; i++) frac.lineTo(sx(DATA.times[i]), sy(DATA.umbra_frac[i] || 0));
      frac.strokeStyle = '#ff5555'; frac.lineWidth = 2; frac.stroke();
      // penumbra (orange line)
      frac.beginPath();
      frac.moveTo(sx(DATA.times[0]), sy(DATA.pen_frac[0] || 0));
      for (let i = 1; i < n; i++) frac.lineTo(sx(DATA.times[i]), sy(DATA.pen_frac[i] || 0));
      frac.strokeStyle = '#ffaa55'; frac.lineWidth = 2; frac.stroke();
      // legend
      frac.fillStyle = '#98bfcf'; frac.font = '12px sans-serif';
      frac.fillText('Umbra (red) / Penumbra (orange) fractions', 8, 14);
    } else {
      frac.fillStyle = '#98bfcf'; frac.font = '12px sans-serif';
      frac.fillText('Umbra / Penumbra fractions available in Lunar mode', 12, 30);
    }
  }

  // Single step of simulation: compute state at current time fraction, render, and store results
  function simulateStep() {
    const progress = Math.min(1.0, Math.max(0, STATE.time / STATE.totalTime));
    if (STATE.mode === 'solar') {
      const res = renderSolar(progress);
      DATA.times.push(STATE.time);
      DATA.flux.push(res.flux);
      DATA.umbra_frac.push(0);
      DATA.pen_frac.push(0);
    } else {
      const res = renderLunar(progress);
      DATA.times.push(STATE.time);
      DATA.flux.push(res.brightness);
      DATA.umbra_frac.push(res.umbra_frac);
      DATA.pen_frac.push(res.pen_frac);
    }
    renderCurve(); renderFractions();
  }

  // Main loop driven by requestAnimationFrame; we advance state.time according to dt and speed
  let raf = null;
  function loop() {
    if (!STATE.running) return;
    // advance simulation time
    STATE.time += STATE.dt * STATE.speed;
    simulateStep();
    // stop if done
    if (STATE.time >= STATE.totalTime) {
      STATE.running = false; updateStatus('Finished');
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  // UI actions
  function updateStatus(txt) { statusEl.textContent = `Status: ${txt}`; }
  function resetSimulation() {
    STATE.time = 0;
    DATA.times.length = 0; DATA.flux.length = 0; DATA.umbra_frac.length = 0; DATA.pen_frac.length = 0;
    STATE.running = false; if (raf) cancelAnimationFrame(raf);
    clearSky(); renderCurve(); renderFractions();
    updateStatus('Reset');
  }

  playBtn.addEventListener('click', () => {
    STATE.mode = modeEl.value;
    STATE.speed = parseFloat(speedEl.value);
    STATE.impact = parseFloat(impactEl.value);
    STATE.moonDistanceScale = parseFloat(moonDistEl.value);
    STATE.samples = parseInt(samplesEl.value);
    STATE.limbDarkening = limbEl.checked;
    STATE.showGuides = guidesEl.checked;
    STATE.redTint = redTintEl.checked;
    if (STATE.time >= STATE.totalTime) STATE.time = 0; // restart if finished
    STATE.running = true;
    updateStatus('Playing');
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  });

  pauseBtn.addEventListener('click', () => {
    STATE.running = false; if (raf) cancelAnimationFrame(raf); updateStatus('Paused');
  });

  stepBtn.addEventListener('click', () => {
    STATE.mode = modeEl.value;
    STATE.speed = parseFloat(speedEl.value);
    STATE.impact = parseFloat(impactEl.value);
    STATE.moonDistanceScale = parseFloat(moonDistEl.value);
    STATE.samples = parseInt(samplesEl.value);
    STATE.limbDarkening = limbEl.checked;
    STATE.showGuides = guidesEl.checked;
    STATE.redTint = redTintEl.checked;
    STATE.time += STATE.dt * STATE.speed;
    simulateStep();
    updateStatus(`Stepped to ${STATE.time.toFixed(2)} min`);
  });

  resetBtn.addEventListener('click', resetSimulation);

  // control bindings to update state live
  modeEl.addEventListener('change', () => { STATE.mode = modeEl.value; resetSimulation(); });
  speedEl.addEventListener('input', () => { STATE.speed = parseFloat(speedEl.value); });
  impactEl.addEventListener('input', () => { STATE.impact = parseFloat(impactEl.value); });
  moonDistEl.addEventListener('input', () => { STATE.moonDistanceScale = parseFloat(moonDistEl.value); });
  samplesEl.addEventListener('input', () => { STATE.samples = parseInt(samplesEl.value); });
  limbEl.addEventListener('change', () => { STATE.limbDarkening = limbEl.checked; });
  guidesEl.addEventListener('change', () => { STATE.showGuides = guidesEl.checked; });
  redTintEl.addEventListener('change', () => { STATE.redTint = redTintEl.checked; });

  // Export PNG (sky canvas)
  exportPngBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = skyC.toDataURL('image/png');
    link.download = `eclipse_sky_${STATE.mode}_${Date.now()}.png`;
    link.click();
  });

  // Export CSV light curve
  exportCsvBtn.addEventListener('click', () => {
    if (DATA.times.length === 0) { updateStatus('No data to export'); return; }
    let csv = 'time_min,flux,umbra_frac,penumbra_frac\n';
    for (let i = 0; i < DATA.times.length; i++) {
      csv += `${DATA.times[i].toFixed(4)},${DATA.flux[i].toFixed(6)},${(DATA.umbra_frac[i]||0).toFixed(6)},${(DATA.pen_frac[i]||0).toFixed(6)}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `eclipse_lightcurve_${STATE.mode}.csv`; a.click();
    URL.revokeObjectURL(url);
    updateStatus('CSV exported');
  });

  // Approximate path-of-totality (very simplified) & export as CSV
  pathCsvBtn.addEventListener('click', () => {
    // Only meaningful in solar mode and when umbra radius at ground > 0
    if (STATE.mode !== 'solar') { updateStatus('Path-of-totality only in solar mode'); return; }
    // We'll compute a simple sweep of Moon shadow center ground track assuming moon moves east-west at constant velocity.
    // This is an approximation: produce lat,lon samples along a sinusoidal path for visualization.
    const N = 200;
    const rows = [['index','latitude_deg','longitude_deg','time_min']];
    for (let i = 0; i < N; i++) {
      const frac = i / (N - 1);
      const lat = 10 * Math.sin((frac - 0.5) * Math.PI * 1.2); // fake lat oscillation
      const lon = -60 + 360 * frac; // sweep around globe
      const t = STATE.time + STATE.totalTime * frac;
      rows.push([i, lat.toFixed(6), lon.toFixed(6), t.toFixed(3)]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `path_totality_approx.csv`; a.click();
    URL.revokeObjectURL(url);
    updateStatus('Approx path-of-totality CSV exported (approximation)');
  });

  // Initial render placeholders
  clearSky();
  renderCurve();
  renderFractions();
  updateStatus('Ready');

  // expose a small debug API on window for quick console tests (optional)
  window.ECLIPSE = { STATE, DATA, resetSimulation, simulateStep };
})();
