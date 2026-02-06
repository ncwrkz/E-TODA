// =========================
// E-TODA Start.js (FIXED ALL-IN-ONE)
// Login + PDS Register + OTP + Safe Required Toggles
// =========================

// ===== Block access to login/register if already logged in =====
(function(){

  const SESSION_KEY = "esakay_session_v1";

  try{
    const sess = JSON.parse(localStorage.getItem(SESSION_KEY));

    if(sess){
      // Already logged in → send to homepage
      window.location.href = "home.html";
    }

  }catch(e){
    console.error("Session check failed", e);
  }

})();


const SESSION_KEY = "esakay_session_v1";
const USERS_KEY   = "esakay_users_v1";

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

function safeJSONParse(v, fallback) {
  try { return JSON.parse(v); } catch { return fallback; }
}

function getUsers(){
  return safeJSONParse(localStorage.getItem(USERS_KEY) || "[]", []);
}

function setUsers(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setSession(sess){
  localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
}

function redirectHome(){
  window.location.href = "home.html";
}

function genUniqueId(){
  return "ETODA-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random()*9999);
}

function setReq(id, required){
  const el = $(id);
  if(el) el.required = !!required;
}

function show(el){ if(el) el.classList.remove("hidden"); }
function hide(el){ if(el) el.classList.add("hidden"); }

function setMsg(text){
  const m = $("msg");
  if(m) m.textContent = text || "";
}

// ---------- elements ----------
const modal         = $("modal");
const modalTitle    = $("modalTitle");
const closeModalBtn = $("closeModal");

const loginPanel    = $("loginPanel");
const registerPanel = $("registerPanel");

const btnLogin      = $("btnLogin");     // Continue
const btnRegister   = $("btnRegister");  // Get Started

// Register PDS elements
const userType        = $("userType");         // commuter/driver
const driverSection   = $("driverSection");
const commuterSection = $("commuterSection");
const uniqueIdEl      = $("uniqueId");
const userTypeHidden  = $("userTypeHidden");

// OTP
let currentOtp = null;

// ---------- floating hover/click (NO CSS required) ----------
function attachFloatTo(el){
  if(!el) return;
  el.style.transition = "transform 220ms ease, filter 220ms ease";
  el.style.transformOrigin = "center";

  const on  = () => {
    el.style.transform = "translateY(-14px) scale(1.04)";
    el.style.filter = "drop-shadow(0 18px 18px rgba(0,0,0,.35))";
  };
  const off = () => {
    el.style.transform = "translateY(0px) scale(1)";
    el.style.filter = "none";
  };

  el.addEventListener("mouseenter", on);
  el.addEventListener("mouseleave", off);

  el.addEventListener("touchstart", on, {passive:true});
  el.addEventListener("touchend", off);
  el.addEventListener("touchcancel", off);

  el.addEventListener("click", () => { on(); setTimeout(off, 250); });
}

document.addEventListener("DOMContentLoaded", () => {
  // trike float
  attachFloatTo($("trike") || document.querySelector(".logo"));

  // buttons float
  //document.querySelectorAll(".btn").forEach(attachFloatTo);

  // wire modal + forms
  boot();
});

// ---------- modal ----------
function openModal(which){
  if(!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  setMsg("");

  if(which === "login"){
    if(modalTitle) modalTitle.textContent = "Login";
    show(loginPanel);
    hide(registerPanel);
  } else {
    if(modalTitle) modalTitle.textContent = "Register";
    show(registerPanel);
    hide(loginPanel);
    prepareRegister();
  }
}

function closeModal(){
  if(!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  setMsg("");
}

// ---------- register prep + required toggles ----------
function syncTypeSections(){
  const t = userType?.value || "commuter";
  if(userTypeHidden) userTypeHidden.value = t; // hidden identification

  // Toggle display
  if(t === "driver"){
    show(driverSection);
    hide(commuterSection);
  }else{
    show(commuterSection);
    hide(driverSection);
  }

  // Commuter required fields ON only when commuter
  setReq("homeZone",       t !== "driver");
  setReq("trustedName",    t !== "driver");
  setReq("trustedMobile",  t !== "driver");
  setReq("commuterPhoto",  t !== "driver");

  // Driver required fields ON only when driver
  setReq("driverAddress",        t === "driver");
  setReq("licensePhoto",         t === "driver");
  setReq("licenseExpiryPhoto",   t === "driver");
  setReq("licenseScan",          t === "driver");
  setReq("mtopPhoto",            t === "driver");
  setReq("lguBodyPhoto",         t === "driver");
  setReq("todaCert",             t === "driver");
  setReq("clearancePhoto",       t === "driver");
  setReq("liveSelfie",           t === "driver");
  setReq("driverEmergName",      t === "driver");
  setReq("driverEmergMobile",    t === "driver");
}

function prepareRegister(){
  // generate hidden unique id
  if(uniqueIdEl) uniqueIdEl.value = genUniqueId();

  // reset otp each time register opens
  currentOtp = null;

  // ensure sections + required correct
  syncTypeSections();

  // clear message
  setMsg("Fill up the form. Tap “Send OTP” to continue.");
}

// ---------- OTP demo ----------
function sendOtp(){
  // (Demo) generate 6 digits
  currentOtp = String(Math.floor(100000 + Math.random()*900000));
  setMsg(`OTP sent (demo): ${currentOtp}`);
}

// ---------- main boot wiring ----------
function boot(){
  // connect open buttons
  btnLogin?.addEventListener("click", () => openModal("login"));
  btnRegister?.addEventListener("click", () => openModal("register"));

  // close actions
  closeModalBtn?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeModal(); });

  // switch links inside forms
  $("toRegister")?.addEventListener("click", () => openModal("register"));
  $("toLogin")?.addEventListener("click", () => openModal("login"));

  // user type change
  userType?.addEventListener("change", syncTypeSections);

  // send OTP
  $("sendOtpBtn")?.addEventListener("click", sendOtp);

  // form submits
  loginPanel?.addEventListener("submit", onLoginSubmit);
  registerPanel?.addEventListener("submit", onRegisterSubmit);
}

// ---------- REGISTER SUBMIT ----------
function onRegisterSubmit(e){
  e.preventDefault();
  setMsg("");

// Terms agreement check
const agree = document.getElementById("agreeTC");
if(agree && !agree.checked){
  setMsg("You must agree to the Terms & Conditions.");
  return;
}

  // required fields
  const contact = ($("regContact")?.value || "").trim();
  const email   = ($("regEmail")?.value || "").trim();

  const pass1 = $("regPass")?.value || "";
  const pass2 = $("regPass2")?.value || "";
  if(pass1 !== pass2){
    setMsg("Passwords do not match.");
    return;
  }

  const otp = ($("regOtp")?.value || "").trim();
  if(!currentOtp){
    setMsg("Please click “Send OTP” first.");
    return;
  }
  if(otp !== currentOtp){
    setMsg("Invalid OTP.");
    return;
  }

  // Common biodata
  const lastName   = ($("lastName")?.value || "").trim();
  const firstName  = ($("firstName")?.value || "").trim();
  const middleName = ($("middleName")?.value || "").trim();
  const dob        = $("dob")?.value || "";
  const civil      = $("civilStatus")?.value || "";

  const t = userType?.value || "commuter";

  // Dedupe checks
  const users = getUsers();
  if(email && users.some(u => (u.email||"").toLowerCase() === email.toLowerCase())){
    setMsg("Email already registered.");
    return;
  }
  if(contact && users.some(u => (u.contact||"") === contact)){
    setMsg("Contact number already registered.");
    return;
  }

  // Build base user
  const uniqueId = uniqueIdEl?.value || genUniqueId();
  const role = (t === "driver") ? "driver" : "passenger";

  const base = {
    uniqueId,                 // hidden unique identification
    identification: t,        // hidden identification (driver/commuter)
    fullName: { last:lastName, first:firstName, middle:middleName },
    dob,
    civilStatus: civil,
    contact,
    email,
    password: pass1,
    role,
    createdAt: Date.now()
  };

  // PDS by type
  let pds = {};
  if(t === "driver"){
    pds = {
      permanentAddress: ($("driverAddress")?.value || "").trim(),
      emergency: {
        name: ($("driverEmergName")?.value || "").trim(),
        mobile: ($("driverEmergMobile")?.value || "").trim()
      },
      files: {
        licensePhoto: $("licensePhoto")?.files?.[0]?.name || "",
        licenseExpiryPhoto: $("licenseExpiryPhoto")?.files?.[0]?.name || "",
        licenseScanCount: $("licenseScan")?.files?.length || 0,
        mtopPhoto: $("mtopPhoto")?.files?.[0]?.name || "",
        lguBodyPhoto: $("lguBodyPhoto")?.files?.[0]?.name || "",
        todaCert: $("todaCert")?.files?.[0]?.name || "",
        clearancePhoto: $("clearancePhoto")?.files?.[0]?.name || "",
        liveSelfie: $("liveSelfie")?.files?.[0]?.name || ""
      }
    };
  } else {
    pds = {
      homeZone: ($("homeZone")?.value || "").trim(),
      trustedContact: {
        name: ($("trustedName")?.value || "").trim(),
        mobile: ($("trustedMobile")?.value || "").trim()
      },
      files: {
        commuterPhoto: $("commuterPhoto")?.files?.[0]?.name || ""
      }
    };
  }

  users.push({ ...base, pds });
  setUsers(users);

  // Auto login -> homepage
  const displayName = `${firstName} ${lastName}`.trim() || email || contact || "User";
  setSession({ username: displayName, role, uniqueId, ts: Date.now() });
  redirectHome();
}

// ---------- LOGIN SUBMIT ----------
function onLoginSubmit(e){
  e.preventDefault();
  setMsg("");

  // loginUser can be email OR contact
  const loginUser = ($("loginUser")?.value || "").trim();
  const loginPass = $("loginPass")?.value || "";

  const users = getUsers();
  const found = users.find(u =>
    ((u.email||"").toLowerCase() === loginUser.toLowerCase()) ||
    ((u.contact||"") === loginUser)
  );

  if(!found || found.password !== loginPass){
    setMsg("Invalid email/contact or password.");
    return;
  }

  const displayName =
    `${found.fullName?.first || ""} ${found.fullName?.last || ""}`.trim()
    || found.email || found.contact || "User";

  setSession({ username: displayName, role: found.role, uniqueId: found.uniqueId, ts: Date.now() });
  redirectHome();
}

// ===== Terms & Conditions modal =====
const openTC  = document.getElementById("openTC");
const tcModal = document.getElementById("tcModal");
const closeTC = document.getElementById("closeTC");

function showTC(){
  tcModal?.classList.remove("hidden");
  tcModal?.setAttribute("aria-hidden", "false");

  const body = tcModal?.querySelector(".tcBody");
  if(body) body.scrollTop = 0;
}
function hideTC(){
  tcModal?.classList.add("hidden");
  tcModal?.setAttribute("aria-hidden", "true");
}

openTC?.addEventListener("click", showTC);
closeTC?.addEventListener("click", hideTC);
