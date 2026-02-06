// =========================
// home.js (REWRITTEN CLEAN)
// - session guard
// - letter avatar
// - header + menu info
// - role panels
// - account dropdown
// - logout confirmation modal
// =========================

const SESSION_KEY = "esakay_session_v1";

// ---------- helpers ----------
function getSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = (value ?? "—");
}

function go(url){
  if(url) window.location.href = url;
}

function buildLetterAvatar(name){
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  document.querySelectorAll(".letterAvatar").forEach(el => {
    el.textContent = letter;
  });
}

// ---------- session guard ----------
const sess = getSession();
if(!sess){
  go("index.html");
}

// ---------- fill UI ----------
buildLetterAvatar(sess.username);

setText("headerName", sess.username || "User");
setText("uid", sess.uniqueId || "—");
setText("role", (sess.role || "passenger").toUpperCase());

// Menu info (if you have these ids)
setText("menuName", sess.username || "User");
setText("menuRole", (sess.role || "passenger").toUpperCase());
setText("menuId", sess.uniqueId || "—");

// Role panels
const role = sess.role || "passenger";
document.getElementById("passengerPanel")?.classList.toggle("hidden", role !== "passenger");
document.getElementById("driverPanel")?.classList.toggle("hidden", role !== "driver");
document.getElementById("adminPanel")?.classList.toggle("hidden", role !== "admin");

// Buttons navigation
document.querySelectorAll("[data-go]").forEach(btn=>{
  btn.addEventListener("click", () => go(btn.getAttribute("data-go")));
});

// ---------- account dropdown ----------
const acctBtn  = document.getElementById("acctBtn");
const acctMenu = document.getElementById("acctMenu");

function openAcct(){
  if(!acctMenu) return;
  acctMenu.classList.remove("hidden");
  acctBtn?.setAttribute("aria-expanded", "true");
}
function closeAcct(){
  if(!acctMenu) return;
  acctMenu.classList.add("hidden");
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

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  if(!acctMenu || acctMenu.classList.contains("hidden")) return;
  if(acctMenu.contains(e.target) || acctBtn?.contains(e.target)) return;
  closeAcct();
});

// Menu navigation buttons
document.querySelectorAll(".acctItem[data-go]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    closeAcct();
    go(btn.getAttribute("data-go"));
  });
});

// ---------- logout confirmation ----------
const logoutBtn     = document.getElementById("logoutBtn");
const logoutModal   = document.getElementById("logoutModal");
const cancelLogout  = document.getElementById("cancelLogout");
const confirmLogout = document.getElementById("confirmLogout");

function openLogoutConfirm(){
  closeAcct();
  logoutModal?.classList.remove("hidden");
}
function closeLogoutConfirm(){
  logoutModal?.classList.add("hidden");
}
function doLogout(){
  localStorage.removeItem(SESSION_KEY);
  go("index.html");
}

// Open confirm modal on logout click
logoutBtn?.addEventListener("click", openLogoutConfirm);

// Buttons inside modal
cancelLogout?.addEventListener("click", closeLogoutConfirm);
confirmLogout?.addEventListener("click", doLogout);
