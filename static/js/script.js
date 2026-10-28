// Wanderwise — Intelligent Travel Studio & Dashboard Client
const tripSourceInput = document.querySelector("#trip-source");
const tripDestInput = document.querySelector("#trip-destination");
const tripDaysSelect = document.querySelector("#trip-days");
const customDaysContainer = document.querySelector("#custom-days-container");
const tripCustomDaysInput = document.querySelector("#trip-custom-days");
const tripBudgetInput = document.querySelector("#trip-budget");
const tripTravelersSelect = document.querySelector("#trip-travelers");
const tripTypeSelect = document.querySelector("#trip-type");
const generatePlanBtn = document.querySelector("#btn-generate-plan");

// Hero Banner Elements
const heroBanner = document.querySelector("#destination-hero-banner");
const heroTitle = document.querySelector("#hero-title");
const heroSubtitle = document.querySelector("#hero-subtitle");
const heroRouteTag = document.querySelector("#hero-route-tag");
const heroWeatherTag = document.querySelector("#hero-weather-tag");
const heroDaysTag = document.querySelector("#hero-days-tag");
const heroBudgetTag = document.querySelector("#hero-budget-tag");
const heroTtsBtn = document.querySelector("#hero-tts-btn");
const heroPdfBtn = document.querySelector("#hero-pdf-btn");
const heroCopyBtn = document.querySelector("#hero-copy-btn");
const heroCompareBtn = document.querySelector("#hero-compare-btn");

// Dashboard Sub-Tabs
const dashTabs = document.querySelectorAll(".dash-tab");
const dashPanes = {
  "dash-schedule": document.querySelector("#dash-schedule"),
  "dash-map": document.querySelector("#dash-map"),
  "dash-packing": document.querySelector("#dash-packing"),
  "dash-weather": document.querySelector("#dash-weather"),
};
const itineraryStream = document.querySelector("#itinerary-cards-stream");

// Refine Studio
const refineInput = document.querySelector("#refine-input");
const refineSendBtn = document.querySelector("#refine-send-btn");
const micButton = document.querySelector("#mic-button");
const voiceStatus = document.querySelector("#voice-status");

// Topbar View Switcher
const btnViewPlanner = document.querySelector("#btn-view-planner");
const btnViewMap = document.querySelector("#btn-view-map");
const btnViewWeather = document.querySelector("#btn-view-weather");
const btnViewCompare = document.querySelector("#btn-view-compare");

// Modals
const compareModal = document.querySelector("#compare-modal");
const compareCloseBtn = document.querySelector("#compare-close-btn");
const compareCity1Input = document.querySelector("#compare-city-1");
const compareCity2Input = document.querySelector("#compare-city-2");
const btnRunCompare = document.querySelector("#btn-run-compare");
const compareResultArea = document.querySelector("#compare-result-area");

const authModal = document.querySelector("#auth-modal");
const authModalBtn = document.querySelector("#auth-modal-btn");
const authUserLabel = document.querySelector("#auth-user-label");
const modalCloseBtn = document.querySelector("#modal-close-btn");
const modalTabLogin = document.querySelector("#modal-tab-login");
const modalTabRegister = document.querySelector("#modal-tab-register");
const formLogin = document.querySelector("#form-login");
const formRegister = document.querySelector("#form-register");
const loginAlert = document.querySelector("#login-alert");
const registerAlert = document.querySelector("#register-alert");

// General Elements
const historyList = document.querySelector("#history-list");
const toastElement = document.querySelector("#toast");
const mobileMenuButton = document.querySelector("#mobile-menu");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");
const newTripBtn = document.querySelector("#new-chat");
const sidebarNewChat = document.querySelector("#sidebar-new-chat");
const clearHistoryBtn = document.querySelector("#clear-history");
const themeToggle = document.querySelector("#theme-toggle");
const themeToggleIcon = document.querySelector("#theme-toggle-icon");

// State
let conversationId = null;
let busy = false;
let toastTimer;
let currentUser = null;
let currentPlanText = "";

function setTheme(isDark, persist = false) {
  document.body.classList.toggle("dark-mode", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  if (themeToggle) {
    themeToggle.setAttribute("aria-label", label);
    themeToggle.setAttribute("title", label);
    themeToggle.setAttribute("aria-pressed", String(isDark));
  }
  if (themeToggleIcon) themeToggleIcon.textContent = isDark ? "☀" : "☾";

  if (persist) {
    try {
      localStorage.setItem("wanderwise-theme", isDark ? "dark" : "light");
    } catch (error) {
      console.warn("Unable to save theme preference:", error);
    }
  }
}

let isDarkTheme = false;
try {
  isDarkTheme = localStorage.getItem("wanderwise-theme") === "dark";
} catch (error) {
  console.warn("Unable to load theme preference:", error);
}
setTheme(isDarkTheme);
themeToggle?.addEventListener("click", () => {
  isDarkTheme = !isDarkTheme;
  setTheme(isDarkTheme, true);
});

// Voice & Media State
let speechRecognizer = null;
let isRecording = false;
let isSpeaking = false;

// GIS Map
let leafletMap = null;
let mapMarkersGroup = null;

// Destination Photography Map
const DESTINATION_PHOTOS = {
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80",
  manali: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80",
  jaipur: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80",
  kerala: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80",
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
  tokyo: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80",
  mumbai: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80",
  delhi: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80",
  pune: "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80",
  kolhapur: "https://images.unsplash.com/photo-1600100397608-f010f443b2fb?auto=format&fit=crop&w=1200&q=80",
  sangli: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
};

/* ==========================================================================
   Toast Notifications
   ========================================================================== */
function showToast(message) {
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("show"), 4500);
}

/* ==========================================================================
   Markdown Formatter
   ========================================================================== */
function formatMarkdown(text) {
  if (typeof window.marked !== "undefined" && typeof window.marked.parse === "function") {
    try {
      // Configure marked for best rendering
      window.marked.setOptions({
        breaks: true,       // Line breaks become <br>
        gfm: true,          // GitHub Flavored Markdown (tables, strikethrough)
        headerIds: false,   // No IDs on headings (cleaner HTML)
        mangle: false,
      });
      return window.marked.parse(text);
    } catch (e) {
      console.warn("Markdown error:", e);
    }
  }
  return text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function stripMarkdown(text) {
  return text.replace(/[#*`_~>[\]()]/g, " ").replace(/\s+/g, " ").trim();
}

function getSelectedDays() {
  if (tripDaysSelect && tripDaysSelect.value === "custom") {
    const val = parseInt(tripCustomDaysInput?.value, 10);
    return (val && val >= 1 && val <= 30) ? val : 3;
  }
  return parseInt(tripDaysSelect?.value, 10) || 3;
}

/* ==========================================================================
   1. Trip Generation & Dashboard Studio
   ========================================================================== */
async function generateCompleteTrip() {
  const source = tripSourceInput.value.trim() || "Pune";
  const destination = tripDestInput.value.trim();
  const days = getSelectedDays();
  const budget = tripBudgetInput.value.trim() || "₹25,000";
  const travelers = parseInt(tripTravelersSelect.value, 10) || 4;
  const tripType = tripTypeSelect.value;

  if (!destination) {
    showToast("Please enter a destination city.");
    tripDestInput.focus();
    return;
  }

  if (busy) return;
  setBusy(true);

  // Update Hero preview immediately
  updateHeroBanner(source, destination, days, budget, travelers);

  itineraryStream.innerHTML = `
    <div class="empty-dashboard-msg">
      <span class="empty-icon">✈️</span>
      <h3>Generating Your Travel Studio for ${escapeHtml(destination)}...</h3>
      <p>Consulting AI guide for complete ${days}-day itinerary, route options, weather, and packing checklist.</p>
    </div>
  `;

  const requestPrompt = (
    `Plan a comprehensive ${days}-day trip starting from '${source}' to '${destination}' ` +
    `for ${travelers} travelers with a total budget of ${budget}. Travel style/vibe: ${tripType}. ` +
    `MANDATORY: Provide a dedicated, complete schedule for ALL ${days} DAYS (Day 1, Day 2, through Day ${days}). ` +
    `Include: 1. Recommended route transit options from ${source} to ${destination} (Flight/Train/Bus/Road). ` +
    `2. Day-by-Day morning, afternoon, evening, and night schedule for each of the ${days} days with spot names, travel times, and famous local food. ` +
    `3. Essential packing checklist for ${destination}.`
  );

  const prefs = {
    source: source,
    destination: destination,
    days: days,
    budget: budget,
    travelers: travelers,
    trip_type: tripType,
  };

  try {
    const res = await api("/api/itinerary", {
      method: "POST",
      body: JSON.stringify({
        request: requestPrompt,
        conversation_id: conversationId,
        preferences: prefs,
      }),
    });

    conversationId = res.conversation_id;
    currentPlanText = res.itinerary;

    // Render formatted itinerary cards
    renderItineraryCards(currentPlanText);

    // Setup interactive packing checklist
    setupPackingChecklist(destination, tripType);

    // Fetch live weather
    fetchLiveWeather(destination);

    // Update GIS map with route & landmarks
    await setupInteractiveMap(source, destination);

    // Refresh history
    refreshHistory();

    showToast(`Trip to ${destination} is ready!`);
  } catch (err) {
    showToast(err.message || "Failed to generate plan.");
    itineraryStream.innerHTML = `<div class="empty-dashboard-msg"><span class="empty-icon">⚠️</span><h3>Generation Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  } finally {
    setBusy(false);
  }
}

function updateHeroBanner(source, destination, days, budget, travelers) {
  if (heroTitle) heroTitle.textContent = `${source} to ${destination} ${tripTypeSelect.value.split("&")[0]} Tour`;
  if (heroRouteTag) heroRouteTag.textContent = `🛫 ${source} ➔ 📍 ${destination}`;
  if (heroDaysTag) heroDaysTag.textContent = `📅 ${days} Days`;
  if (heroBudgetTag) heroBudgetTag.textContent = `💰 Total Budget: ${budget}`;

  // Set Background Image
  const normCity = destination.toLowerCase().trim();
  const photoUrl = DESTINATION_PHOTOS[normCity] || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80";
  if (heroBanner) heroBanner.style.backgroundImage = `url('${photoUrl}')`;
}

function renderItineraryCards(markdownText) {
  // Split the AI response into per-day sections at ## headings
  const sections = markdownText.split(/(?=^##\s)/m);

  const cards = sections.map((section) => {
    const trimmed = section.trim();
    if (!trimmed) return "";

    // Detect if this is a Day section
    const isDayCard = /^##\s*(Day\s*\d+|Transit|Route|Packing|Checklist)/i.test(trimmed);
    const cls = isDayCard ? "day-card day-card--styled" : "day-card day-card--intro";
    return `<div class="${cls}"><div class="itinerary-content">${formatMarkdown(trimmed)}</div></div>`;
  }).filter(Boolean);

  itineraryStream.innerHTML = cards.length
    ? cards.join("")
    : `<div class="day-card"><div class="itinerary-content">${formatMarkdown(markdownText)}</div></div>`;
}

function setBusy(val) {
  busy = val;
  if (generatePlanBtn) {
    generatePlanBtn.disabled = val;
    generatePlanBtn.innerHTML = val ? '<span>⏳ Planning Studio...</span>' : '<span class="btn-sparkle">✨</span><span>Generate Full Travel Studio</span>';
  }
  if (refineSendBtn) refineSendBtn.disabled = val;
}

/* ==========================================================================
   2. Interactive Packing Checklist (☑ / ☐)
   ========================================================================== */
const PACKING_PRESETS = {
  beach: [
    { cat: "Clothing & Swimwear", items: ["Swimwear / Beach shorts", "Light breathable cotton t-shirts", "Flip-flops & water sandals", "UV Sunglasses & sun hat"] },
    { cat: "Toiletries & Sun Care", items: ["SPF 50+ Broad Spectrum Sunscreen", "Aloe vera after-sun gel", "Mosquito & insect repellent", "Lip balm with SPF"] },
    { cat: "Gadgets & Accessories", items: ["Waterproof phone pouch", "Fast-charging Power bank", "Portable bluetooth speaker", "Quick-dry microfiber towel"] },
    { cat: "Travel Essentials", items: ["Government Photo ID / Driving license", "Cash for beach shacks & water sports", "First-aid kit & ORS sachets"] },
  ],
  mountain: [
    { cat: "Warm Clothing", items: ["Thermal innerwear (upper & lower)", "Heavy fleece / Down jacket", "Woolen caps, mufflers & gloves", "Trekking shoes with good grip"] },
    { cat: "Health & Skincare", items: ["Deep moisturizing cold cream", "SPF Lip butter", "Altitude sickness & motion pills", "Pain relief balm/spray"] },
    { cat: "Gear & Gadgets", items: ["Durable backpack with rain cover", "Insulated stainless steel thermos", "LED flashlight / headlamp", "Extra camera batteries"] },
    { cat: "Documents & Cash", items: ["Hotel booking printouts / permits", "Sufficient cash (limited hill ATMs)", "Personal medical identification"] },
  ],
  default: [
    { cat: "Clothing & Footwear", items: ["Comfortable casual travel outfits", "Cushioned walking sneakers", "Light evening jacket / shawl", "Extra pairs of cotton socks"] },
    { cat: "Toiletries & Hygiene", items: ["Toothbrush & travel paste", "Shampoo & pocket soap strips", "Hand sanitizer & sanitizing wipes"] },
    { cat: "Electronics", items: ["Mobile charger & multi-pin adapter", "High capacity power bank", "Noise-canceling earphones"] },
    { cat: "Documents & Essentials", items: ["Aadhaar / Driving License / Passport", "Debit/Credit cards & backup cash", "Offline digital tickets saved"] },
  ],
};

function setupPackingChecklist(destination, tripType) {
  const container = document.querySelector("#packing-categories-grid");
  if (!container) return;

  const isBeach = /beach|goa|kerala|bali|alibaug|gokarna/i.test(destination) || /beach/i.test(tripType);
  const isMountain = /manali|shimla|mountain|himalaya|kashmir|ooty|munnar|mahabaleshwar/i.test(destination) || /mountain/i.test(tripType);

  const data = isBeach ? PACKING_PRESETS.beach : isMountain ? PACKING_PRESETS.mountain : PACKING_PRESETS.default;

  container.innerHTML = "";
  data.forEach((group) => {
    const box = document.createElement("div");
    box.className = "pack-category-box";
    box.innerHTML = `<h4 class="pack-cat-title">📦 ${escapeHtml(group.cat)}</h4>`;

    group.items.forEach((item) => {
      const row = document.createElement("label");
      row.className = "pack-item-row";
      row.innerHTML = `
        <input type="checkbox" class="pack-chk">
        <span>${escapeHtml(item)}</span>
      `;
      const chk = row.querySelector(".pack-chk");
      chk.addEventListener("change", () => {
        row.classList.toggle("checked", chk.checked);
        updatePackingProgress();
      });
      box.append(row);
    });
    container.append(box);
  });

  updatePackingProgress();
}

function updatePackingProgress() {
  const allChk = document.querySelectorAll(".pack-chk");
  const checked = document.querySelectorAll(".pack-chk:checked");
  const count = allChk.length;
  const done = checked.length;
  const pct = count > 0 ? Math.round((done / count) * 100) : 0;

  const textEl = document.querySelector("#packing-progress-text");
  const fillEl = document.querySelector("#packing-progress-fill");
  if (textEl) textEl.textContent = `${done} of ${count} Packed (${pct}%)`;
  if (fillEl) fillEl.style.width = `${pct}%`;
}

/* ==========================================================================
   3. Live Destination Weather
   ========================================================================== */
async function fetchLiveWeather(city) {
  const weatherCity = document.querySelector("#weather-city");
  const weatherStatus = document.querySelector("#weather-status");
  const weatherTemperature = document.querySelector("#weather-temperature");
  const weatherCondition = document.querySelector("#weather-condition");
  const weatherHumidity = document.querySelector("#weather-humidity");
  const weatherWind = document.querySelector("#weather-wind");
  const weatherIcon = document.querySelector("#weather-icon");

  if (weatherCity) weatherCity.textContent = city;
  if (weatherStatus) weatherStatus.textContent = "Loading current conditions...";
  if (weatherTemperature) weatherTemperature.textContent = "--°C";
  if (weatherCondition) weatherCondition.textContent = "--";
  if (weatherHumidity) weatherHumidity.textContent = "--%";
  if (weatherWind) weatherWind.textContent = "-- km/h";

  try {
    const weather = await api(`/api/weather?city=${encodeURIComponent(city)}`);
    const condition = weather.condition.charAt(0).toUpperCase() + weather.condition.slice(1);
    if (weatherCity) weatherCity.textContent = weather.city;
    if (weatherStatus) weatherStatus.textContent = "Current weather";
    if (weatherTemperature) weatherTemperature.textContent = `${weather.temperature_c}°C`;
    if (weatherCondition) weatherCondition.textContent = condition;
    if (weatherHumidity) weatherHumidity.textContent = `${weather.humidity ?? "--"}%`;
    if (weatherWind) weatherWind.textContent = `${weather.wind_speed_kmh} km/h`;
    if (weatherIcon) weatherIcon.textContent = getWeatherIcon(weather.condition);
    if (heroWeatherTag) {
      heroWeatherTag.textContent = `🌤️ ${weather.temperature_c}°C · ${condition}`;
      heroWeatherTag.title = `${weather.city} · Humidity ${weather.humidity}% · Wind ${weather.wind_speed_kmh} km/h`;
    }
  } catch (error) {
    if (weatherStatus) weatherStatus.textContent = error.message;
    console.warn("Weather error:", error);
    showToast(error.message);
  }
}

function getWeatherIcon(condition) {
  const description = condition.toLowerCase();
  if (description.includes("thunder")) return "⛈️";
  if (description.includes("snow")) return "❄️";
  if (description.includes("rain") || description.includes("drizzle")) return "🌧️";
  if (description.includes("cloud")) return "☁️";
  if (description.includes("mist") || description.includes("fog") || description.includes("haze")) return "🌫️";
  return "☀️";
}

/* ==========================================================================
   4. Interactive Leaflet Route Map (Large, Full-Featured & Auto-Resizing)
   ========================================================================== */
const CITY_COORDS = {
  sangli: [16.8524, 74.5815],
  kolhapur: [16.7050, 74.2433],
  satara: [17.6805, 73.9997],
  solapur: [17.6599, 75.9064],
  pune: [18.5204, 73.8567],
  mumbai: [19.0760, 72.8777],
  nashik: [19.9975, 73.7898],
  aurangabad: [19.8762, 75.3433],
  "chhatrapati sambhajinagar": [19.8762, 75.3433],
  nagpur: [21.1458, 79.0882],
  ratnagiri: [16.9902, 73.3120],
  sindhudurg: [16.1178, 73.5594],
  goa: [15.2993, 74.1240],
  panaji: [15.4909, 73.8278],
  delhi: [28.6139, 77.2090],
  "new delhi": [28.6139, 77.2090],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  manali: [32.2396, 77.1887],
  shimla: [31.1048, 77.1734],
  jaipur: [26.9124, 75.7873],
  udaipur: [24.5854, 73.7125],
  kerala: [10.8505, 76.2711],
  kochi: [9.9312, 76.2673],
  munnar: [10.0889, 77.0595],
  hyderabad: [17.3850, 78.4867],
  chennai: [13.0827, 80.2707],
  ahmedabad: [23.0225, 72.5714],
  kolkata: [22.5726, 88.3639],
  paris: [48.8566, 2.3522],
  tokyo: [35.6762, 139.6503],
};

async function getCoordinates(cityName, fallbackCoord) {
  if (!cityName) return fallbackCoord;
  const norm = cityName.toLowerCase().trim();
  if (CITY_COORDS[norm]) return CITY_COORDS[norm];

  // Geocoding API fallback for any unlisted city
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (data && data.results && data.results.length > 0) {
      const coord = [data.results[0].latitude, data.results[0].longitude];
      CITY_COORDS[norm] = coord;
      return coord;
    }
  } catch (e) {
    console.warn("Geocoding failed for:", cityName, e);
  }
  return fallbackCoord;
}

function refreshMapSize() {
  if (!leafletMap) return;
  setTimeout(() => {
    leafletMap.invalidateSize(true);
    if (mapMarkersGroup && mapMarkersGroup.getLayers().length > 0) {
      try {
        leafletMap.fitBounds(mapMarkersGroup.getBounds(), { padding: [50, 50], maxZoom: 14 });
      } catch (e) {}
    }
  }, 100);

  setTimeout(() => {
    leafletMap.invalidateSize(true);
  }, 350);
}

async function setupInteractiveMap(sourceCity, destCity) {
  if (typeof window.L === "undefined") return;

  const mapEl = document.querySelector("#interactive-map");
  if (!mapEl) return;

  if (!leafletMap) {
    leafletMap = window.L.map("interactive-map", {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([16.0, 74.3], 7);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap contributors",
    }).addTo(leafletMap);

    mapMarkersGroup = window.L.featureGroup().addTo(leafletMap);
  }

  mapMarkersGroup.clearLayers();
  const pinsList = document.querySelector("#map-pins-list");
  if (pinsList) pinsList.innerHTML = "";

  const srcCoord = await getCoordinates(sourceCity, [16.8524, 74.5815]);
  const dstCoord = await getCoordinates(destCity, [15.2993, 74.1240]);

  // Source Marker
  const srcMarker = window.L.marker(srcCoord).addTo(mapMarkersGroup);
  srcMarker.bindPopup(`<b>🛫 Origin: ${escapeHtml(sourceCity)}</b><br>Trip Starting Point`);

  // Destination Marker
  const dstMarker = window.L.marker(dstCoord).addTo(mapMarkersGroup);
  dstMarker.bindPopup(`<b>📍 Destination: ${escapeHtml(destCity)}</b><br>Holiday & Exploration Base`).openPopup();

  // Route Polyline connector
  window.L.polyline([srcCoord, dstCoord], {
    color: "#2563eb",
    weight: 4,
    dashArray: "6, 8",
    opacity: 0.85,
  }).addTo(mapMarkersGroup);

  // Key attraction pins around destination
  const sampleSpots = [
    { title: "Famous Scenic Landmark", desc: "Must-visit sightseeing and photography hotspot", offset: [0.03, 0.03] },
    { title: "Culinary & Culture Hub", desc: "Authentic local food streets and shopping bazaar", offset: [-0.02, 0.04] },
    { title: "Sunset & Relaxation Point", desc: "Scenic viewpoint for sunset & serene evening vibes", offset: [0.04, -0.03] },
  ];

  sampleSpots.forEach((spot, i) => {
    const lat = dstCoord[0] + spot.offset[0];
    const lon = dstCoord[1] + spot.offset[1];
    const marker = window.L.marker([lat, lon]).addTo(mapMarkersGroup);
    marker.bindPopup(`<b>${spot.title}</b><br>${spot.desc}`);

    if (pinsList) {
      const card = document.createElement("div");
      card.className = "pin-card";
      card.innerHTML = `
        <div class="pin-badge">${i + 1}</div>
        <div class="pin-info">
          <h4 class="pin-name">${spot.title}</h4>
          <p class="pin-desc">${spot.desc}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        leafletMap.setView([lat, lon], 13);
        marker.openPopup();
      });
      pinsList.append(card);
    }
  });

  const titleInfo = document.querySelector("#map-title-info");
  if (titleInfo) titleInfo.textContent = `📍 Route: ${sourceCity} ➔ ${destCity}`;

  refreshMapSize();
}

document.querySelector("#dash-map-reset-btn")?.addEventListener("click", () => {
  if (leafletMap && mapMarkersGroup && mapMarkersGroup.getLayers().length > 0) {
    leafletMap.fitBounds(mapMarkersGroup.getBounds(), { padding: [50, 50] });
  }
});

/* ==========================================================================
   5. Compare Destinations Studio
   ========================================================================== */
btnRunCompare?.addEventListener("click", async () => {
  const city1 = compareCity1Input.value.trim() || "Goa";
  const city2 = compareCity2Input.value.trim() || "Kerala";
  const days = getSelectedDays();
  const budget = tripBudgetInput.value || "₹25,000";

  compareResultArea.innerHTML = `<p>Comparing <strong>${escapeHtml(city1)}</strong> and <strong>${escapeHtml(city2)}</strong>...</p>`;

  try {
    const res = await api("/api/compare", {
      method: "POST",
      body: JSON.stringify({ city1, city2, days, budget }),
    });
    compareResultArea.innerHTML = formatMarkdown(res.comparison);
  } catch (err) {
    compareResultArea.innerHTML = `<p style="color:red;">Error: ${escapeHtml(err.message)}</p>`;
  }
});

heroCompareBtn?.addEventListener("click", () => {
  if (compareCity1Input) compareCity1Input.value = tripDestInput.value.trim() || "Goa";
  if (compareModal) compareModal.classList.add("open");
});

compareCloseBtn?.addEventListener("click", () => compareModal?.classList.remove("open"));
compareModal?.addEventListener("click", (e) => {
  if (e.target === compareModal) compareModal.classList.remove("open");
});

/* ==========================================================================
   6. Text-to-Speech (Audio Guide)
   ========================================================================== */
heroTtsBtn?.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    showToast("Speech synthesis is not supported on this device.");
    return;
  }

  if (isSpeaking) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    heroTtsBtn.innerHTML = '<span>🔊</span> <span>Listen Audio Guide</span>';
    heroTtsBtn.classList.remove("speaking");
    return;
  }

  const clean = stripMarkdown(currentPlanText);
  if (!clean) {
    showToast("Please generate a trip plan first.");
    return;
  }

  const utter = new SpeechSynthesisUtterance(clean.substring(0, 800));
  utter.rate = 1.0;
  utter.lang = "en-US";

  utter.onstart = () => {
    isSpeaking = true;
    heroTtsBtn.innerHTML = '<span>⏹️</span> <span>Stop Audio Guide</span>';
    heroTtsBtn.classList.add("speaking");
  };

  utter.onend = () => {
    isSpeaking = false;
    heroTtsBtn.innerHTML = '<span>🔊</span> <span>Listen Audio Guide</span>';
    heroTtsBtn.classList.remove("speaking");
  };

  utter.onerror = () => {
    isSpeaking = false;
    heroTtsBtn.innerHTML = '<span>🔊</span> <span>Listen Audio Guide</span>';
    heroTtsBtn.classList.remove("speaking");
  };

  window.speechSynthesis.speak(utter);
});

/* ==========================================================================
   7. Export Travel Brochure (PDF)
   ========================================================================== */
heroPdfBtn?.addEventListener("click", () => {
  if (typeof window.html2pdf === "undefined") {
    showToast("PDF generator loading... please try again.");
    return;
  }

  if (!currentPlanText) {
    showToast("Please generate a trip plan first before exporting.");
    return;
  }

  const dest = tripDestInput.value.trim() || "Destination";
  const source = tripSourceInput.value.trim() || "Origin";
  const days = getSelectedDays();
  const budget = tripBudgetInput.value.trim() || "₹25,000";
  const travelers = tripTravelersSelect?.value || "4";
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  // Build a self-contained, fully-visible HTML for pdf rendering
  const printHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #1e293b; font-size: 13px; line-height: 1.7;">

      <!-- Header Banner -->
      <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white; padding: 28px 32px; border-radius: 14px; margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 600; opacity: 0.8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">✈ Wanderwise AI Travel Brochure</div>
        <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 800;">${escapeHtml(source)} → ${escapeHtml(dest)}</h1>
        <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; opacity: 0.9; margin-top: 10px;">
          <span>📅 ${days} Days</span>
          <span>💰 ${escapeHtml(budget)}</span>
          <span>👥 ${travelers} Travelers</span>
          <span>🗓 Generated: ${dateStr}</span>
        </div>
      </div>

      <!-- Itinerary Content -->
      <div style="padding: 0 4px;">
        ${formatMarkdown(currentPlanText)}
      </div>

      <!-- Footer -->
      <div style="margin-top: 32px; padding-top: 14px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 10.5px; color: #94a3b8;">
        Generated by <strong style="color: #2563eb;">Wanderwise AI Travel Planner</strong> · ${dateStr} · wanderwise.app
      </div>
    </div>

    <style>
      h1 { font-size: 20px; font-weight: 800; color: #1e3a8a; margin: 20px 0 10px; padding: 10px 14px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; }
      h2 { font-size: 16px; font-weight: 800; color: #1e3a8a; margin: 20px 0 8px; padding: 8px 14px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; }
      h3 { font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 12px 0 5px; padding: 6px 12px; background: #f8fafc; border-left: 3px solid #60a5fa; border-radius: 0 6px 6px 0; }
      h4 { font-size: 13px; font-weight: 700; color: #0f172a; margin: 8px 0 4px; }
      p { margin: 0 0 9px; color: #374151; }
      ul, ol { margin: 6px 0 10px 4px; padding-left: 18px; }
      li { margin-bottom: 3px; color: #374151; font-size: 12.5px; }
      strong { color: #1e293b; font-weight: 700; }
      em { color: #475569; }
      hr { border: none; border-top: 2px dashed #e2e8f0; margin: 16px 0; }
      blockquote { margin: 10px 0; padding: 8px 14px; border-left: 4px solid #60a5fa; background: #eff6ff; color: #1e40af; border-radius: 0 8px 8px 0; font-style: italic; font-size: 12.5px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11.5px; page-break-inside: avoid; }
      thead { background: #1e3a8a; color: white; }
      th { padding: 7px 10px; text-align: left; font-size: 11px; font-weight: 700; }
      td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #374151; vertical-align: top; }
      tr:nth-child(even) td { background: #f8fafc; }
    </style>
  `;

  // Create a visible off-screen container for html2pdf to capture
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed; left:-9999px; top:0; width:780px; background:white; padding:24px; z-index:-1;";
  wrapper.innerHTML = printHtml;
  document.body.appendChild(wrapper);

  const opt = {
    margin: [12, 12, 12, 12],
    filename: `Wanderwise-${dest}-Travel-Brochure.pdf`,
    image: { type: "jpeg", quality: 0.97 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  showToast("Generating PDF brochure...");
  window.html2pdf()
    .set(opt)
    .from(wrapper)
    .save()
    .then(() => {
      document.body.removeChild(wrapper);
      showToast(`PDF saved: Wanderwise-${dest}-Travel-Brochure.pdf ✓`);
    })
    .catch((err) => {
      document.body.removeChild(wrapper);
      showToast("PDF export failed. Please try again.");
      console.error("PDF error:", err);
    });
});

heroCopyBtn?.addEventListener("click", () => {
  if (!currentPlanText) return;
  navigator.clipboard.writeText(currentPlanText).then(() => {
    heroCopyBtn.innerHTML = '<span>✓</span> <span>Copied!</span>';
    setTimeout(() => (heroCopyBtn.innerHTML = '<span>📋</span> <span>Copy Plan</span>'), 2500);
  });
});

/* ==========================================================================
   8. Refine Studio & Voice Search
   ========================================================================== */
refineSendBtn?.addEventListener("click", () => {
  const query = refineInput.value.trim();
  if (!query) return;
  refinePlan(query);
});

refineInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    refineSendBtn.click();
  }
});

document.querySelectorAll(".refine-chip").forEach((btn) => {
  btn.addEventListener("click", () => refinePlan(btn.dataset.prompt));
});

async function refinePlan(instruction) {
  if (busy || !instruction) return;
  setBusy(true);
  refineInput.value = "";
  showToast("Customizing your trip plan...");

  try {
    const res = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: instruction,
        conversation_id: conversationId,
        preferences: { destination: tripDestInput.value.trim() },
      }),
    });

    currentPlanText += `\n\n---\n### 🌟 Refined Additions:\n${res.reply}`;
    renderItineraryCards(currentPlanText);
    showToast("Plan updated!");
  } catch (err) {
    showToast(err.message);
  } finally {
    setBusy(false);
  }
}

// Voice Speech-to-Text
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRec) {
  speechRecognizer = new SpeechRec();
  speechRecognizer.continuous = false;
  speechRecognizer.interimResults = true;

  speechRecognizer.onstart = () => {
    isRecording = true;
    micButton?.classList.add("listening");
    if (voiceStatus) {
      voiceStatus.textContent = "🎙️ Listening... Speak customization";
      voiceStatus.classList.add("active");
    }
  };

  speechRecognizer.onresult = (e) => {
    let t = "";
    for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
    if (refineInput) refineInput.value = t;
  };

  speechRecognizer.onend = () => {
    isRecording = false;
    micButton?.classList.remove("listening");
    if (voiceStatus) {
      voiceStatus.textContent = "";
      voiceStatus.classList.remove("active");
    }
  };
}

micButton?.addEventListener("click", () => {
  if (!speechRecognizer) {
    showToast("Voice recognition not supported in this browser.");
    return;
  }
  if (isRecording) speechRecognizer.stop();
  else speechRecognizer.start();
});

/* ==========================================================================
   9. Quick Route Chips & Tab Navigation
   ========================================================================== */
document.querySelectorAll(".quick-route-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    tripSourceInput.value = chip.dataset.src;
    tripDestInput.value = chip.dataset.dst;
    tripDaysSelect.value = chip.dataset.days;
    if (customDaysContainer) customDaysContainer.style.display = "none";
    tripBudgetInput.value = chip.dataset.budget;
    generateCompleteTrip();
  });
});

tripDaysSelect?.addEventListener("change", () => {
  if (tripDaysSelect.value === "custom") {
    if (customDaysContainer) customDaysContainer.style.display = "block";
    tripCustomDaysInput?.focus();
  } else {
    if (customDaysContainer) customDaysContainer.style.display = "none";
  }
  const days = getSelectedDays();
  if (heroDaysTag) heroDaysTag.textContent = `📅 ${days} Days`;
});

tripCustomDaysInput?.addEventListener("input", () => {
  const days = getSelectedDays();
  if (heroDaysTag) heroDaysTag.textContent = `📅 ${days} Days`;
});

dashTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.target;
    switchMainTab(target);
  });
});

// Topbar View Switcher
function setActiveTopbarView(activeButton) {
  [btnViewPlanner, btnViewMap, btnViewWeather].forEach((button) => {
    button?.classList.toggle("active", button === activeButton);
  });
}

btnViewPlanner?.addEventListener("click", () => {
  setActiveTopbarView(btnViewPlanner);
  switchMainTab("dash-schedule");
});
btnViewMap?.addEventListener("click", () => {
  setActiveTopbarView(btnViewMap);
  switchMainTab("dash-map");
});
btnViewWeather?.addEventListener("click", () => {
  setActiveTopbarView(btnViewWeather);
  switchMainTab("dash-weather");
  fetchLiveWeather(tripDestInput.value.trim() || "Goa");
});
btnViewCompare?.addEventListener("click", () => compareModal?.classList.add("open"));

function switchMainTab(targetId) {
  dashTabs.forEach((t) => {
    t.classList.toggle("active", t.dataset.target === targetId);
  });

  Object.keys(dashPanes).forEach((key) => {
    if (dashPanes[key]) {
      dashPanes[key].classList.toggle("active", key === targetId);
    }
  });

  if (targetId === "dash-map") {
    refreshMapSize();
  }
}

/* ==========================================================================
   10. SQLite Authentication
   ========================================================================== */
authModalBtn?.addEventListener("click", () => {
  if (currentUser) {
    if (confirm(`Logged in as ${currentUser.name}. Do you want to sign out?`)) logoutUser();
  } else {
    authModal?.classList.add("open");
  }
});

modalCloseBtn?.addEventListener("click", () => authModal?.classList.remove("open"));
modalTabLogin?.addEventListener("click", () => {
  modalTabLogin.classList.add("active");
  modalTabRegister.classList.remove("active");
  formLogin.classList.add("active");
  formRegister.classList.remove("active");
});
modalTabRegister?.addEventListener("click", () => {
  modalTabRegister.classList.add("active");
  modalTabLogin.classList.remove("active");
  formRegister.classList.add("active");
  formLogin.classList.remove("active");
});

formLogin?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (loginAlert) loginAlert.className = "form-alert";
  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#login-email").value.trim(),
        password: document.querySelector("#login-password").value,
      }),
    });
    currentUser = res.user;
    updateAuthUI();
    authModal?.classList.remove("open");
    showToast(`Welcome back, ${currentUser.name}!`);
    refreshHistory();
  } catch (err) {
    if (loginAlert) {
      loginAlert.className = "form-alert error";
      loginAlert.textContent = err.message;
    }
  }
});

formRegister?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (registerAlert) registerAlert.className = "form-alert";
  try {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#reg-name").value.trim(),
        email: document.querySelector("#reg-email").value.trim(),
        password: document.querySelector("#reg-password").value,
      }),
    });
    currentUser = res.user;
    updateAuthUI();
    authModal?.classList.remove("open");
    showToast(`Account created for ${currentUser.name}!`);
    refreshHistory();
  } catch (err) {
    if (registerAlert) {
      registerAlert.className = "form-alert error";
      registerAlert.textContent = err.message;
    }
  }
});

async function logoutUser() {
  await api("/api/auth/logout", { method: "POST" });
  currentUser = null;
  updateAuthUI();
  showToast("Logged out successfully.");
}

function updateAuthUI() {
  if (currentUser) {
    if (authUserLabel) authUserLabel.textContent = currentUser.name.split(" ")[0];
    authModalBtn?.classList.add("logged-in");
  } else {
    if (authUserLabel) authUserLabel.textContent = "Sign In";
    authModalBtn?.classList.remove("logged-in");
  }
}

async function checkAuth() {
  try {
    const res = await api("/api/auth/me");
    if (res.authenticated && res.user) {
      currentUser = res.user;
      updateAuthUI();
    }
  } catch (e) {}
}

/* ==========================================================================
   11. History & General
   ========================================================================== */
async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function refreshHistory() {
  try {
    const res = await api("/api/history");
    const list = res.conversations || [];
    if (!historyList) return;
    if (clearHistoryBtn) clearHistoryBtn.hidden = list.length === 0;
    historyList.innerHTML = "";
    if (!list.length) {
      historyList.innerHTML = '<p class="history-empty">Saved trips will be archived here.</p>';
      return;
    }
    list.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-item";
      btn.innerHTML = `<span>✈️</span> <span class="history-title">${escapeHtml(c.title || "Travel Plan")}</span>`;
      btn.addEventListener("click", () => loadHistoryTrip(c.id));
      historyList.append(btn);
    });
  } catch (e) {}
}

clearHistoryBtn?.addEventListener("click", async () => {
  if (!window.confirm("Clear all saved chat history? This cannot be undone.")) return;

  clearHistoryBtn.disabled = true;
  try {
    const res = await api("/api/history", { method: "DELETE" });
    conversationId = null;
    currentPlanText = "";
    if (itineraryStream) {
      itineraryStream.innerHTML = `
        <div class="empty-dashboard-msg">
          <span class="empty-icon">🗺️</span>
          <h3>Plan a New Adventure</h3>
          <p>Your saved chat history has been cleared. Start a new trip whenever you're ready.</p>
        </div>
      `;
    }
    if (historyList) {
      historyList.innerHTML = '<p class="history-empty">Saved trips will be archived here.</p>';
    }
    clearHistoryBtn.hidden = true;
    showToast(`${res.deleted} saved chat${res.deleted === 1 ? "" : "s"} cleared.`);
  } catch (error) {
    showToast(`Unable to clear chat history: ${error.message}`);
  } finally {
    clearHistoryBtn.disabled = false;
  }
});

async function loadHistoryTrip(id) {
  try {
    const res = await api(`/api/history?conversation_id=${encodeURIComponent(id)}`);
    conversationId = id;
    const msgs = res.messages || [];
    if (msgs.length > 0) {
      currentPlanText = msgs[msgs.length - 1].text;
      renderItineraryCards(currentPlanText);
    }
    const saved = res.conversation?.preferences || {};
    if (saved.source && tripSourceInput) tripSourceInput.value = saved.source;
    if (saved.destination && tripDestInput) tripDestInput.value = saved.destination;
    if (saved.budget && tripBudgetInput) tripBudgetInput.value = saved.budget;
    if (saved.days && tripDaysSelect) {
      const d = parseInt(saved.days, 10);
      const opt = tripDaysSelect.querySelector(`option[value="${d}"]`);
      if (opt) {
        tripDaysSelect.value = String(d);
        if (customDaysContainer) customDaysContainer.style.display = "none";
      } else {
        tripDaysSelect.value = "custom";
        if (customDaysContainer) customDaysContainer.style.display = "block";
        if (tripCustomDaysInput) tripCustomDaysInput.value = d;
      }
    }
    updateHeroBanner(saved.source || "Pune", saved.destination || "Goa", saved.days || 3, saved.budget || "₹25,000", saved.travelers || 4);
    if (saved.source && saved.destination) setupInteractiveMap(saved.source, saved.destination);
    closeSidebar();
  } catch (e) {}
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

mobileMenuButton?.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
sidebarBackdrop?.addEventListener("click", closeSidebar);

newTripBtn?.addEventListener("click", () => {
  conversationId = null;
  if (tripDestInput) tripDestInput.value = "";
  if (itineraryStream) {
    itineraryStream.innerHTML = `
      <div class="empty-dashboard-msg">
        <span class="empty-icon">🗺️</span>
        <h3>Plan a New Adventure</h3>
        <p>Enter your origin & destination above to build your travel studio dashboard.</p>
      </div>
    `;
  }
});
sidebarNewChat?.addEventListener("click", () => newTripBtn?.click());

generatePlanBtn?.addEventListener("click", generateCompleteTrip);

// Boot
checkAuth();
refreshHistory();
setupInteractiveMap("Sangli", "Goa");
setupPackingChecklist("Goa", "Beach");
updateHeroBanner("Sangli", "Goa", 3, "₹25,000", 4);
