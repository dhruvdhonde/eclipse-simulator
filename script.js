const canvas = document.getElementById('skyCanvas');
const ctx = canvas.getContext('2d');
const curveCanvas = document.getElementById('curveCanvas');
const cctx = curveCanvas.getContext('2d');

let running = false, t = 0, speed = 1;
let mode = 'solar';
let impact = 0;
let moonDist = 1;
let fluxData = [];

function resetSim() {
  running = false; t = 0; fluxData = [];
  drawScene();
  drawCurve();
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width/2, cy = canvas.height/2;
  const sunR = 120, moonR = sunR * 0.95 / moonDist;
  const offset = (t * 2 - 1) * 300;
  const yImpact = impact * 200;

  // Sun
  const gradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, sunR);
  gradient.addColorStop(0, '#fff5c3');
  gradient.addColorStop(1, '#f9d342');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, sunR, 0, Math.PI*2);
  ctx.fill();

  // Moon / Earth shadow
  ctx.fillStyle = mode === 'solar' ? '#333' : '#111';
  ctx.beginPath();
  ctx.arc(cx + offset, cy + yImpact, moonR, 0, Math.PI*2);
  ctx.fill();

  // Calculate overlap
  const dx = offset, dy = yImpact;
  const d = Math.sqrt(dx*dx + dy*dy);
  let overlap = 0;
  if (d < sunR + moonR) {
    const r1 = sunR, r2 = moonR;
    const phi = 2 * Math.acos((d*d + r1*r1 - r2*r2)/(2*d*r1));
    const theta = 2 * Math.acos((d*d + r2*r2 - r1*r1)/(2*d*r2));
    const area1 = 0.5 * theta * r2*r2 - 0.5 * r2*r2 * Math.sin(theta);
    const area2 = 0.5 * phi * r1*r1 - 0.5 * r1*r1 * Math.sin(phi);
    overlap = area1 + area2;
  }
  const totalSun = Math.PI * sunR * sunR;
  const obscuration = overlap / totalSun;
  const flux = 1 - obscuration;
  fluxData.push({t, flux});
  drawCurve();
}

function drawCurve() {
  cctx.clearRect(0,0,curveCanvas.width,curveCanvas.height);
  cctx.beginPath();
  cctx.moveTo(0,curveCanvas.height);
  cctx.strokeStyle = '#f9d342';
  for(let i=0;i<fluxData.length;i++){
    const x = i/fluxData.length * curveCanvas.width;
    const y = curveCanvas.height*(1 - fluxData[i].flux);
    cctx.lineTo(x,y);
  }
  cctx.stroke();
  cctx.fillText('Flux vs Time', 20, 20);
}

function loop() {
  if(!running) return;
  t += 0.005 * speed;
  if (t >= 1) running = false;
  drawScene();
  requestAnimationFrame(loop);
}

// Controls
document.getElementById('startBtn').onclick = () => {running=true; loop();};
document.getElementById('pauseBtn').onclick = () => {running=false;};
document.getElementById('resetBtn').onclick = resetSim;

document.getElementById('mode').onchange = e => {mode = e.target.value; resetSim();};
document.getElementById('speed').oninput = e => speed = parseFloat(e.target.value);
document.getElementById('impact').oninput = e => impact = parseFloat(e.target.value);
document.getElementById('moonDist').oninput = e => moonDist = parseFloat(e.target.value);

document.getElementById('exportPNG').onclick = () => {
  const link = document.createElement('a');
  link.download = 'eclipse.png';
  link.href = canvas.toDataURL();
  link.click();
};

document.getElementById('exportCSV').onclick = () => {
  let csv = 'time,flux\n';
  fluxData.forEach(p => csv += `${p.t},${p.flux}\n`);
  const blob = new Blob([csv], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'flux_data.csv';
  a.click();
};

resetSim();
