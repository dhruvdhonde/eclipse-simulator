const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 500;
canvas.height = 300;

const curveCanvas = document.getElementById("curveCanvas");
const cctx = curveCanvas.getContext("2d");
curveCanvas.width = 500;
curveCanvas.height = 150;

const solarBtn = document.getElementById("solarBtn");
const lunarBtn = document.getElementById("lunarBtn");

let mode = "solar";
let t = 0;

solarBtn.onclick = () => {
  mode = "solar";
  solarBtn.classList.add("active");
  lunarBtn.classList.remove("active");
  t = 0;
};

lunarBtn.onclick = () => {
  mode = "lunar";
  lunarBtn.classList.add("active");
  solarBtn.classList.remove("active");
  t = 0;
};

function circleOverlap(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const part1 = r1 ** 2 * Math.acos((d ** 2 + r1 ** 2 - r2 ** 2) / (2 * d * r1));
  const part2 = r2 ** 2 * Math.acos((d ** 2 + r2 ** 2 - r1 ** 2) / (2 * d * r2));
  const part3 = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return part1 + part2 - part3;
}

function drawLightCurve(frac) {
  cctx.fillStyle = "#1f2833";
  cctx.fillRect(0, 0, curveCanvas.width, curveCanvas.height);
  cctx.fillStyle = "#66fcf1";
  cctx.fillRect(t % curveCanvas.width, (1 - frac) * curveCanvas.height, 2, 2);
}

function solarEclipse() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rSun = 80;
  const rMoon = 50;
  const d = 200 * Math.sin(t / 100) + 100;

  const xSun = 250;
  const ySun = 150;
  const xMoon = 250 + d - 100;
  const yMoon = 150;

  ctx.fillStyle = "yellow";
  ctx.beginPath();
  ctx.arc(xSun, ySun, rSun, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(xMoon, yMoon, rMoon, 0, 2 * Math.PI);
  ctx.fill();

  const overlap = circleOverlap(rSun, rMoon, Math.abs(xSun - xMoon));
  const frac = 1 - overlap / (Math.PI * rSun ** 2);
  drawLightCurve(frac);
}

function lunarEclipse() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rEarthShadow = 100;
  const rMoon = 30;
  const d = 250 * Math.sin(t / 120) + 250;

  const xShadow = 250;
  const yShadow = 150;
  const xMoon = 250 + d - 250;
  const yMoon = 150;

  const grad = ctx.createRadialGradient(xShadow, yShadow, 0, xShadow, yShadow, rEarthShadow);
  grad.addColorStop(0, "rgba(0,0,0,0.9)");
  grad.addColorStop(0.7, "rgba(255,0,0,0.3)");
  grad.addColorStop(1, "rgba(255,255,255,0.1)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(xShadow, yShadow, rEarthShadow, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = "#cfcfcf";
  ctx.beginPath();
  ctx.arc(xMoon, yMoon, rMoon, 0, 2 * Math.PI);
  ctx.fill();

  const overlap = circleOverlap(rEarthShadow, rMoon, Math.abs(xShadow - xMoon));
  const frac = 1 - overlap / (Math.PI * rMoon ** 2);
  drawLightCurve(frac);
}

function animate() {
  if (mode === "solar") solarEclipse();
  else lunarEclipse();
  t += 1.5;
  requestAnimationFrame(animate);
}

animate();
