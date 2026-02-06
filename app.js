// =========================
// E-TODA Start Page Logic (Login + PDS Register)
// Continue Button -> Login Panel
// Get Started Button -> Register Panel
// =========================

// Keys (match your project keys if you already have them)
const SESSION_KEY = "esakay_session_v1";
const USERS_KEY   = "esakay_users_v1";

// Elements
const modal         = document.getElementById("modal");
const modalTitle    = document.getElementById("modalTitle");
const closeModalBtn = document.getElementById("closeModal");

const loginPanel    = document.getElementById("loginPanel");
const registerPanel = document.getElementById("registerPanel");
const msg           = document.getElementById("msg");

const btnLogin      = document.getElementById("btnLogin");      // Continue
const btnRegister   = document.getElementById("btnRegister");   // Get Started

// Register form (PDS) elements
const userType        = document.getElementById("userType");          // commuter/driver
const driverSection   = document.getElementById("driverSection");
const commuterSection = document.getElementById("commuterSection");
const uniqueIdEl      = document.getElementById("uniqueId");          // hidden unique id
const userTypeHidden  = document.getElementById("userTypeHidden");    // hidden identification

// OTP demo state
let currentOtp = null;

// -------------------------
// Floating trike
// -------------------------
const trike = document.getElementById("trike");
if (trike) {
  const on = () => trike.classList.add("is-float");
  const off = () => trike.classList.remove("is-float");
  trike.addEventListener("touchstart", on, { passive: true });
  trike.addEventListener("touchend", off);
  trike.addEventListener("touchcancel", off);
  trike.addEventListener("mouseenter", on);
  trike.addEventListener("mouseleave", off);
  trike.addEventListener("click", () => { on(); setTimeout(off, 250); });
}

// Button floating
document.querySelectorAll(".floatBtn").forEach(btn => {
  const on = () => btn.classList.add("active");
  const off = () => btn.classList.remove("active");
  btn.addEventListener("touchstart", on, { passive: true });
  btn.addEventListener("touchend", off);
  btn.addEventListener("touchcancel", off);
  btn.addEventListener("mouseenter", on);
  btn.addEventListener("mouseleave", off);
});

// -------------------------
// Modal helpers
// -------------------------
function openModal(which) {
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  msg.textContent = "";

  if (which === "login") {
    modalTitle.textContent = "Login";
    loginPanel.classList.remove("hidden");
    registerPanel.classList.add("hidden");
  } else {
    modalTitle.textContent = "Register";
    registerPanel.classList.remove("hidden");
    loginPanel.classList.add("hidden");
    prepareRegister(); // ✅ important for PDS form
  }
}

function closeModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  msg.textContent = "";
}

// Connect buttons
btnLogin?.addEventListener("click", () => openModal("login"));        // Continue -> Login
btnRegister?.addEventListener("click", () => openModal("register"));  // Get Started -> Register

// Close actions
closeModalBtn?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// Switch links
document.getElementById("toRegister")?.addEventListener("click", () => openModal("register"));
document.getElementById("toLogin")?.addEventListener("click", () => openModal("login"));

// -------------------------
// Storage helpers
// -------------------------
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}
function setUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function setSession(sess) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
}
function redirectByRole(role) {
  if (role === "admin") return (window.location.href = "home.html");
  if (role === "driver") return (window.location.href = "home.html");
  return (window.location.href = "home.html");
}

// -------------------------
// Register helpers (PDS)
// -------------------------
function genUniqueId() {
  return "ETODA-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 9999);
}

function prepareRegister() {
  // auto-generate hidden unique ID every time Register opens
  if (uniqueIdEl) uniqueIdEl.value = genUniqueId();

  // reset OTP
  currentOtp = null;

  // sync user type sections + hidden identification
  syncTypeSections();
}

function syncTypeSections() {
  if (!userType) return;

  const t = userType.value; // "driver" or "commuter"
  if (userTypeHidden) userTypeHidden.value = t; // hidden identification

  // Toggle sections
  if (t === "driver") {
    driverSection?.classList.remove("hidden");
    commuterSection?.classList.add("hidden");

    // commuter required off
    const homeZone = document.getElementById("homeZone");
    const trustedName = document.getElementById("trustedName");
    const trustedMobile = document.getElementById("trustedMobile");
    const commuterPhoto = document.getElementById("commuterPhoto");
    if (homeZone) homeZone.required = false;
    if (trustedName) trustedName.required = false;
    if (trustedMobile) trustedMobile.required = false;
    if (commuterPhoto) commuterPhoto.required = false;

    // driver required on
    const driverAddress = document.getElementById("driverAddress");
    if (driverAddress) driverAddress.required = true;
  } else {
    commuterSection?.classList.remove("hidden");
    driverSection?.classList.add("hidden");

    // commuter required on
    const homeZone = document.getElementById("homeZone");
    const trustedName = document.getElementById("trustedName");
    const trustedMobile = document.getElementById("trustedMobile");
    const commuterPhoto = document.getElementById("commuterPhoto");
    if (homeZone) homeZone.required = true;
    if (trustedName) trustedName.required = true;
    if (trustedMobile) trustedMobile.required = true;
    if (commuterPhoto) commuterPhoto.required = true;

    // driver required off
    const driverAddress = document.getElementById("driverAddress");
    if (driverAddress) driverAddress.required = false;
  }
}

userType?.addEventListener("change", syncTypeSections);

// OTP demo (front-end)
document.getElementById("sendOtpBtn")?.addEventListener("click", () => {
  currentOtp = String(Math.floor(100000 + Math.random() * 900000));
  msg.textContent = `OTP sent (demo): ${currentOtp}`;
});

// -------------------------
// REGISTER (PDS Submit)
// -------------------------
registerPanel?.addEventListener("submit", (e) => {
  e.preventDefault();
  msg.textContent = "";

  // Account fields
  const contact = (document.getElementById("regContact")?.value || "").trim();
  const email   = (document.getElementById("regEmail")?.value || "").trim();

  const pass1 = document.getElementById("regPass")?.value || "";
  const pass2 = document.getElementById("regPass2")?.value || "";
  if (pass1 !== pass2) { msg.textContent = "Passwords do not match."; return; }

  // OTP check
  const otp = (document.getElementById("regOtp")?.value || "").trim();
  if (!currentOtp || otp !== currentOtp) { msg.textContent = "Invalid OTP."; return; }

  // Common biodata
  const lastName   = (document.getElementById("lastName")?.value || "").trim();
  const firstName  = (document.getElementById("firstName")?.value || "").trim();
  const middleName = (document.getElementById("middleName")?.value || "").trim();

  const dob         = document.getElementById("dob")?.value || "";
  const civilStatus = document.getElementById("civilStatus")?.value || "";

  // Type
  const t = userType?.value || "commuter"; // driver/commuter

  // Dedupe checks
  const users = getUsers();
  if (email && users.some(u => (u.email || "").toLowerCase() === email.toLowerCase())) {
    msg.textContent = "Email already registered.";
    return;
  }
  if (contact && users.some(u => u.contact === contact)) {
    msg.textContent = "Contact number already registered.";
    return;
  }

  // Base object
  const base = {
    uniqueId: uniqueIdEl?.value || genUniqueId(), // hidden unique identification
    identification: t,                            // hidden identification (driver/commuter)
    fullName: { last: lastName, first: firstName, middle: middleName },
    dob,
    civilStatus,
    contact,
    email,
    password: pass1,
    role: (t === "driver") ? "driver" : "passenger",
    createdAt: Date.now()
  };

  // PDS details
  let pds = {};
  if (t === "driver") {
    pds = {
      permanentAddress: (document.getElementById("driverAddress")?.value || "").trim(),
      emergency: {
        name: (document.getElementById("driverEmergName")?.value || "").trim(),
        mobile: (document.getElementById("driverEmergMobile")?.value || "").trim()
      },
      files: {
        licensePhoto: document.getElementById("licensePhoto")?.files?.[0]?.name || "",
        licenseExpiryPhoto: document.getElementById("licenseExpiryPhoto")?.files?.[0]?.name || "",
        licenseScanCount: document.getElementById("licenseScan")?.files?.length || 0,
        mtopPhoto: document.getElementById("mtopPhoto")?.files?.[0]?.name || "",
        lguBodyPhoto: document.getElementById("lguBodyPhoto")?.files?.[0]?.name || "",
        todaCert: document.getElementById("todaCert")?.files?.[0]?.name || "",
        clearancePhoto: document.getElementById("clearancePhoto")?.files?.[0]?.name || "",
        liveSelfie: document.getElementById("liveSelfie")?.files?.[0]?.name || ""
      }
    };
  } else {
    pds = {
      homeZone: (document.getElementById("homeZone")?.value || "").trim(),
      trustedContact: {
        name: (document.getElementById("trustedName")?.value || "").trim(),
        mobile: (document.getElementById("trustedMobile")?.value || "").trim()
      },
      files: {
        commuterPhoto: document.getElementById("commuterPhoto")?.files?.[0]?.name || ""
      }
    };
  }

  // Save user
  users.push({ ...base, pds });
  setUsers(users);

  // Auto-login
  const displayName = `${firstName} ${lastName}`.trim();
  setSession({ username: displayName || email || contact || "User", role: base.role, uniqueId: base.uniqueId, ts: Date.now() });
  redirectByRole(base.role);
});

// -------------------------
// LOGIN (by Contact or Email)
// -------------------------
loginPanel?.addEventListener("submit", (e) => {
  e.preventDefault();
  msg.textContent = "";

  const loginUser = (document.getElementById("loginUser")?.value || "").trim(); // email or contact
  const loginPass = document.getElementById("loginPass")?.value || "";

  const users = getUsers();

  // Find by email or contact (more realistic than "username")
  const found = users.find(u =>
    (u.email && u.email.toLowerCase() === loginUser.toLowerCase()) ||
    (u.contact && u.contact === loginUser)
  );

  if (!found || found.password !== loginPass) {
    msg.textContent = "Invalid email/contact or password.";
    return;
  }

  const displayName = `${found.fullName?.first || ""} ${found.fullName?.last || ""}`.trim() || found.email || found.contact || "User";
  setSession({ username: displayName, role: found.role, uniqueId: found.uniqueId, ts: Date.now() });
  redirectByRole(found.role);
});

