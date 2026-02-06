// =====================================================
// E-TODA ADMIN PANEL — FULL FIX (BUTTONS WORK)
// =====================================================

const SESSION_KEY = "esakay_session_v1";
const USERS_KEY   = "esakay_users_v1";

const $ = (id)=>document.getElementById(id);

function safeParse(v, fb){ try{ return JSON.parse(v); } catch{ return fb; } }
function getSession(){ return safeParse(localStorage.getItem(SESSION_KEY) || "null", null); }
function getUsers(){ return safeParse(localStorage.getItem(USERS_KEY) || "[]", []); }
function setUsers(users){ localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function go(url){ if(url) window.location.href=url; }

function setText(id, val){ const el=$(id); if(el) el.textContent = (val ?? "—"); }
function show(id){ $(id)?.classList.remove("hidden"); }
function hide(id){ $(id)?.classList.add("hidden"); }

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function getName(u){
  const full = `${u?.fullName?.first || ""} ${u?.fullName?.last || ""}`.trim();
  return full || u?.username || u?.email || u?.contact || "User";
}

function normalizeUser(u){
  // Fix old accounts so admin panel works
  u.role = u.role || (u.identification === "driver" ? "driver" : "passenger");
  if(u.role === "driver"){
    u.driverStatus = u.driverStatus || "pending";
    u.driverApproved = !!u.driverApproved;
  }
  if(typeof u.isActive !== "boolean") u.isActive = true;
  if(!u.fullName) u.fullName = { first:"", last:"", middle:"" };
  if(!u.pds) u.pds = {};
  if(!u.pds.files) u.pds.files = {};
  return u;
}

function normalizeAll(){
  const users = getUsers().map(normalizeUser);
  setUsers(users);
  return users;
}

// ---------- guard ----------
const sess = getSession();
if(!sess) go("index.html");
if(String(sess.role).toLowerCase() !== "admin") go("home.html");

// ---------- header ----------
setText("headerName", sess.username || "Admin");
setText("headerId", sess.uniqueId || "—");
setText("menuName", sess.username || "Admin");
setText("menuRole", "ADMIN");
setText("menuId", sess.uniqueId || "—");

// avatar letters
(function(){
  const letter = (sess.username || "A").trim().charAt(0).toUpperCase();
  document.querySelectorAll(".letterAvatar").forEach(el=>el.textContent = letter);
})();

// ---------- dropdown safe ----------
const acctBtn  = $("acctBtn");
const acctMenu = $("acctMenu");

acctBtn?.addEventListener("click",(e)=>{
  e.stopPropagation();
  acctMenu?.classList.toggle("hidden");
  acctBtn?.setAttribute("aria-expanded", acctMenu?.classList.contains("hidden") ? "false" : "true");
});
document.addEventListener("click",(e)=>{
  if(!acctMenu || acctMenu.classList.contains("hidden")) return;
  if(acctMenu.contains(e.target) || acctBtn?.contains(e.target)) return;
  hide("acctMenu");
  acctBtn?.setAttribute("aria-expanded","false");
});

// ---------- logout ----------
$("logoutBtn")?.addEventListener("click", ()=>{ hide("acctMenu"); show("logoutModal"); });
$("closeLogout")?.addEventListener("click", ()=>hide("logoutModal"));
$("cancelLogout")?.addEventListener("click", ()=>hide("logoutModal"));
$("confirmLogout")?.addEventListener("click", ()=>{
  localStorage.removeItem(SESSION_KEY);
  go("index.html");
});

// ---------- UI refs ----------
const pendingList = $("pendingList");
const userTable   = $("userTable");

const searchInput = $("searchInput");
const filterRole  = $("filterRole");
$("refreshBtn")?.addEventListener("click", renderAll);
searchInput?.addEventListener("input", renderAll);
filterRole?.addEventListener("change", renderAll);

// ---------- Stats ----------
function renderStats(users){
  setText("statTotal", users.length);
  setText("statPassengers", users.filter(u=>String(u.role).toLowerCase()==="passenger").length);
  setText("statDrivers", users.filter(u=>String(u.role).toLowerCase()==="driver").length);
  setText("statPending", users.filter(u=>String(u.role).toLowerCase()==="driver" && (u.driverStatus||"pending")==="pending").length);
}

// ---------- Actions ----------
function approveDriver(uid){
  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===uid);
  if(!u) return;

  u.role="driver";
  u.driverStatus="approved";
  u.driverApproved=true;
  u.isActive=true;

  setUsers(users);
  renderAll();
  openManage(uid);
}

function rejectDriver(uid){
  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===uid);
  if(!u) return;

  u.role="driver";
  u.driverStatus="rejected";
  u.driverApproved=false;

  setUsers(users);
  renderAll();
  openManage(uid);
}

function toggleRevoke(uid){
  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===uid);
  if(!u) return;

  // protect default admin
  if(String(u.role).toLowerCase()==="admin" && String(u.email||"").toLowerCase()==="admin@etoda"){
    alert("You can’t revoke the default admin.");
    return;
  }

  u.isActive = !u.isActive;
  setUsers(users);
  renderAll();
  openManage(uid);
}

function deleteUser(uid){
  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===uid);
  if(!u) return;

  if(String(u.role).toLowerCase()==="admin" && String(u.email||"").toLowerCase()==="admin@etoda"){
    alert("You can’t delete the default admin.");
    return;
  }

  if(!confirm(`Delete ${getName(u)}? This cannot be undone.`)) return;

  setUsers(users.filter(x=>x.uniqueId!==uid));
  closeManage();
  renderAll();
}

function downloadBackup(uid){
  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===uid);
  if(!u) return;

  const blob = new Blob([JSON.stringify(u,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ETODA_BACKUP_${uid}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Filtering ----------
function applyFilters(users){
  const q = (searchInput?.value || "").trim().toLowerCase();
  const r = String(filterRole?.value || "all").toLowerCase();

  let list = users.slice();

  if(r !== "all"){
    list = list.filter(u => String(u.role||"passenger").toLowerCase() === r);
  }

  if(q){
    list = list.filter(u=>{
      const name = getName(u).toLowerCase();
      const email = String(u.email||"").toLowerCase();
      const contact = String(u.contact||"").toLowerCase();
      const id = String(u.uniqueId||"").toLowerCase();
      return name.includes(q) || email.includes(q) || contact.includes(q) || id.includes(q);
    });
  }

  return list;
}

// ---------- Render Pending (driver pending only) ----------
function renderPending(users){
  if(!pendingList) return;

  pendingList.innerHTML = "";
  const pending = users.filter(u =>
    String(u.role).toLowerCase()==="driver" &&
    (u.driverStatus||"pending")==="pending"
  );

  if(!pending.length){
    show("pendingEmpty");
    return;
  }
  hide("pendingEmpty");

  pending.forEach(u=>{
    const div = document.createElement("div");
    div.className="cardRow";
    div.innerHTML=`
      <div class="cardLeft">
        <div class="nameLine">
          <div class="name">${escapeHtml(getName(u))}</div>
          <span class="pill warn">DRIVER • PENDING</span>
          <span class="pill ${u.isActive ? "ok":"bad"}">${u.isActive ? "ACTIVE":"INACTIVE"}</span>
        </div>
        <div class="meta">
          <div><b>ID:</b> ${escapeHtml(u.uniqueId||"—")}</div>
          <div><b>Email:</b> ${escapeHtml(u.email||"—")} • <b>Contact:</b> ${escapeHtml(u.contact||"—")}</div>
        </div>
      </div>
      <div class="cardBtns">
        <button class="smallBtn ok" data-action="approve" data-id="${u.uniqueId}">Approve</button>
        <button class="smallBtn warn" data-action="reject" data-id="${u.uniqueId}">Reject</button>
        <button class="smallBtn primary" data-action="manage" data-id="${u.uniqueId}">Manage</button>
      </div>
    `;
    pendingList.appendChild(div);
  });
}

// event delegation for pending buttons
pendingList?.addEventListener("click",(e)=>{
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;

  const id = btn.getAttribute("data-id");
  const act = btn.getAttribute("data-action");

  if(act==="approve") approveDriver(id);
  if(act==="reject") rejectDriver(id);
  if(act==="manage") openManage(id);
});

// ---------- Render Users ----------
function renderUsers(users){
  if(!userTable) return;

  userTable.innerHTML = `
    <div class="tRow head">
      <div class="cell">User</div>
      <div class="cell">Role / Status</div>
      <div class="cell">Contact</div>
      <div class="cell">Actions</div>
    </div>
  `;

  if(users.length === 0){
    show("userEmpty");
    return;
  }
  hide("userEmpty");

  users.forEach(u=>{
    const row = document.createElement("div");
    row.className = "tRow";
    row.innerHTML = `
      <div class="cell">
        <b>${escapeHtml(getName(u))}</b>
        <small>${escapeHtml(u.email||"—")} • ${escapeHtml(u.uniqueId||"—")}</small>
      </div>
      <div class="cell">
        <span class="pill">${escapeHtml(String(u.role||"passenger").toUpperCase())}</span>
        ${String(u.role).toLowerCase()==="driver"
          ? `<span class="pill ${u.driverStatus==="approved" ? "ok" : u.driverStatus==="rejected" ? "bad" : "warn"}">${escapeHtml(String(u.driverStatus||"pending").toUpperCase())}</span>`
          : ""
        }
        <span class="pill ${u.isActive ? "ok":"bad"}">${u.isActive ? "ACTIVE":"INACTIVE"}</span>
      </div>
      <div class="cell">
        ${escapeHtml(u.contact||"—")}
        <small>${escapeHtml(u.civilStatus||"")}</small>
      </div>
      <div class="cell">
        <button class="smallBtn primary" data-action="manage" data-id="${u.uniqueId}">Manage</button>
      </div>
    `;
    userTable.appendChild(row);
  });
}

// event delegation for manage buttons
userTable?.addEventListener("click",(e)=>{
  const btn=e.target.closest("button[data-action='manage']");
  if(!btn) return;
  openManage(btn.getAttribute("data-id"));
});

// ---------- Manage Modal ----------
let currentId=null;

function openManage(uid){
  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===uid);
  if(!u) return;

  currentId=uid;

  setText("mName", getName(u));
  setText("mId", u.uniqueId);
  setText("mEmail", u.email);
  setText("mContact", u.contact);

  const av = $("mAvatar");
  if(av) av.textContent = (getName(u)[0]||"U").toUpperCase();

  $("editEmail").value = u.email || "";
  $("editContact").value = u.contact || "";
  $("editPassword").value = "";

  setText("mRole", String(u.role||"passenger").toUpperCase());
  setText("mStatus", u.isActive ? "ACTIVE":"INACTIVE");

  show("manageModal");
}

function closeManage(){
  currentId=null;
  hide("manageModal");
}

$("closeManage")?.addEventListener("click", closeManage);

// Save profile
$("btnSaveProfile")?.addEventListener("click", ()=>{
  if(!currentId) return;

  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===currentId);
  if(!u) return;

  const newEmail = ($("editEmail").value || "").trim();
  const newContact = ($("editContact").value || "").trim();

  if(!newEmail || !newContact) return alert("Email and contact required.");

  if(users.some(x=>x.uniqueId!==currentId && String(x.email||"").toLowerCase()===newEmail.toLowerCase()))
    return alert("Email already used.");

  if(users.some(x=>x.uniqueId!==currentId && String(x.contact||"")===newContact))
    return alert("Contact already used.");

  u.email=newEmail;
  u.contact=newContact;

  setUsers(users);
  renderAll();
  openManage(currentId);
});

// Save password
$("btnSavePassword")?.addEventListener("click", ()=>{
  if(!currentId) return;

  const pass = ($("editPassword").value || "").trim();
  if(pass.length < 4) return alert("Password must be 4+ characters.");

  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===currentId);
  if(!u) return;

  u.password=pass;
  setUsers(users);

  alert("Password updated.");
});

// approve/reject from modal
$("btnApproveDriver")?.addEventListener("click", ()=> currentId && approveDriver(currentId));
$("btnRejectDriver")?.addEventListener("click", ()=> currentId && rejectDriver(currentId));

// revoke/delete/backup
$("btnRevoke")?.addEventListener("click", ()=> currentId && toggleRevoke(currentId));
$("btnDelete")?.addEventListener("click", ()=> currentId && deleteUser(currentId));
$("btnBackup")?.addEventListener("click", ()=> currentId && downloadBackup(currentId));

// docs modal
$("btnPreviewDocs")?.addEventListener("click", ()=> currentId && openDocs(currentId));
$("closeDoc")?.addEventListener("click", ()=> hide("docModal"));

function openDocs(uid){
  const users = normalizeAll();
  const u = users.find(x=>x.uniqueId===uid);
  if(!u) return;

  setText("docOwner", `${getName(u)} • ${u.uniqueId}`);

  const list = $("docList");
  const empty = $("docEmpty");
  list.innerHTML = "";

  const files = u?.pds?.files || {};
  const entries = Object.entries(files).filter(([_,v])=>v);

  if(entries.length === 0){
    show("docEmpty");
    show("docModal");
    return;
  }
  hide("docEmpty");

  entries.forEach(([k,v])=>{
    const div = document.createElement("div");
    div.className="docItem";
    div.innerHTML = `<b>${escapeHtml(k)}</b><div class="small muted">${escapeHtml(v)}</div>`;
    list.appendChild(div);
  });

  show("docModal");
}

// ---------- Master ----------
function renderAll(){
  const users = normalizeAll();
  renderStats(users);
  renderPending(users);
  renderUsers(applyFilters(users));
}

renderAll();
