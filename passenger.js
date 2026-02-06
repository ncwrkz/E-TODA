const SESSION_KEY = "esakay_session_v1";
const USERS_KEY   = "esakay_users_v1";

const $ = (id)=>document.getElementById(id);

function getSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}
function getUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}

const sess = getSession();
if(!sess){
  window.location.replace("index.html");
}

// ------- UI refs -------
const gpsStatus = $("gpsStatus");
const gpsAcc    = $("gpsAcc");
const startBtn  = $("startBtn");
const stopBtn   = $("stopBtn");
const centerBtn = $("centerBtn");
const backBtn   = $("backBtn");

const modePickupBtn = $("modePickup");
const modeDestBtn   = $("modeDest");
const clearBtn      = $("clearBtn");

const pickupText = $("pickupText");
const destText   = $("destText");

const trikeCount = $("trikeCount");
const sosBtn     = $("sosBtn");
const trustedText= $("trustedText");

// ------- trusted contact (from commuter PDS) -------
function getTrustedContact(){
  const users = getUsers();
  // Try match by uniqueId in session
  const me = users.find(u => u.uniqueId === sess.uniqueId) || null;
  const tc = me?.pds?.trustedContact || null;
  if(!tc || (!tc.mobile && !tc.name)) return null;
  return tc;
}

const trusted = getTrustedContact();
trustedText.textContent = trusted
  ? `Trusted contact: ${trusted.name || "Contact"} • ${trusted.mobile || "—"}`
  : "Trusted contact: —";

// ------- Map init -------
const map = L.map("map", { zoomControl: true }).setView([14.5995, 120.9842], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// ------- GPS tracking -------
let watchId = null;
let meMarker = null;
let accCircle = null;
let lastLatLng = null;

function setStatus(text){ if(gpsStatus) gpsStatus.textContent = text; }
function setAccuracy(meters){
  if(!gpsAcc) return;
  gpsAcc.textContent = `Accuracy: ${meters ? Math.round(meters) + " m" : "—"}`;
}

function updateMyLocation(lat, lng, accuracy){
  lastLatLng = [lat, lng];

  if(!meMarker){
    meMarker = L.circleMarker([lat,lng], {
      radius: 8,
      weight: 2
    }).addTo(map).bindPopup("You (Live Location)");

    accCircle = L.circle([lat,lng], { radius: accuracy || 0 }).addTo(map);
    map.setView([lat,lng], 16);
  } else {
    meMarker.setLatLng([lat,lng]);
    accCircle.setLatLng([lat,lng]);
    accCircle.setRadius(accuracy || 0);
  }

  setAccuracy(accuracy);
}

function startTracking(){
  if(!navigator.geolocation){
    setStatus("Geolocation not supported.");
    return;
  }
  setStatus("Requesting location permission…");

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setStatus("Tracking live location ✅");
      updateMyLocation(latitude, longitude, accuracy);
      stopBtn.disabled = false;
      startBtn.disabled = true;
    },
    (err) => {
      console.error(err);
      if(err.code === 1) setStatus("Permission denied. Allow location permission.");
      else if(err.code === 2) setStatus("Position unavailable. Turn on GPS.");
      else setStatus("Location timeout. Try again.");
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
  );
}

function stopTracking(){
  if(watchId != null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  setStatus("Tracking stopped.");
  stopBtn.disabled = true;
  startBtn.disabled = false;
}

startBtn.addEventListener("click", startTracking);
stopBtn.addEventListener("click", stopTracking);

centerBtn.addEventListener("click", ()=>{
  if(lastLatLng) map.setView(lastLatLng, 16);
  else setStatus("No live location yet. Click Start GPS.");
});

backBtn.addEventListener("click", ()=> window.location.href = "home.html");

// ------- Pins (tap map) -------
let mode = "pickup"; // pickup | dest
let pickupMarker = null;
let destMarker = null;

function setMode(next){
  mode = next;
  modePickupBtn.classList.toggle("active", mode === "pickup");
  modeDestBtn.classList.toggle("active", mode === "dest");
}

modePickupBtn.addEventListener("click", ()=> setMode("pickup"));
modeDestBtn.addEventListener("click", ()=> setMode("dest"));

function fmtLatLng(latlng){
  return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
}

function setPickup(latlng){
  if(!pickupMarker){
    pickupMarker = L.marker(latlng, { draggable: true }).addTo(map);
    pickupMarker.bindPopup("Pick-up").openPopup();
    pickupMarker.on("dragend", () => {
      const ll = pickupMarker.getLatLng();
      pickupText.textContent = fmtLatLng(ll);
      refreshRoute();
      refreshTrikeSim(); // keep trikes around pickup
    });
  } else {
    pickupMarker.setLatLng(latlng);
  }
  pickupText.textContent = fmtLatLng(latlng);
  refreshRoute();
  refreshTrikeSim();
}

function setDest(latlng){
  if(!destMarker){
    destMarker = L.marker(latlng, { draggable: true }).addTo(map);
    destMarker.bindPopup("Destination").openPopup();
    destMarker.on("dragend", () => {
      const ll = destMarker.getLatLng();
      destText.textContent = fmtLatLng(ll);
      refreshRoute();
    });
  } else {
    destMarker.setLatLng(latlng);
  }
  destText.textContent = fmtLatLng(latlng);
  refreshRoute();
}

map.on("click", (e) => {
  if(mode === "pickup") setPickup(e.latlng);
  else setDest(e.latlng);
});

clearBtn.addEventListener("click", ()=>{
  if(pickupMarker){ map.removeLayer(pickupMarker); pickupMarker = null; }
  if(destMarker){ map.removeLayer(destMarker); destMarker = null; }
  pickupText.textContent = "Not set";
  destText.textContent = "Not set";
  clearRoute();
  stopTrikeSim();
});

// ------- Route line (OSRM) -------
let routeLine = null;

function clearRoute(){
  if(routeLine){
    map.removeLayer(routeLine);
    routeLine = null;
  }
}

async function refreshRoute(){
  clearRoute();
  if(!pickupMarker || !destMarker) return;

  const a = pickupMarker.getLatLng();
  const b = destMarker.getLatLng();

  // OSRM expects lng,lat
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;

  try{
    setStatus("Calculating route…");
    const res = await fetch(url);
    const data = await res.json();

    if(!data.routes || !data.routes[0]){
      setStatus("Route not available.");
      return;
    }

    const coords = data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);
    routeLine = L.polyline(coords, { weight: 6, opacity: 0.85 }).addTo(map);

    const bounds = routeLine.getBounds();
    map.fitBounds(bounds, { padding: [30,30] });

    const km = (data.routes[0].distance/1000).toFixed(2);
    const min = Math.round(data.routes[0].duration/60);
    setStatus(`Route: ${km} km • ~${min} min ✅`);
  }catch(err){
    console.error(err);
    setStatus("Route error (check internet).");
  }
}

// ------- Nearby tricycles simulation -------
let trikeMarkers = [];
let trikeTimer = null;

function randomAround(center, meters){
  // rough conversion: 1 deg lat ~ 111,000m
  const lat = center.lat + ((Math.random()*2-1) * meters) / 111000;
  const lng = center.lng + ((Math.random()*2-1) * meters) / (111000 * Math.cos(center.lat * Math.PI/180));
  return { lat, lng };
}

function stopTrikeSim(){
  if(trikeTimer){ clearInterval(trikeTimer); trikeTimer = null; }
  trikeMarkers.forEach(m => map.removeLayer(m));
  trikeMarkers = [];
  trikeCount.textContent = "0";
}

function refreshTrikeSim(){
  // need pickup to simulate nearby trikes
  if(!pickupMarker){
    stopTrikeSim();
    return;
  }

  const center = pickupMarker.getLatLng();

  // if already running, just re-center trikes near new pickup
  if(trikeMarkers.length === 0){
    // create 6 trikes
    const N = 6;
    for(let i=0;i<N;i++){
      const p = randomAround(center, 350);
      const m = L.circleMarker([p.lat,p.lng], { radius: 7, weight: 2 }).addTo(map);
      m.bindPopup(`Tricycle #${i+1}`);
      trikeMarkers.push(m);
    }
    trikeCount.textContent = String(trikeMarkers.length);
  } else {
    // move them near pickup
    trikeMarkers.forEach(m=>{
      const p = randomAround(center, 350);
      m.setLatLng([p.lat,p.lng]);
    });
  }

  // start movement loop once
  if(!trikeTimer){
    trikeTimer = setInterval(()=>{
      if(!pickupMarker) return;
      const c = pickupMarker.getLatLng();
      trikeMarkers.forEach(m=>{
        const cur = m.getLatLng();
        // small step movement toward random point near pickup
        const target = randomAround(c, 250);
        const nextLat = cur.lat + (target.lat - cur.lat) * 0.25;
        const nextLng = cur.lng + (target.lng - cur.lng) * 0.25;
        m.setLatLng([nextLat, nextLng]);
      });
    }, 1200);
  }
}

// ------- SOS share to trusted contact -------
function getBestLocation(){
  if(lastLatLng) return { lat:lastLatLng[0], lng:lastLatLng[1], source:"live GPS" };
  if(pickupMarker){
    const ll = pickupMarker.getLatLng();
    return { lat: ll.lat, lng: ll.lng, source:"pickup pin" };
  }
  return null;
}

async function shareSOS(){
  const loc = getBestLocation();
  if(!loc){
    alert("No location available. Start GPS or set Pick-up pin.");
    return;
  }

  const mapLink = `https://maps.google.com/?q=${loc.lat},${loc.lng}`;
  const msg =
`🚨 SOS from E-TODA
User: ${sess.username || "Passenger"}
Location (${loc.source}): ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}
Link: ${mapLink}`;

  // If you have trusted contact mobile, use SMS deep link
  if(trusted?.mobile){
    // mobile sms app
    const smsUrl = `sms:${trusted.mobile}?body=${encodeURIComponent(msg)}`;
    window.location.href = smsUrl;
    return;
  }

  // Web Share API (if available)
  if(navigator.share){
    try{
      await navigator.share({ title:"E-TODA SOS", text: msg });
      return;
    }catch(e){}
  }

  // Fallback: copy to clipboard
  try{
    await navigator.clipboard.writeText(msg);
    alert("SOS message copied. Paste it to Messenger/SMS.");
  }catch{
    alert(msg);
  }
}

sosBtn.addEventListener("click", shareSOS);
