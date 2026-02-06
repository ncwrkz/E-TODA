// =========================
// app.js (E-TODA Start) - FULL WORKING
// Login + Register(PDS) + OTP + Terms + Driver Approval + Admin UPSERT
// =========================

const SESSION_KEY = "esakay_session_v1";
const USERS_KEY   = "esakay_users_v1";

const $ = (id) => document.getElementById(id);

// ---------- helpers ----------
function safeJSONParse(v, fallback){
  try { return JSON.parse(v); } catch { return fallback; }
}
function getSession(){
  return safeJSONParse(localStorage.getItem(SESSION_KEY) || "null", null);
}
function setSession(sess){
  localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
}
function getUsers(){
  return safeJSONParse(localStorage.getItem(USERS_KEY) || "[]", []);
}
function setUsers(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function genUniqueId(){
  return "ETODA-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random()*9999);
}
function show(el){ if(el) el.classList.remove("hidden"); }
function hide(el){ if(el) el.classList.add("hidden"); }
function setReq(id, required){
  const el = $(id);
  if(el) el.required = !!required;
}
function setMsg(text){
  const m = $("msg");
  if(m) m.textContent = text || "";
}
function buildDisplayName(u){
  const full = `${u?.fullName?.first || ""} ${u?.fullName?.last || ""}`.trim();
  return full || u?.email || u?.contact || u?.username || "User";
}
function redirectHome(role){
  const r = String(role || "").toLowerCase();
  if(r === "admin") return (window.location.href = "admin.html");
  if(r === "driver") return (window.location.href = "driver.html");
  return (window.location.href = "home.html"); // passenger default
}

// ---------- ADMIN UPSERT (create OR fix existing) ----------
function ensureAdminAccount(){
  const users = getUsers();
  const ADMIN_EMAIL = "admin@etoda";
  const ADMIN_PASS  = "admin123";

  let admin = users.find(u => (u.email || "").toLowerCase() === ADMIN_EMAIL);

  if(!admin){
    admin = {
      uniqueId: "ETODA-ADMIN-0001",
      identification: "admin",
      fullName: { last:"Admin", first:"System", middle:"" },
      dob: "",
      civilStatus: "",
      contact: "0000000000",
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
      role: "admin",
      isActive: true,
      createdAt: Date.now(),
      driverStatus: "approved",
      driverApproved: true,
      pds: {}
    };
    users.push(admin);
  } else {
    admin.role = "admin";
    admin.isActive = true;
    admin.password = ADMIN_PASS; // force correct password
    admin.driverStatus = "approved";
    admin.driverApproved = true;
    if(!admin.uniqueId) admin.uniqueId = "ETODA-ADMIN-0001";
  }

  setUsers(users);
}

// ---------- floating hover/click ----------
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

// ---------- elements ----------
const modal         = $("modal");
const modalTitle    = $("modalTitle");
const closeModalBtn = $("closeModal");

const loginPanel    = $("loginPanel");
const registerPanel = $("registerPanel");

const btnLogin      = $("btnLogin");     // Continue
const btnRegister   = $("btnRegister");  // Get Started

// Register sections
const userType        = $("userType");         // commuter/driver
const driverSection   = $("driverSection");
const commuterSection = $("commuterSection");
const uniqueIdEl      = $("uniqueId");
const userTypeHidden  = $("userTypeHidden");

// OTP
let currentOtp = null;

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

// ---------- register prep ----------
function syncTypeSections(){
  const t = userType?.value || "commuter";
  if(userTypeHidden) userTypeHidden.value = t;

  if(t === "driver"){
    show(driverSection);
    hide(commuterSection);
  }else{
    show(commuterSection);
    hide(driverSection);
  }

  // commuter required
  setReq("homeZone",       t !== "driver");
  setReq("trustedName",    t !== "driver");
  setReq("trustedMobile",  t !== "driver");
  setReq("commuterPhoto",  t !== "driver");

  // driver required
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
  if(uniqueIdEl) uniqueIdEl.value = genUniqueId();
  currentOtp = null;
  syncTypeSections();
  setMsg("Fill up the form. Tap “Send OTP” to continue.");
}

// ---------- OTP demo ----------
function sendOtp(){
  currentOtp = String(Math.floor(100000 + Math.random()*900000));
  setMsg(`OTP sent (demo): ${currentOtp}`);
}

// ---------- REGISTER ----------
function onRegisterSubmit(e){
  e.preventDefault();
  setMsg("");

  const agree = $("agreeTC");
  if(agree && !agree.checked){
    setMsg("You must agree to the Terms & Conditions.");
    return;
  }

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

  const lastName   = ($("lastName")?.value || "").trim();
  const firstName  = ($("firstName")?.value || "").trim();
  const middleName = ($("middleName")?.value || "").trim();
  const dob        = $("dob")?.value || "";
  const civil      = $("civilStatus")?.value || "";

  const t = userType?.value || "commuter";
  const role = (t === "driver") ? "driver" : "passenger";

  const users = getUsers();

  // dedupe
  if(email && users.some(u => (u.email||"").toLowerCase() === email.toLowerCase())){
    setMsg("Email already registered.");
    return;
  }
  if(contact && users.some(u => (u.contact||"") === contact)){
    setMsg("Contact number already registered.");
    return;
  }

  const uniqueId = uniqueIdEl?.value || genUniqueId();

  const base = {
    uniqueId,
    identification: t,
    fullName: { last:lastName, first:firstName, middle:middleName },
    dob,
    civilStatus: civil,
    contact,
    email,
    password: pass1,
    role,
    isActive: true,
    createdAt: Date.now(),
    driverStatus: (role === "driver") ? "pending" : "approved",
    driverApproved: (role !== "driver")
  };

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

  const user = { ...base, pds };
  users.push(user);
  setUsers(users);

  if(role === "driver"){
    setMsg("✅ Registration submitted. Your driver account needs ADMIN approval before login.");
    closeModal();
    return;
  }

  // passenger auto-login
  const displayName = buildDisplayName(user);

  setSession({
    username: displayName,
    role: user.role,
    uniqueId: user.uniqueId,
    ts: Date.now()
  });

  localStorage.setItem("lastLoginUser", email || contact);
  redirectHome(user.role);
}

// ---------- LOGIN ----------
function onLoginSubmit(e){
  e.preventDefault();
  setMsg("");

  const loginUser = ($("loginUser")?.value || "").trim();
  const loginPass = $("loginPass")?.value || "";

  if(!loginUser || !loginPass){
    setMsg("Please enter your mobile/email and password.");
    return;
  }

  const users = getUsers();
  const found = users.find(u =>
    ((u.email||"").toLowerCase() === loginUser.toLowerCase()) ||
    ((u.contact||"") === loginUser)
  );

  if(!found || found.password !== loginPass){
    setMsg("Invalid email/contact or password.");
    return;
  }

  if(found.isActive === false){
    setMsg("Account is inactive. Please contact admin.");
    return;
  }

  if(String(found.role || "").toLowerCase() === "driver"){
    const ds = (found.driverStatus || "pending");
    if(ds !== "approved"){
      setMsg("Driver account pending admin approval. Please wait for approval.");
      return;
    }
  }

  const displayName = buildDisplayName(found);
  localStorage.setItem("lastLoginUser", loginUser);

  setSession({
    username: displayName,
    role: found.role,
    uniqueId: found.uniqueId,
    ts: Date.now()
  });

  redirectHome(found.role);
}

// ===== Terms & Conditions modal =====
const openTC  = $("openTC");
const tcModal = $("tcModal");
const closeTC = $("closeTC");

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

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  // ensure admin exists AFTER storage helpers exist
  ensureAdminAccount();

  // block access if already logged in
  const sess = getSession();
  if(sess && sess.role){
    redirectHome(sess.role);
    return;
  }

  attachFloatTo($("trike") || document.querySelector(".logo"));

  const last = localStorage.getItem("lastLoginUser");
  const input = $("loginUser");
  if(last && input) input.value = last;

  // wire UI
  btnLogin?.addEventListener("click", () => openModal("login"));
  btnRegister?.addEventListener("click", () => openModal("register"));
  closeModalBtn?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeModal(); });

  $("toRegister")?.addEventListener("click", () => openModal("register"));
  $("toLogin")?.addEventListener("click", () => openModal("login"));

  userType?.addEventListener("change", syncTypeSections);
  $("sendOtpBtn")?.addEventListener("click", sendOtp);

  loginPanel?.addEventListener("submit", onLoginSubmit);
  registerPanel?.addEventListener("submit", onRegisterSubmit);
});
