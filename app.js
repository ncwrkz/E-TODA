// Basic helpers
const $ = (s) => document.querySelector(s);

const APK_URL = "assets/etoda.apk";   // ✅ change if your APK is hosted elsewhere
const VERSION = "v1.0.0";            // ✅ set your app version
const UPDATED = "February 14, 2026"; // ✅ update when you upload a new build

$("#ver").textContent = VERSION;
$("#updated").textContent = UPDATED;
$("#year").textContent = new Date().getFullYear();

// Set download link
const dlBtn = $("#dlBtn");
dlBtn.href = APK_URL;

// Show file size (best effort)
(async function setSize(){
  try{
    const res = await fetch(APK_URL, { method: "HEAD" });
    const len = res.headers.get("content-length");
    if(len){
      const mb = (Number(len) / (1024*1024));
      $("#size").textContent = mb.toFixed(2) + " MB";
    } else {
      $("#size").textContent = "Unknown";
    }
  }catch{
    $("#size").textContent = "Unknown";
  }
})();

// Copy link button
$("#copyLink").addEventListener("click", async () => {
  try{
    const url = new URL(APK_URL, window.location.href).toString();
    await navigator.clipboard.writeText(url);
    $("#copyLink").textContent = "Copied!";
    setTimeout(()=> $("#copyLink").textContent = "Copy Link", 1200);
  }catch{
    alert("Copy failed. You can copy the link from the address bar.");
  }
});

// SHA-256 calculator (downloads the apk in browser then hashes it)
$("#calcHash").addEventListener("click", async () => {
  const out = $("#hashOut");
  const status = $("#hashStatus");
  status.className = "hashStatus";
  status.textContent = "";
  out.textContent = "Calculating...";

  try{
    const resp = await fetch(APK_URL);
    if(!resp.ok) throw new Error("Download failed");

    const buf = await resp.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);

    const hex = [...new Uint8Array(hash)]
      .map(b => b.toString(16).padStart(2,"0"))
      .join("");

    out.textContent = hex;

    const expected = ($("#expected").value || "").trim().toLowerCase();
    if(expected){
      if(expected === hex){
        status.className = "hashStatus good";
        status.textContent = "✅ Match — APK verified.";
      }else{
        status.className = "hashStatus bad";
        status.textContent = "❌ Mismatch — do not install this file.";
      }
    }else{
      status.textContent = "Paste the expected SHA-256 above to compare.";
    }
  }catch(e){
    out.textContent = "—";
    status.className = "hashStatus bad";
    status.textContent = "Error: " + (e?.message || "Unable to calculate hash.");
  }
});
