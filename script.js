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
const statusText = document.getElementById("statusText");
const infoBox = document.getElementById("infoBox");

let mode = "solar";
let t = 0;

solarBtn.onclick = () => {
  mode = "solar";
  solarBtn.classList.add("active");
  lunarBtn.classList.remove("active");
  infoBox.innerHTML = "<p>In a <b>Solar Eclipse</b>, the Moon passes between the Sun and Earth, blocking sunlight partially or fully.</p>";
  statusText.textContent = "Simulating Solar Eclipse...";
  t = 0;
};

lunarBtn.onclick = () => {
  mode = "lunar";
  lunarBtn.classList.add("active");
  solarBtn.classList.remove("active");
  infoBox.innerHTML = "<p>In a <b>Lunar Eclipse</b>, the Earth moves between the Sun and Moon, casting a shadow on the Moon.</p>";
  statusText.textContent = "Simulating Lunar Eclipse...";
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
  cctx.fillStyle = "#fffef9";
  cctx.fillRect(0, 0, curveCanvas.width, curveCanvas.height);
  cctx.fillStyle = "#f6b100";
  cctx.fillRect(t % curveCanvas.width, (1 - frac) * curveCanvas.height, 3, 3);
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

  ctx.fillStyle = "#f6b100";
  ctx.beginPath();
  ctx.arc(xSun, ySun, rSun, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = "#555";
  ctx.beginPath();
  ctx.arc(xMoon, yMoon, rMoon, 0, 2 * Math.PI);
  ctx.fill();

  const overlap = circleOverlap(rSun, rMoon, Math.abs(xSun - xMoon));
  const frac = 1 - overlap / (Math.PI * rSun ** 2);
  drawLightCurve(frac);
}

function lunarEclipse() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rShadow = 100;
  const rMoon = 30;
  const d = 250 * Math.sin(t / 120) + 250;

  const xShadow = 250;
  const yShadow = 150;
  const xMoon = 250 + d - 250;
  const yMoon = 150;

  ctx.fillStyle = "#ddd";
  ctx.beginPath();
  ctx.arc(xShadow, yShadow, rShadow, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.arc(xMoon, yMoon, rMoon, 0, 2 * Math.PI);
  ctx.fill();

  const overlap = circleOverlap(rShadow, rMoon, Math.abs(xShadow - xMoon));
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
