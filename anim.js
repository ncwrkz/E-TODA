const wrap = document.getElementById("trikeWrap");
const smoke = document.getElementById("smoke");

let fast = false;

function makePuff(){
  const p = document.createElement("div");
  p.className = "puff";

  // random small variations
  const x = Math.random() * 8;
  const y = Math.random() * 6;
  p.style.left = `${x}px`;
  p.style.bottom = `${y}px`;
  p.style.opacity = `${0.35 + Math.random()*0.35}`;

  smoke.appendChild(p);
  setTimeout(()=> p.remove(), 950);
}

// smoke loop
let smokeTimer = setInterval(makePuff, 140);

// click to speed up / slow down
wrap.addEventListener("click", () => {
  fast = !fast;
  document.documentElement.style.setProperty("--speed", fast ? "3.2s" : "6s");

  // more smoke when fast
  clearInterval(smokeTimer);
  smokeTimer = setInterval(makePuff, fast ? 80 : 140);
});
