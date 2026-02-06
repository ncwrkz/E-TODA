const SESSION_KEY = "esakay_session_v1";

function getSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

function logout(){
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "start.html"; // or index.html
}

function go(page){
  window.location.href = page;
}

const sess = getSession();
if(!sess){
  // No session -> back to start/login
  window.location.href = "index.html";
}

document.getElementById("logoutBtn").addEventListener("click", logout);

document.getElementById("whoami").textContent =
  `Signed in as: ${sess.username || "User"} • ${sess.role || "passenger"}`;

document.getElementById("uid").textContent = sess.uniqueId || "—";
document.getElementById("role").textContent = (sess.role || "passenger").toUpperCase();

const role = sess.role || "passenger";

document.getElementById("passengerPanel").classList.toggle("hidden", role !== "passenger");
document.getElementById("driverPanel").classList.toggle("hidden", role !== "driver");
document.getElementById("adminPanel").classList.toggle("hidden", role !== "admin");

// expose go() for onclick buttons
window.go = go;
