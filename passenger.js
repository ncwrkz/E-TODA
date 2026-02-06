// =========================
// passenger.js (FULL)
// - No auto GPS on restore (no popup when returning home)
// - Persistent pins + last GPS + municipality
// - Route line (OSRM) + fare estimation
// - Nearest landmark text
// - Nearby tricycle simulation
// - SOS share to trusted contact
// - Reviews per municipality
// - Booking flow like Angkas/JoyRide (persistent)
// =========================

const SESSION_KEY = "esakay_session_v1";
const USERS_KEY   = "esakay_users_v1";
const REVIEWS_KEY = "esakay_reviews_v1";
const BOOKINGS_KEY = "esakay_bookings_v1";
const PASSENGER_STATE_KEY = "etoda_passenger_state_v1";

const $ = (id) => document.getElementById(id);

function safeParse(v, fallback){
  try { return JSON.parse(v); } catch { return fallback; }
}

function getSession(){
  return safeParse(localStorage.getItem(SESSION_KEY) || "null", null);
}
function getUsers(){
  return safeParse(localStorage.getItem(USERS_KEY) || "[]", []);
}
function getReviews(){
  return safeParse(localStorage.getItem(REVIEWS_KEY) || "[]", []);
}
function setReviews(items){
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(items));
}
function getBookings(){
  return safeParse(localStorage.getItem(BOOKINGS_KEY) || "[]", []);
}
function setBookings(items){
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(items));
}
function loadState(){
  return safeParse(localStorage.getItem(PASSENGER_STATE_KEY) || "null", null);
}
function saveState(state){
  try { localStorage.setItem(PASSENGER_STATE_KEY, JSON.stringify(state)); } catch {}
}

const sess = getSession();
if(!sess) window.location.replace("index.html");

// ---------- UI refs ----------
const gpsStatus = $("gpsStatus");
const gpsAcc    = $("gpsAcc");
const startBtn  = $("startBtn");
const stopBtn   = $("stopBtn");
const centerBtn = $("centerBtn");
const clearBtn  = $("clearBtn");
const backBtn   = $("backBtn");

const muniSelect    = $("muniSelect");
const pickupSelect  = $("pickupSelect");
const destSelect    = $("destSelect");

const pickupNearest = $("pickupNearest");
const destNearest   = $("destNearest");

const pickupText = $("pickupText");
const destText   = $("destText");
const fareText   = $("fareText");

const trikeCountEl = $("trikeCount");

const sosBtn      = $("sosBtn");
const trustedText = $("trustedText");

// Booking UI
const bookStatus = $("bookStatus");
const bookDriver = $("bookDriver");
const bookEta    = $("bookEta");
const bookFare   = $("bookFare");
const bookMsg    = $("bookMsg");

const requestRideBtn  = $("requestRideBtn");
const cancelRideBtn   = $("cancelRideBtn");
const startTripBtn    = $("startTripBtn");
const completeTripBtn = $("completeTripBtn");

// Reviews UI
const reviewCount = $("reviewCount");
const reviewList  = $("reviewList");
const reviewStars = $("reviewStars");
const reviewText  = $("reviewText");
const addReviewBtn= $("addReviewBtn");

// ---------- helpers ----------
function setStatus(t){ if(gpsStatus) gpsStatus.textContent = t; }
function setAccuracy(m){ if(gpsAcc) gpsAcc.textContent = `Accuracy: ${m ? Math.round(m) + " m" : "—"}`; }
function fmt(latlng){ return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`; }
function nowTs(){ return Date.now(); }

// ---------- trusted contact ----------
function getTrustedContact(){
  const me = getUsers().find(u => u.uniqueId === sess.uniqueId) || null;
  const tc = me?.pds?.trustedContact || null;
  if(!tc || (!tc.mobile && !tc.name)) return null;
  return tc;
}
const trusted = getTrustedContact();
if(trustedText){
  trustedText.textContent = trusted
    ? `Trusted contact: ${trusted.name || "Contact"} • ${trusted.mobile || "—"}`
    : "Trusted contact: —";
}

// ---------- municipalities (EDIT anytime) ----------
const MUNICIPALITIES = {
  masinloc: {
    name: "Masinloc",
    center: [15.5420, 119.9500],
    landmarks: [
      { id:"masinloc_public_market", name:"Masinloc Public Market", lat:15.5368, lng:119.9506 },
      { id:"masinloc_municipal_hall", name:"Masinloc Municipal Hall", lat:15.5362, lng:119.9500 },
      { id:"masinloc_church", name:"Masinloc Church", lat:15.5369, lng:119.9516 },
    ]
  },
  san_narciso: {
    name: "San Narciso",
    center: [15.0150, 120.0800],
    landmarks: [
      { id:"sn_public_market", name:"San Narciso Public Market", lat:15.0143, lng:120.0793 },
      { id:"sn_municipal_hall", name:"San Narciso Municipal Hall", lat:15.0149, lng:120.0786 },
      { id:"sn_church", name:"San Narciso Church", lat:15.0140, lng:120.0803 },
    ]
  },
  castillejos: {
    name: "Castillejos",
    center: [14.9330, 120.1990],
    landmarks: [
      { id:"cast_public_market", name:"Castillejos Public Market", lat:14.9351, lng:120.2005 },
      { id:"cast_municipal_hall", name:"Castillejos Municipal Hall", lat:14.9334, lng:120.1987 },
      { id:"cast_church", name:"Castillejos Church", lat:14.9342, lng:120.2014 },
    ]
  }
};

// ---------- map ----------
const map = L.map("map", { zoomControl:true }).setView(MUNICIPALITIES.masinloc.center, 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// ---------- GPS (manual only) ----------
let watchId = null;
let lastLatLng = null;
let meMarker = null;
let accCircle = null;

function updateMyLocation(lat, lng, acc){
  lastLatLng = [lat, lng];

  if(!meMarker){
    meMarker = L.circleMarker([lat,lng], { radius:8, weight:2 }).addTo(map).bindPopup("You (Live)");
    accCircle = L.circle([lat,lng], { radius: acc || 0 }).addTo(map);
  } else {
    meMarker.setLatLng([lat,lng]);
    accCircle.setLatLng([lat,lng]);
    accCircle.setRadius(acc || 0);
  }

  setAccuracy(acc);
  persistState(); // save last gps only (no auto-start)
}

function startTracking(){
  if(!navigator.geolocation){
    setStatus("Geolocation not supported.");
    return;
  }
  setStatus("Requesting location permission…");

  watchId = navigator.geolocation.watchPosition(
    (pos)=>{
      const { latitude, longitude, accuracy } = pos.coords;
      setStatus("Tracking live location ✅");
      updateMyLocation(latitude, longitude, accuracy);
      if(stopBtn) stopBtn.disabled = false;
      if(startBtn) startBtn.disabled = true;
    },
    (err)=>{
      console.error(err);
      if(err.code === 1) setStatus("Permission denied. Allow location permission.");
      else if(err.code === 2) setStatus("Position unavailable. Turn on GPS.");
      else setStatus("Location timeout. Try again.");
    },
    { enableHighAccuracy:true, maximumAge:1000, timeout:15000 }
  );
}

function stopTracking(){
  if(watchId != null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  setStatus("GPS stopped.");
  if(stopBtn) stopBtn.disabled = true;
  if(startBtn) startBtn.disabled = false;
}

startBtn?.addEventListener("click", startTracking);
stopBtn?.addEventListener("click", stopTracking);

// ---------- pins ----------
let pickupMarker = null;
let destMarker = null;

function setPickup(latlng){
  if(!pickupMarker){
    pickupMarker = L.marker(latlng, { draggable:true }).addTo(map).bindPopup("Pick-up");
    pickupMarker.on("dragend", ()=>{
      pickupText && (pickupText.textContent = fmt(pickupMarker.getLatLng()));
      updateNearestTexts();
      refreshTrikes();
      refreshRoute();
      persistState();
    });
  } else {
    pickupMarker.setLatLng(latlng);
  }

  pickupText && (pickupText.textContent = fmt(latlng));
  updateNearestTexts();
  refreshTrikes();
  refreshRoute();
  persistState();
}

function setDest(latlng){
  if(!destMarker){
    destMarker = L.marker(latlng, { draggable:true }).addTo(map).bindPopup("Destination");
    destMarker.on("dragend", ()=>{
      destText && (destText.textContent = fmt(destMarker.getLatLng()));
      updateNearestTexts();
      refreshRoute();
      persistState();
    });
  } else {
    destMarker.setLatLng(latlng);
  }

  destText && (destText.textContent = fmt(latlng));
  updateNearestTexts();
  refreshRoute();
  persistState();
}

clearBtn?.addEventListener("click", ()=>{
  if(pickupMarker){ map.removeLayer(pickupMarker); pickupMarker = null; }
  if(destMarker){ map.removeLayer(destMarker); destMarker = null; }

  pickupText && (pickupText.textContent = "Not set");
  destText && (destText.textContent = "Not set");
  pickupNearest && (pickupNearest.textContent = "—");
  destNearest && (destNearest.textContent = "—");
  fareText && (fareText.textContent = "—");

  clearRoute();
  stopTrikes();
  persistState();
});

// tap map: pickup first then destination
map.on("click", (e)=>{
  if(!pickupMarker) setPickup(e.latlng);
  else if(!destMarker) setDest(e.latlng);
  else setDest(e.latlng);
});

// ---------- combos ----------
function fillMunicipalities(){
  if(!muniSelect) return;
  muniSelect.innerHTML = "";
  Object.entries(MUNICIPALITIES).forEach(([key, val])=>{
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = val.name;
    muniSelect.appendChild(opt);
  });
}

function fillLandmarkSelect(selectEl, muniKey){
  const muni = MUNICIPALITIES[muniKey];
  if(!selectEl || !muni) return;
  selectEl.innerHTML = "";
  muni.landmarks.forEach(lm=>{
    const opt = document.createElement("option");
    opt.value = lm.id;
    opt.textContent = lm.name;
    selectEl.appendChild(opt);
  });
}

function findLandmark(muniKey, id){
  return MUNICIPALITIES[muniKey]?.landmarks?.find(x => x.id === id) || null;
}

function setMunicipality(muniKey){
  const muni = MUNICIPALITIES[muniKey];
  if(!muni) return;

  map.setView(muni.center, 13);

  fillLandmarkSelect(pickupSelect, muniKey);
  fillLandmarkSelect(destSelect, muniKey);

  // defaults
  if(pickupSelect?.options?.length) pickupSelect.selectedIndex = 0;
  if(destSelect?.options?.length) destSelect.selectedIndex = Math.min(1, destSelect.options.length - 1);

  const p = findLandmark(muniKey, pickupSelect?.value);
  const d = findLandmark(muniKey, destSelect?.value);

  if(p) setPickup({ lat: p.lat, lng: p.lng });
  if(d) setDest({ lat: d.lat, lng: d.lng });

  renderReviews();
  persistState();
}

muniSelect?.addEventListener("change", ()=> setMunicipality(muniSelect.value));

pickupSelect?.addEventListener("change", ()=>{
  const muniKey = muniSelect.value;
  const lm = findLandmark(muniKey, pickupSelect.value);
  if(lm){
    setPickup({ lat: lm.lat, lng: lm.lng });
    map.setView([lm.lat, lm.lng], 15);
  }
});

destSelect?.addEventListener("change", ()=>{
  const muniKey = muniSelect.value;
  const lm = findLandmark(muniKey, destSelect.value);
  if(lm){
    setDest({ lat: lm.lat, lng: lm.lng });
    map.setView([lm.lat, lm.lng], 15);
  }
});

// ---------- nearest landmark ----------
function haversineMeters(a, b){
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
  const aa = s1*s1 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*s2*s2;
  return 2*R*Math.asin(Math.sqrt(aa));
}

function nearestLandmarkName(muniKey, latlng){
  const list = MUNICIPALITIES[muniKey]?.landmarks || [];
  let best = null, bestD = Infinity;

  list.forEach(lm=>{
    const d = haversineMeters(
      { lat: latlng.lat, lng: latlng.lng },
      { lat: lm.lat, lng: lm.lng }
    );
    if(d < bestD){ bestD = d; best = lm; }
  });

  if(!best) return "—";
  return `${best.name} (${Math.round(bestD)}m)`;
}

function updateNearestTexts(){
  const muniKey = muniSelect?.value || "masinloc";

  if(pickupNearest){
    pickupNearest.textContent = pickupMarker
      ? nearestLandmarkName(muniKey, pickupMarker.getLatLng())
      : "—";
  }

  if(destNearest){
    destNearest.textContent = destMarker
      ? nearestLandmarkName(muniKey, destMarker.getLatLng())
      : "—";
  }
}

// ---------- route + fare ----------
let routeLine = null;
let lastRouteKm = null;

function clearRoute(){
  if(routeLine){
    map.removeLayer(routeLine);
    routeLine = null;
  }
  lastRouteKm = null;
  fareText && (fareText.textContent = "—");
}

function estimateFare(km){
  const baseFare = 20;
  const perKm    = 10;
  const minimum  = 20;
  return Math.round(Math.max(minimum, baseFare + km * perKm));
}

async function refreshRoute(){
  clearRoute();
  if(!pickupMarker || !destMarker) return;

  const a = pickupMarker.getLatLng();
  const b = destMarker.getLatLng();

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

    const coords = data.routes[0].geometry.coordinates.map(([lng,lat]) => [lat,lng]);
    routeLine = L.polyline(coords, { weight: 6, opacity: 0.85 }).addTo(map);

    const km = data.routes[0].distance / 1000;
    lastRouteKm = km;

    const fare = estimateFare(km);
    fareText && (fareText.textContent = `₱${fare} (est.)`);

    const min = Math.round(data.routes[0].duration / 60);
    setStatus(`Route: ${km.toFixed(2)} km • ~${min} min ✅`);

    map.fitBounds(routeLine.getBounds(), { padding: [30,30] });

    // if there's an active booking draft/searching, keep its fare updated
    if(activeBooking && ["draft","searching","assigned","in_trip"].includes(activeBooking.status)){
      activeBooking.km = km;
      activeBooking.fare = fare;
      activeBooking.updatedAt = nowTs();
      upsertBooking(activeBooking);
      renderBooking(activeBooking);
    }

    persistState();
  }catch(e){
    console.error(e);
    setStatus("Route error (check internet).");
  }
}

// ---------- tricycle simulation ----------
let trikeMarkers = [];
let trikeTimer = null;

function setTrikeCount(n){
  if(trikeCountEl) trikeCountEl.textContent = String(n);
}

function randomAround(center, meters){
  const lat = center.lat + ((Math.random()*2-1) * meters) / 111000;
  const lng = center.lng + ((Math.random()*2-1) * meters) / (111000 * Math.cos(center.lat * Math.PI/180));
  return { lat, lng };
}

function stopTrikes(){
  if(trikeTimer){ clearInterval(trikeTimer); trikeTimer = null; }
  trikeMarkers.forEach(m => map.removeLayer(m));
  trikeMarkers = [];
  setTrikeCount(0);
}

function refreshTrikes(){
  if(!pickupMarker){ stopTrikes(); return; }
  const center = pickupMarker.getLatLng();

  if(trikeMarkers.length === 0){
    const N = 6;
    for(let i=0;i<N;i++){
      const p = randomAround(center, 350);
      const m = L.circleMarker([p.lat,p.lng], { radius:7, weight:2 }).addTo(map);
      m.bindPopup(`Tricycle #${i+1}`);
      trikeMarkers.push(m);
    }
    setTrikeCount(trikeMarkers.length);
  }

  if(!trikeTimer){
    trikeTimer = setInterval(()=>{
      if(!pickupMarker) return;
      const c = pickupMarker.getLatLng();
      trikeMarkers.forEach(m=>{
        const cur = m.getLatLng();
        const target = randomAround(c, 250);
        m.setLatLng([
          cur.lat + (target.lat - cur.lat) * 0.25,
          cur.lng + (target.lng - cur.lng) * 0.25
        ]);
      });
    }, 1200);
  }
}

// ---------- SOS ----------
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
    alert("No location. Start GPS or set Pick-up.");
    return;
  }

  const mapLink = `https://maps.google.com/?q=${loc.lat},${loc.lng}`;
  const msg =
`🚨 SOS from E-TODA
User: ${sess.username || "Passenger"}
Location (${loc.source}): ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}
Link: ${mapLink}`;

  if(trusted?.mobile){
    window.location.href = `sms:${trusted.mobile}?body=${encodeURIComponent(msg)}`;
    return;
  }

  if(navigator.share){
    try{ await navigator.share({ title:"E-TODA SOS", text: msg }); return; }catch{}
  }

  try{
    await navigator.clipboard.writeText(msg);
    alert("SOS message copied. Paste to Messenger/SMS.");
  }catch{
    alert(msg);
  }
}
sosBtn?.addEventListener("click", shareSOS);

// ---------- persistence (NO auto-GPS) ----------
function persistState(){
  const muni = muniSelect?.value || "masinloc";
  const pickup = pickupMarker ? pickupMarker.getLatLng() : null;
  const dest   = destMarker ? destMarker.getLatLng() : null;

  saveState({
    muni,
    pickup: pickup ? { lat: pickup.lat, lng: pickup.lng } : null,
    dest: dest ? { lat: dest.lat, lng: dest.lng } : null,
    lastGps: lastLatLng ? { lat:lastLatLng[0], lng:lastLatLng[1], ts: nowTs() } : null
  });
}

function restoreState(){
  const st = loadState();
  if(!st) return;

  if(st.muni && MUNICIPALITIES[st.muni]){
    muniSelect.value = st.muni;
    fillLandmarkSelect(pickupSelect, st.muni);
    fillLandmarkSelect(destSelect, st.muni);
    map.setView(MUNICIPALITIES[st.muni].center, 13);
  }

  if(st.pickup) setPickup({ lat: st.pickup.lat, lng: st.pickup.lng });
  if(st.dest)   setDest({ lat: st.dest.lat, lng: st.dest.lng });

  if(st.lastGps) lastLatLng = [st.lastGps.lat, st.lastGps.lng];

  // IMPORTANT: no startTracking() here (prevents GPS auto popup)
}

// ---------- Reviews ----------
function renderReviews(){
  const muniKey = muniSelect?.value || "masinloc";
  const muniName = MUNICIPALITIES[muniKey]?.name || "this area";

  const all = getReviews();
  const only = all.filter(r => r.muni === muniKey);

  if(reviewCount) reviewCount.textContent = String(only.length);
  if(!reviewList) return;

  reviewList.innerHTML = "";
  if(only.length === 0){
    reviewList.innerHTML = `<div class="tiny">No reviews yet for ${muniName}.</div>`;
    return;
  }

  only.slice().reverse().forEach(r=>{
    const div = document.createElement("div");
    div.className = "reviewItem";
    div.innerHTML = `
      <div class="reviewTop">
        <div><b>${"★".repeat(r.stars)}${"☆".repeat(5-r.stars)}</b></div>
        <div class="reviewMeta">${r.user || "User"} • ${new Date(r.ts).toLocaleString()}</div>
      </div>
      <div class="reviewBody">${String(r.text||"").replace(/</g,"&lt;")}</div>
    `;
    reviewList.appendChild(div);
  });
}

addReviewBtn?.addEventListener("click", ()=>{
  const stars = Number(reviewStars?.value || 5);
  const text  = (reviewText?.value || "").trim();
  if(!text){
    alert("Write a review first.");
    return;
  }

  const muniKey = muniSelect?.value || "masinloc";
  const all = getReviews();

  all.push({
    id: "REV-" + nowTs(),
    muni: muniKey,
    stars,
    text,
    user: sess.username || "User",
    ts: nowTs()
  });

  setReviews(all);
  if(reviewText) reviewText.value = "";
  renderReviews();
});

// ---------- Booking (Angkas/JoyRide style, persistent) ----------
let activeBooking = null;
let bookingTimer = null;

function getActiveBooking(){
  const all = getBookings();
  return all.find(b =>
    b.userId === sess.uniqueId &&
    ["draft","searching","assigned","in_trip"].includes(b.status)
  ) || null;
}

function upsertBooking(b){
  const all = getBookings();
  const idx = all.findIndex(x => x.id === b.id);
  if(idx >= 0) all[idx] = b;
  else all.push(b);
  setBookings(all);
}

function renderBooking(b){
  if(!b){
    if(bookStatus) bookStatus.textContent = "NO BOOKING";
    if(bookDriver) bookDriver.textContent = "—";
    if(bookEta) bookEta.textContent = "—";
    if(bookFare) bookFare.textContent = fareText?.textContent || "—";
    if(bookMsg) bookMsg.textContent = "Set Pick-up & Destination first.";

    cancelRideBtn && (cancelRideBtn.disabled = true);
    startTripBtn && (startTripBtn.disabled = true);
    completeTripBtn && (completeTripBtn.disabled = true);
    return;
  }

  const label =
    b.status === "draft" ? "DRAFT" :
    b.status === "searching" ? "SEARCHING" :
    b.status === "assigned" ? "DRIVER ASSIGNED" :
    b.status === "in_trip" ? "IN TRIP" :
    (b.status || "—").toUpperCase();

  if(bookStatus) bookStatus.textContent = label;
  if(bookDriver) bookDriver.textContent = b.driver?.name ? `${b.driver.name} (${b.driver.plate || ""})` : "—";
  if(bookEta) bookEta.textContent = b.etaText || "—";
  if(bookFare) bookFare.textContent = b.fare ? `₱${b.fare}` : (fareText?.textContent || "—");
  if(bookMsg) bookMsg.textContent = b.message || "";

  cancelRideBtn && (cancelRideBtn.disabled = !["searching","assigned"].includes(b.status));
  startTripBtn && (startTripBtn.disabled = (b.status !== "assigned"));
  completeTripBtn && (completeTripBtn.disabled = (b.status !== "in_trip"));
}

function canRequest(){
  return !!(pickupMarker && destMarker && typeof lastRouteKm === "number");
}

function createDraftBooking(){
  if(!canRequest()) return null;

  const p = pickupMarker.getLatLng();
  const d = destMarker.getLatLng();

  const b = {
    id: "BKG-" + nowTs(),
    userId: sess.uniqueId,
    userName: sess.username || "Passenger",
    muni: muniSelect?.value || "masinloc",
    pickup: { lat:p.lat, lng:p.lng },
    dest: { lat:d.lat, lng:d.lng },
    km: Number(lastRouteKm || 0),
    fare: estimateFare(Number(lastRouteKm || 0)),
    status: "draft",
    createdAt: nowTs(),
    updatedAt: nowTs(),
    driver: null,
    etaText: "—",
    message: "Ready to request."
  };

  upsertBooking(b);
  return b;
}

function startSearching(b){
  b.status = "searching";
  b.updatedAt = nowTs();
  b.message = "Searching for nearby tricycles…";
  b.driver = null;
  b.etaText = "—";
  upsertBooking(b);
  activeBooking = b;
  renderBooking(b);

  // simulate assign after 2–4 seconds
  clearTimeout(bookingTimer);
  bookingTimer = setTimeout(()=>{
    const driver = {
      id: "DRV-" + Math.floor(Math.random()*9999),
      name: "Driver " + String.fromCharCode(65 + Math.floor(Math.random()*26)),
      plate: "ETODA-" + Math.floor(1000 + Math.random()*9000)
    };

    b.status = "assigned";
    b.driver = driver;
    b.etaText = (3 + Math.floor(Math.random()*6)) + " min";
    b.message = `✅ ${driver.name} accepted your request.`;
    b.updatedAt = nowTs();
    upsertBooking(b);
    renderBooking(b);
  }, 2000 + Math.floor(Math.random()*2000));
}

function cancelBooking(){
  if(!activeBooking) return;
  activeBooking.status = "cancelled";
  activeBooking.message = "Booking cancelled.";
  activeBooking.updatedAt = nowTs();
  upsertBooking(activeBooking);
  clearTimeout(bookingTimer);
  activeBooking = null;
  renderBooking(null);
}

function startTrip(){
  if(!activeBooking || activeBooking.status !== "assigned") return;
  activeBooking.status = "in_trip";
  activeBooking.message = "Trip started.";
  activeBooking.updatedAt = nowTs();
  upsertBooking(activeBooking);
  renderBooking(activeBooking);
}

function completeTrip(){
  if(!activeBooking || activeBooking.status !== "in_trip") return;
  activeBooking.status = "completed";
  activeBooking.message = "Trip completed. Thank you!";
  activeBooking.updatedAt = nowTs();
  upsertBooking(activeBooking);
  activeBooking = null;
  renderBooking(null);
}

function restoreBooking(){
  activeBooking = getActiveBooking();
  renderBooking(activeBooking);

  // If user closed tab while SEARCHING, continue assignment soon
  if(activeBooking && activeBooking.status === "searching"){
    startSearching(activeBooking);
  }
}

requestRideBtn?.addEventListener("click", ()=>{
  // if already has active booking, just show it (do NOT reset)
  const existing = getActiveBooking();
  if(existing){
    activeBooking = existing;
    renderBooking(activeBooking);
    return;
  }

  if(!canRequest()){
    alert("Set Pick-up and Destination first (wait for route).");
    return;
  }

  const b = createDraftBooking();
  if(!b){
    alert("Please set Pick-up and Destination first.");
    return;
  }
  startSearching(b);
});

cancelRideBtn?.addEventListener("click", cancelBooking);
startTripBtn?.addEventListener("click", startTrip);
completeTripBtn?.addEventListener("click", completeTrip);

// ---------- navigation ----------
backBtn?.addEventListener("click", ()=> window.location.href = "home.html");
centerBtn?.addEventListener("click", ()=>{
  if(lastLatLng) map.setView(lastLatLng, 16);
  else if(pickupMarker) map.setView(pickupMarker.getLatLng(), 15);
  else setStatus("No location yet. Start GPS or set pickup.");
});

// ---------- init ----------
(function init(){
  setStatus("Ready");
  setAccuracy(null);
  setTrikeCount(0);

  fillMunicipalities();

  // default
  muniSelect.value = "masinloc";
  setMunicipality("masinloc");

  // restore saved pins/lastgps/muni (NO GPS AUTO)
  restoreState();

  // keep good view
  if(lastLatLng) map.setView(lastLatLng, 16);
  else if(pickupMarker) map.setView(pickupMarker.getLatLng(), 15);

  // stop button starts disabled
  stopBtn && (stopBtn.disabled = true);
  startBtn && (startBtn.disabled = false);

  renderReviews();
  restoreBooking();
})();
