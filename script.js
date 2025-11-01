const canvas = document.getElementById("eclipseCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 400;
canvas.height = 400;

let moonX = -150;
let animation;
let running = false;

function drawEclipse() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(200, 200, 100, 0, Math.PI * 2);
  ctx.fillStyle = "gold";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(moonX, 200, 60, 0, Math.PI * 2);
  ctx.fillStyle = "black";
  ctx.fill();

  moonX += 1.2;
  if (moonX > 550) moonX = -150;
}

function animate() {
  drawEclipse();
  animation = requestAnimationFrame(animate);
}

document.getElementById("startBtn").onclick = () => {
  if (!running) {
    running = true;
    animate();
  }
};

document.getElementById("pauseBtn").onclick = () => {
  cancelAnimationFrame(animation);
  running = false;
};
