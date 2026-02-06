const SESSION_KEY = "esakay_session_v1";

function getSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value ?? "—";
}

function logout(){
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "index.html";
}

const sess = getSession();
if(!sess){
  window.location.href = "index.html";
}

buildLetterAvatar(sess.username);

function buildLetterAvatar(name){

  const letter = (name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  document.querySelectorAll(".letterAvatar").forEach(el=>{
    el.textContent = letter;
  });

}

// Fill header info safely
setText("headerName", sess.username || "User");
setText("uid", sess.uniqueId || "—");
setText("role", (sess.role || "passenger").toUpperCase());

// Role panels
const role = sess.role || "passenger";
document.getElementById("passengerPanel")?.classList.toggle("hidden", role !== "passenger");
document.getElementById("driverPanel")?.classList.toggle("hidden", role !== "driver");
document.getElementById("adminPanel")?.classList.toggle("hidden", role !== "admin");

// Buttons navigation
document.querySelectorAll("[data-go]").forEach(btn=>{
  btn.addEventListener("click", () => {
    window.location.href = btn.getAttribute("data-go");
  });
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", logout);


// ===== Account dropdown logic =====
const acctBtn  = document.getElementById("acctBtn");
const acctMenu = document.getElementById("acctMenu");

function openAcct(){
  acctMenu?.classList.remove("hidden");
  acctBtn?.setAttribute("aria-expanded", "true");
}
function closeAcct(){
  acctMenu?.classList.add("hidden");
  acctBtn?.setAttribute("aria-expanded", "false");
}
function toggleAcct(){
  if(!acctMenu) return;
  acctMenu.classList.contains("hidden") ? openAcct() : closeAcct();
}

acctBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleAcct();
});

// Close when clicking outside (menu only)
document.addEventListener("click", (e) => {
  if(!acctMenu || acctMenu.classList.contains("hidden")) return;
  if(acctMenu.contains(e.target) || acctBtn?.contains(e.target)) return;
  closeAcct();
});

// Navigate menu buttons
document.querySelectorAll(".acctItem[data-go]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const to = btn.getAttribute("data-go");
    if(to) window.location.href = to;
  });
});

// Fill menu info safely
function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value ?? "—";
}

setText("menuName", sess.username || "User");
setText("menuRole", (sess.role || "passenger").toUpperCase());
setText("menuId", sess.uniqueId || "—");

// Optional: set avatar if you store it later
// document.getElementById("acctAvatar").src = sess.avatar || "images/avatar.png";
// document.getElementById("menuAvatar").src = sess.avatar || "images/avatar.png";
