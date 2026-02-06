// =========================
// home.js (FULL FIXED)
// - session guard
// - prevent back-to-login issue
// - pull missing uid from users storage
// - driver approval gate
// - role redirect buttons
// - account dropdown
// - logout confirmation modal
// =========================

const SESSION_KEY = "esakay_session_v1";
const USERS_KEY   = "esakay_users_v1";

// ---------- helpers ----------
function safeParse(v, fallback){
  try { return JSON.parse(v); } catch { return fallback; }
}
function getSession(){
  return safeParse(localStorage.getItem(SESSION_KEY) || "null", null);
}
function setSession(sess){
  localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
}
function getUsers(){
  return safeParse(localStorage.getItem(USERS_KEY) || "[]", []);
}
function go(url){
  if(url) window.location.href = url;
}
function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = (value ?? "—");
}
function buildLetterAvatar(name){
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  document.querySelectorAll(".letterAvatar").forEach(el => el.textContent = letter);
}
function buildDisplayName(u){
  const full = `${u?.fullName?.first || ""} ${u?.fullName?.last || ""}`.trim();
  return full || u?.email || u?.contact || u?.username || "User";
}

// ---------- FIX: Prevent back button returning to login cached ----------
(function preventBackToLoginCache(){
  // When user presses back and browser loads cached page
  window.addEventListener("pageshow", (e) => {
    if(e.persisted){
      // If session exists, keep them here; if not, send to login
      const sess = getSession();
      if(!sess) go("index.html");
    }
  });

  // Optional: replace history state so "Back" won't go to login panel
  // (works best if home.html opened after login)
  try{
    history.replaceState(null, "", window.location.href);
  }catch{}
})();

// ---------- session guard ----------
let sess = getSession();
if(!sess){
  go("index.html");
}

// ---------- ensure session has uniqueId + username (pull from users) ----------
(function enrichSession(){
  const users = getUsers();

  // Find user by uniqueId if present
  let me = null;
  if(sess.uniqueId){
    me = users.find(u => u.uniqueId === sess.uniqueId) || null;
  }

  // If no match, try by username/email/contact (displayName might be stored)
  if(!me){
    const key = String(sess.username || "").toLowerCase();
    me = users.find(u => {
      const n = buildDisplayName(u).toLowerCase();
      return n === key || (u.email || "").toLowerCase() === key || (u.contact || "") === sess.username;
    }) || null;
  }

  // If found, patch session
  if(me){
    const displayName = buildDisplayName(me);

    // If session missing uid, fill it
    if(!sess.uniqueId) sess.uniqueId = me.uniqueId;
    // If session username empty, fill it
    if(!sess.username) sess.username = displayName;
    // Ensure role sync
    if(me.role) sess.role = me.role;

    setSession(sess);
  }
})();

// ---------- driver approval gate ----------
(function driverGate(){
  const role = String(sess.role || "passenger").toLowerCase();
  if(role !== "driver") return;

  const me = getUsers().find(u => u.uniqueId === sess.uniqueId) || null;
  const status = (me?.driverStatus || "pending");

  if(status !== "approved"){
    // kick driver back to login with message (simple)
    alert(
      status === "rejected"
        ? "Your driver account was rejected. Please contact admin."
        : "Your driver account is pending admin approval."
    );
    localStorage.removeItem(SESSION_KEY);
    go("index.html");
  }
})();

// ---------- fill UI ----------
buildLetterAvatar(sess.username);

setText("headerName", sess.username || "User");
setText("uid", sess.uniqueId || "—");
setText("role", String(sess.role || "passenger").toUpperCase());

// Menu info
setText("menuName", sess.username || "User");
setText("menuRole", String(sess.role || "passenger").toUpperCase());
setText("menuId", sess.uniqueId || "—");

// Role panels (if you still show panels)
const role = String(sess.role || "passenger").toLowerCase();
document.getElementById("passengerPanel")?.classList.toggle("hidden", role !== "passenger");
document.getElementById("driverPanel")?.classList.toggle("hidden", role !== "driver");
document.getElementById("adminPanel")?.classList.toggle("hidden", role !== "admin");

// ---------- Buttons navigation (role auto routes too) ----------
document.querySelectorAll("[data-go]").forEach(btn=>{
  btn.addEventListener("click", () => go(btn.getAttribute("data-go")));
});

// Optional quick role routes (if you want auto buttons)
document.querySelectorAll("[data-role-go]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const r = btn.getAttribute("data-role-go");
    if(r === "admin") go("admin.html");
    else if(r === "driver") go("driver.html");
    else go("passenger.html");
  });
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

document.addEventListener("click", (e) => {
  if(!acctMenu || acctMenu.classList.contains("hidden")) return;
  if(acctMenu.contains(e.target) || acctBtn?.contains(e.target)) return;
  closeAcct();
});

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
  logoutModal?.setAttribute("aria-hidden", "false");
}
function closeLogoutConfirm(){
  logoutModal?.classList.add("hidden");
  logoutModal?.setAttribute("aria-hidden", "true");
}
function doLogout(){
  localStorage.removeItem(SESSION_KEY);
  go("index.html");
}

logoutBtn?.addEventListener("click", openLogoutConfirm);
cancelLogout?.addEventListener("click", closeLogoutConfirm);
confirmLogout?.addEventListener("click", doLogout);
