(() => {
  const EARTH_KM = 6371;
  const form = document.getElementById("finder");
  const queryInput = document.getElementById("query");
  const searchBtn = document.getElementById("searchBtn");
  const geoBtn = document.getElementById("geoBtn");
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");
  const winnerCode = document.getElementById("winnerCode");
  const winnerName = document.getElementById("winnerName");
  const winnerMeta = document.getElementById("winnerMeta");
  const fromLabel = document.getElementById("fromLabel");
  const regionList = document.getElementById("regionList");
  const miniMap = document.getElementById("miniMap");

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function haversineKm(a, b) {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 100) return `${km.toFixed(1)} km`;
    return `${Math.round(km).toLocaleString()} km`;
  }

  function parseCoordinates(raw) {
    const text = raw.trim();
    const match = text.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/
    );
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  }

  async function geocode(query) {
    const coords = parseCoordinates(query);
    if (coords) return coords;

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        // Nominatim requires a descriptive UA for non-browser clients;
        // browsers send their own. This helps when opened via file:// proxies.
      },
    });
    if (!res.ok) throw new Error("Geocoding request failed");
    const data = await res.json();
    if (!data.length) throw new Error(`No place found for “${query}”`);
    const hit = data[0];
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: hit.display_name,
    };
  }

  function rankRegions(origin) {
    return window.AZURE_REGIONS
      .map((region) => ({
        ...region,
        km: haversineKm(origin, region),
      }))
      .sort((a, b) => a.km - b.km);
  }

  function project(lat, lng) {
    const x = ((lng + 180) / 360) * 800;
    const y = ((90 - lat) / 180) * 400;
    return { x, y };
  }

  function drawMap(origin, ranked) {
    const closest = ranked[0];
    const o = project(origin.lat, origin.lng);
    const c = project(closest.lat, closest.lng);

    const dots = ranked
      .map((r, i) => {
        const p = project(r.lat, r.lng);
        const isTop = i === 0;
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isTop ? 5.5 : 3}" fill="${isTop ? "#d97706" : "#0f766e"}" opacity="${isTop ? 1 : 0.55}" />`;
      })
      .join("");

    miniMap.innerHTML = `
      <rect width="800" height="400" fill="#0b1412" />
      <g opacity="0.18" stroke="#99f6e4" stroke-width="1" fill="none">
        ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="0" y1="${i * 50}" x2="800" y2="${i * 50}" />`).join("")}
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="400" />`).join("")}
      </g>
      <line x1="${o.x}" y1="${o.y}" x2="${c.x}" y2="${c.y}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6 5" opacity="0.9" />
      ${dots}
      <circle cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" r="7" fill="#e8f0ea" stroke="#fbbf24" stroke-width="2.5" />
      <text x="20" y="28" fill="#99f6e4" font-family="IBM Plex Mono, monospace" font-size="13">you → ${closest.code}</text>
    `;
  }

  function render(origin, ranked) {
    const top = ranked[0];
    winnerCode.textContent = top.code;
    winnerName.textContent = `${top.name} · ${top.city}`;
    winnerMeta.textContent = `${formatDistance(top.km)} away`;
    fromLabel.textContent = origin.label;

    regionList.innerHTML = ranked
      .map((r, i) => {
        return `
          <li class="${i === 0 ? "top" : ""}">
            <span class="rank">${String(i + 1).padStart(2, "0")}</span>
            <div>
              <div class="code">${r.code}</div>
              <div class="place">${r.name} · ${r.city}</div>
            </div>
            <span class="dist">${formatDistance(r.km)}</span>
          </li>
        `;
      })
      .join("");

    drawMap(origin, ranked);
    resultEl.hidden = false;
  }

  function setBusy(busy, message = "") {
    searchBtn.disabled = busy;
    geoBtn.disabled = busy;
    statusEl.classList.toggle("error", false);
    statusEl.textContent = message;
  }

  function setError(message) {
    statusEl.classList.add("error");
    statusEl.textContent = message;
    searchBtn.disabled = false;
    geoBtn.disabled = false;
  }

  async function resolveAndRank(originPromise, pendingMessage) {
    try {
      setBusy(true, pendingMessage);
      const origin = await originPromise;
      const ranked = rankRegions(origin);
      render(origin, ranked);
      setBusy(false, `Matched ${ranked.length} regions.`);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = queryInput.value.trim();
    if (!q) return;
    resolveAndRank(geocode(q), "Resolving location…");
  });

  geoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    resolveAndRank(
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              label: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (device)`,
            });
          },
          () => reject(new Error("Could not read your location. Check browser permissions.")),
          { enableHighAccuracy: true, timeout: 12000 }
        );
      }),
      "Reading device location…"
    );
  });
})();
