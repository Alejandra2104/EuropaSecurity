'use strict';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const CATEGORIES = {
  airport: { label: 'Aeropuerto', icon: 'fa-plane', color: '#2563eb' },
  train: { label: 'Estación de tren', icon: 'fa-train-subway', color: '#7c3aed' },
  police: { label: 'Cuartel / comisaría', icon: 'fa-shield-halved', color: '#0f766e' },
  government: { label: 'Edificio gubernamental', icon: 'fa-building-columns', color: '#b45309' },
  embassy: { label: 'Embajada / consulado', icon: 'fa-flag', color: '#be123c' },
  education: { label: 'Centro educativo', icon: 'fa-school', color: '#4d7c0f' },
  shopping: { label: 'Centro comercial', icon: 'fa-cart-shopping', color: '#c2410c' },
  other: { label: 'Otro lugar', icon: 'fa-triangle-exclamation', color: '#475569' }
};

const STATUSES = {
  investigating: { label: 'En investigación', className: 'status-investigating' },
  evacuated: { label: 'Evacuación preventiva', className: 'status-evacuated' },
  hoax: { label: 'Falsa alarma', className: 'status-hoax' },
  confirmed: { label: 'Artefacto confirmado', className: 'status-confirmed' },
  cleared: { label: 'Normalizado', className: 'status-cleared' }
};

const DATA_URL = 'data/incidents.json';
const SOURCES_URL = 'data/sources.json';

const state = {
  incidents: [],
  sources: [],
  filters: { q: '', country: '', category: '', status: '', period: '180' },
  markers: new Map()
};

let map = null;
let clusterGroup = null;
let searchTimer = null;
const markerIconCache = new Map();

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeStyle: 'short'
});

const shortDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

const updatedFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateTimeFormatter.format(date);
}

function formatShortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : shortDateFormatter.format(date);
}

function normalizeIncident(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const date = new Date(raw.datetime);
  const source = raw.source && typeof raw.source === 'object' ? raw.source : {};
  const sourceUrl = typeof source.url === 'string' && /^https:\/\//i.test(source.url)
    ? source.url
    : '';

  return {
    id: String(raw.id || `${raw.country || 'xx'}-${lat}-${lon}`),
    country: String(raw.country || '').toUpperCase(),
    country_name: String(raw.country_name || raw.country || ''),
    locality: String(raw.locality || ''),
    place: String(raw.place || ''),
    lat,
    lon,
    category: CATEGORIES[raw.category] ? raw.category : 'other',
    datetime: raw.datetime,
    date: Number.isNaN(date.getTime()) ? null : date,
    status: STATUSES[raw.status] ? raw.status : 'investigating',
    summary: String(raw.summary || ''),
    demo: Boolean(raw.demo),
    verified: Boolean(raw.verified),
    source: {
      name: String(source.name || ''),
      url: sourceUrl,
      type: source.type === 'official' ? 'official' : 'other'
    }
  };
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  try {
    const [incidentsResponse, sourcesResponse] = await Promise.all([
      fetch(DATA_URL, { cache: 'no-cache' }),
      fetch(SOURCES_URL, { cache: 'no-cache' }).catch(() => null)
    ]);

    if (!incidentsResponse.ok) {
      throw new Error(`No se pudo cargar ${DATA_URL} (HTTP ${incidentsResponse.status})`);
    }

    const data = await incidentsResponse.json();
    state.incidents = (data.incidents || []).map(normalizeIncident).filter(Boolean);

    if (sourcesResponse && sourcesResponse.ok) {
      const sourcesData = await sourcesResponse.json();
      state.sources = sourcesData.countries || [];
    }

    setupMap();
    buildFilters();
    renderLegend();
    renderSources();
    renderMeta(data.meta || {});
    bindUI();
    applyFilters({ fit: true });
  } catch (error) {
    console.error(error);
    el('updated-at').textContent = 'Error al cargar';
    el('result-count').textContent = 'Error al cargar los datos';
    el('incident-list').innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <p><strong>No se pudieron cargar los datos.</strong></p>
        <p>Si has abierto el archivo directamente desde el disco, ejecuta un servidor local (por ejemplo <code>python -m http.server</code>).</p>
      </div>`;
  }
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

function setupMap() {
  map = L.map('map', {
    zoomControl: true,
    minZoom: 3,
    maxBounds: L.latLngBounds([[33, -25], [73, 45]]),
    maxBoundsViscosity: 0.6
  }).setView([50.2, 9.5], 4);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
  }).addTo(map);

  L.control.scale({ metric: true, imperial: false }).addTo(map);

  clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 42,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (cluster) => L.divIcon({
      className: 'incident-cluster',
      html: `<div class="cluster-inner">${cluster.getChildCount()}</div>`,
      iconSize: L.point(42, 42)
    })
  }).addTo(map);
}

function createMarkerIcon(category) {
  if (markerIconCache.has(category)) {
    return markerIconCache.get(category);
  }

  const cat = CATEGORIES[category] || CATEGORIES.other;
  const icon = L.divIcon({
    className: 'incident-marker',
    html: `<div class="marker-pin" style="--marker-color:${cat.color}"><i class="fa-solid ${cat.icon}" aria-hidden="true"></i></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30]
  });

  markerIconCache.set(category, icon);
  return icon;
}

function renderMap(incidents) {
  clusterGroup.clearLayers();
  state.markers.clear();

  incidents.forEach((incident) => {
    const marker = L.marker([incident.lat, incident.lon], {
      icon: createMarkerIcon(incident.category),
      title: incident.place,
      alt: `${incident.place}, ${incident.locality}`
    });

    marker.bindPopup(popupHtml(incident), {
      maxWidth: 330,
      minWidth: 250,
      autoPanPadding: [28, 28]
    });

    marker.on('click', () => highlightCard(incident.id));

    state.markers.set(incident.id, marker);
    clusterGroup.addLayer(marker);
  });
}

function fitTo(incidents) {
  if (!incidents.length) return;

  const bounds = L.latLngBounds(incidents.map((incident) => [incident.lat, incident.lon]));
  map.fitBounds(bounds, { padding: [44, 44], maxZoom: 6 });
}

function focusIncident(id) {
  const incident = state.incidents.find((item) => item.id === id);
  const marker = state.markers.get(id);
  if (!incident || !marker) return;

  if (window.innerWidth <= 900) {
    document.querySelector('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  highlightCard(id);

  if (map.getZoom() < 10) {
    map.flyTo([incident.lat, incident.lon], 12, { duration: 0.7 });
  }

  clusterGroup.zoomToShowLayer(marker, () => marker.openPopup());
}

/* ------------------------------------------------------------------ */
/* Popup                                                               */
/* ------------------------------------------------------------------ */

function popupHtml(incident) {
  const cat = CATEGORIES[incident.category] || CATEGORIES.other;
  const status = STATUSES[incident.status] || STATUSES.investigating;
  const source = incident.source;
  const sourceLink = source.url
    ? `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
         <i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
         ${escapeHtml(source.name || 'Fuente oficial')}
       </a>`
    : '<span class="source-missing"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Sin enlace de fuente oficial</span>';

  return `
    <article class="popup">
      <div class="popup-head">
        <span class="popup-icon" style="--marker-color:${cat.color}">
          <i class="fa-solid ${cat.icon}" aria-hidden="true"></i>
        </span>
        <div>
          <p class="popup-category">${escapeHtml(cat.label)}</p>
          <h3>${escapeHtml(incident.place)}</h3>
        </div>
      </div>
      <p class="popup-locality">
        <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
        ${escapeHtml(incident.locality)} · ${escapeHtml(incident.country_name || incident.country)}
      </p>
      <p class="popup-date">
        <i class="fa-regular fa-clock" aria-hidden="true"></i>
        ${escapeHtml(formatDateTime(incident.datetime))}
      </p>
      <p class="popup-summary">${escapeHtml(incident.summary)}</p>
      <div class="popup-badges">
        <span class="badge ${status.className}">${escapeHtml(status.label)}</span>
        ${source.type === 'official' ? '<span class="badge badge-official"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Fuente oficial</span>' : ''}
        ${incident.demo ? '<span class="badge badge-demo">Ejemplo ficticio</span>' : ''}
      </div>
      ${sourceLink}
    </article>`;
}

/* ------------------------------------------------------------------ */
/* Filters & list                                                      */
/* ------------------------------------------------------------------ */

function buildFilters() {
  const countrySelect = el('filter-country');
  const countries = Array.from(
    new Map(state.incidents.map((incident) => [incident.country, incident.country_name || incident.country])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], 'es'));

  countrySelect.innerHTML = '<option value="">Todos los países</option>' +
    countries.map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`).join('');

  el('filter-category').innerHTML = '<option value="">Todos los tipos</option>' +
    Object.entries(CATEGORIES).map(([key, cat]) => `<option value="${key}">${escapeHtml(cat.label)}</option>`).join('');

  el('filter-status').innerHTML = '<option value="">Todos los estados</option>' +
    Object.entries(STATUSES).map(([key, status]) => `<option value="${key}">${escapeHtml(status.label)}</option>`).join('');
}

function renderLegend() {
  el('legend').innerHTML = `
    <h2>Tipos de lugar</h2>
    <ul>
      ${Object.values(CATEGORIES).map((cat) => `
        <li>
          <span class="legend-dot" style="--marker-color:${cat.color}"><i class="fa-solid ${cat.icon}" aria-hidden="true"></i></span>
          ${escapeHtml(cat.label)}
        </li>`).join('')}
    </ul>`;
}

function getFilteredIncidents() {
  const { q, country, category, status, period } = state.filters;
  const query = q.trim().toLowerCase();
  const cutoff = period === 'all' ? null : Date.now() - Number(period) * 86400000;

  return state.incidents
    .filter((incident) => !country || incident.country === country)
    .filter((incident) => !category || incident.category === category)
    .filter((incident) => !status || incident.status === status)
    .filter((incident) => {
      if (!cutoff) return true;
      return incident.date ? incident.date.getTime() >= cutoff : false;
    })
    .filter((incident) => {
      if (!query) return true;
      const haystack = [
        incident.locality,
        incident.place,
        incident.country_name,
        incident.summary,
        CATEGORIES[incident.category].label
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date - a.date;
    });
}

function applyFilters(options = {}) {
  const incidents = getFilteredIncidents();

  renderMap(incidents);
  renderList(incidents);

  const countryCount = new Set(incidents.map((incident) => incident.country).filter(Boolean)).size;
  const incidentLabel = incidents.length === 1 ? 'aviso' : 'avisos';
  const countryLabel = countryCount === 1 ? 'país' : 'países';
  el('result-count').textContent = `${incidents.length} ${incidentLabel} · ${countryCount} ${countryLabel}`;

  el('map-empty').hidden = incidents.length !== 0;

  if (options.fit) {
    fitTo(incidents);
  }
}

function renderList(incidents) {
  const list = el('incident-list');

  if (!incidents.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <p>No hay avisos que coincidan con los filtros.</p>
      </div>`;
    return;
  }

  list.innerHTML = incidents.map((incident) => {
    const cat = CATEGORIES[incident.category] || CATEGORIES.other;
    const status = STATUSES[incident.status] || STATUSES.investigating;

    return `
      <button type="button" class="incident-card" data-incident-id="${escapeHtml(incident.id)}">
        <span class="card-icon" style="--marker-color:${cat.color}">
          <i class="fa-solid ${cat.icon}" aria-hidden="true"></i>
        </span>
        <span class="card-body">
          <span class="card-top">
            <strong>${escapeHtml(incident.locality)}</strong>
            <span class="badge ${status.className}">${escapeHtml(status.label)}</span>
          </span>
          <span class="card-place">${escapeHtml(incident.place)}</span>
          <span class="card-meta">${escapeHtml(formatShortDate(incident.datetime))} · ${escapeHtml(incident.country_name || incident.country)}</span>
        </span>
      </button>`;
  }).join('');
}

function highlightCard(id) {
  document.querySelectorAll('.incident-card.is-active').forEach((card) => card.classList.remove('is-active'));

  const card = Array.from(document.querySelectorAll('.incident-card'))
    .find((item) => item.dataset.incidentId === id);

  if (!card) return;

  card.classList.add('is-active');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ------------------------------------------------------------------ */
/* Meta & sources                                                      */
/* ------------------------------------------------------------------ */

function renderMeta(meta) {
  const updated = meta.updated_at ? new Date(meta.updated_at) : null;
  const updatedText = updated && !Number.isNaN(updated.getTime())
    ? updatedFormatter.format(updated)
    : 'sin fecha';

  el('updated-at').innerHTML = `<i class="fa-regular fa-clock" aria-hidden="true"></i> Actualizado: ${escapeHtml(updatedText)}`;
  el('demo-banner').hidden = !meta.demo;

  if (meta.demo) {
    document.title = 'DEMO · EuropaSecurity · Avisos de bomba en Europa';
  }
}

function renderSources() {
  const container = el('sources-list');

  if (!state.sources.length) {
    container.innerHTML = '<p class="muted">No se pudo cargar el catálogo de fuentes.</p>';
    return;
  }

  container.innerHTML = state.sources.map((country) => `
    <details class="source-country">
      <summary>${escapeHtml(country.name)} <span class="muted">(${country.sources.length})</span></summary>
      <ul>
        ${country.sources.map((source) => `
          <li>
            <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a>
            ${source.scope ? `<span class="muted"> · ${escapeHtml(source.scope)}</span>` : ''}
          </li>`).join('')}
      </ul>
    </details>`).join('');
}

/* ------------------------------------------------------------------ */
/* UI events                                                           */
/* ------------------------------------------------------------------ */

function bindUI() {
  const search = el('search');

  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.q = search.value;
      applyFilters({ fit: true });
    }, 180);
  });

  el('filter-country').addEventListener('change', (event) => {
    state.filters.country = event.target.value;
    applyFilters({ fit: true });
  });

  el('filter-category').addEventListener('change', (event) => {
    state.filters.category = event.target.value;
    applyFilters({ fit: true });
  });

  el('filter-status').addEventListener('change', (event) => {
    state.filters.status = event.target.value;
    applyFilters({ fit: true });
  });

  el('filter-period').addEventListener('change', (event) => {
    state.filters.period = event.target.value;
    applyFilters({ fit: true });
  });

  el('reset-filters').addEventListener('click', () => {
    state.filters = { q: '', country: '', category: '', status: '', period: '180' };
    search.value = '';
    el('filter-country').value = '';
    el('filter-category').value = '';
    el('filter-status').value = '';
    el('filter-period').value = '180';
    applyFilters({ fit: true });
  });

  el('incident-list').addEventListener('click', (event) => {
    const card = event.target.closest('[data-incident-id]');
    if (!card) return;
    focusIncident(card.dataset.incidentId);
  });

  const modal = el('methodology-modal');
  const openModal = () => {
    modal.hidden = false;
    document.body.classList.add('modal-open');
    modal.querySelector('.modal-close').focus();
  };
  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    el('open-methodology').focus();
  };

  el('open-methodology').addEventListener('click', openModal);
  modal.querySelectorAll('[data-close]').forEach((node) => node.addEventListener('click', closeModal));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });
}

/* ------------------------------------------------------------------ */

init();
