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
  investigating: {
    label: 'En investigación',
    className: 'status-investigating',
    outcome: 'pending',
    icon: 'fa-magnifying-glass'
  },
  evacuated: {
    label: 'Evacuación preventiva',
    className: 'status-evacuated',
    outcome: 'pending',
    icon: 'fa-person-running'
  },
  hoax: {
    label: 'Falsa alarma',
    className: 'status-hoax',
    outcome: 'false',
    icon: 'fa-ban'
  },
  confirmed: {
    label: 'Artefacto confirmado',
    className: 'status-confirmed',
    outcome: 'real',
    icon: 'fa-bomb'
  },
  cleared: {
    label: 'Sin riesgo tras inspección',
    className: 'status-cleared',
    outcome: 'false',
    icon: 'fa-shield-halved'
  }
};

const OUTCOMES = {
  false: {
    label: 'Falsas o descartadas',
    short: 'Falsas/descartadas',
    className: 'outcome-false',
    color: '#2563eb',
    icon: 'fa-ban',
    description: 'Avisos declarados falsos o descartados tras la inspección.'
  },
  real: {
    label: 'Reales confirmadas',
    short: 'Reales',
    className: 'outcome-real',
    color: '#b91c1c',
    icon: 'fa-bomb',
    description: 'Artefacto explosivo real confirmado.'
  },
  pending: {
    label: 'Sin confirmar',
    short: 'Pendientes',
    className: 'outcome-pending',
    color: '#b45309',
    icon: 'fa-hourglass-half',
    description: 'Avisos en investigación o con resultado no publicado.'
  }
};

const SOURCE_TYPES = {
  police: {
    label: 'Nota de policía',
    short: 'Policía',
    className: 'badge-police',
    icon: 'fa-shield-halved'
  },
  official: {
    label: 'Fuente oficial',
    short: 'Oficial',
    className: 'badge-official',
    icon: 'fa-circle-check'
  },
  official_statement: {
    label: 'Declaración oficial',
    short: 'Declaración',
    className: 'badge-official-statement',
    icon: 'fa-bullhorn'
  },
  press: {
    label: 'Nota de prensa',
    short: 'Prensa',
    className: 'badge-press',
    icon: 'fa-newspaper'
  }
};

const CONFIDENCE = {
  confirmado: { label: 'Confirmado', className: 'confidence-confirmado' },
  indicios: { label: 'Indicios', className: 'confidence-indicios' },
  hipotesis: { label: 'Hipótesis', className: 'confidence-hipotesis' },
  separado: { label: 'Caso separado', className: 'confidence-separado' }
};

const DATA_URL = 'data/incidents.json';
const SOURCES_URL = 'data/sources.json';
const ANALYSIS_URL = 'data/analysis.json';

const state = {
  incidents: [],
  sources: [],
  analysis: null,
  filters: { q: '', country: '', category: '', status: '', source: '', outcome: '', period: '180' },
  markers: new Map()
};

let map = null;
let clusterGroup = null;
let searchTimer = null;
let lastModalTrigger = null;
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

const dateOnlyFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long'
});

const shortDateOnlyFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short'
});

const monthFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'short'
});

const updatedFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const percentFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1
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

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatDateTime(value, precision = 'exact') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  if (precision === 'day') return dateOnlyFormatter.format(date);
  const formatted = dateTimeFormatter.format(date);
  return precision === 'approximate' ? `${formatted} (hora aproximada)` : formatted;
}

function formatShortDate(value, precision = 'exact') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  if (precision === 'day') return shortDateOnlyFormatter.format(date);
  const formatted = shortDateFormatter.format(date);
  return precision === 'approximate' ? `~${formatted}` : formatted;
}

function formatSourceDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return shortDateOnlyFormatter.format(date);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0 %';
  return `${percentFormatter.format(value)} %`;
}

function formatCount(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function normalizeSource(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const url = typeof raw.url === 'string' && /^https:\/\//i.test(raw.url)
    ? raw.url
    : '';
  const type = SOURCE_TYPES[raw.type] ? raw.type : 'press';

  return {
    name: String(raw.name || ''),
    url,
    type,
    date: String(raw.date || ''),
    note: String(raw.note || '')
  };
}

function normalizeIncident(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const date = new Date(raw.datetime);
  const timePrecision = ['exact', 'approximate', 'day'].includes(raw.time_precision)
    ? raw.time_precision
    : 'exact';

  const sources = (Array.isArray(raw.sources) ? raw.sources : [])
    .map(normalizeSource)
    .filter(Boolean);

  const primarySource = normalizeSource(raw.source);
  if (primarySource && !sources.some((source) => source.url && source.url === primarySource.url)) {
    sources.unshift(primarySource);
  }

  const status = STATUSES[raw.status] ? raw.status : 'investigating';
  const outcome = STATUSES[status].outcome;

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
    time_precision: timePrecision,
    date: Number.isNaN(date.getTime()) ? null : date,
    status,
    outcome,
    summary: String(raw.summary || ''),
    demo: Boolean(raw.demo),
    verified: Boolean(raw.verified),
    sources,
    source: sources[0] || { name: '', url: '', type: 'press', date: '', note: '' }
  };
}

function sourceBadge(type) {
  const sourceType = SOURCE_TYPES[type] || SOURCE_TYPES.press;
  return `<span class="badge ${sourceType.className}"><i class="fa-solid ${sourceType.icon}" aria-hidden="true"></i> ${escapeHtml(sourceType.label)}</span>`;
}

function sourceSummary(incident) {
  if (!incident.sources.length) return 'Sin fuentes enlazadas';
  const types = unique(incident.sources.map((source) => (SOURCE_TYPES[source.type] || SOURCE_TYPES.press).short));
  return `${formatCount(incident.sources.length, 'fuente', 'fuentes')} · ${types.join(', ')}`;
}

function outcomeDetail(incident) {
  switch (incident.status) {
    case 'hoax':
      return 'Amenaza declarada falsa; no se hallaron explosivos.';
    case 'cleared':
      return 'Inspección finalizada sin riesgo; no se hallaron explosivos.';
    case 'confirmed':
      return 'Artefacto explosivo real confirmado.';
    case 'evacuated':
      return 'Evacuación preventiva; resultado pendiente.';
    default:
      return 'Investigación abierta; resultado pendiente.';
  }
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  try {
    const [incidentsResponse, sourcesResponse, analysisResponse] = await Promise.all([
      fetch(DATA_URL, { cache: 'no-cache' }),
      fetch(SOURCES_URL, { cache: 'no-cache' }).catch(() => null),
      fetch(ANALYSIS_URL, { cache: 'no-cache' }).catch(() => null)
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

    if (analysisResponse && analysisResponse.ok) {
      state.analysis = await analysisResponse.json();
    }

    setupMap();
    buildFilters();
    renderLegend();
    renderSources();
    renderMeta(data.meta || {});
    renderAnalysisProfile();
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

function createMarkerIcon(category, outcome) {
  const key = `${category}:${outcome}`;
  if (markerIconCache.has(key)) {
    return markerIconCache.get(key);
  }

  const cat = CATEGORIES[category] || CATEGORIES.other;
  const status = OUTCOMES[outcome] || OUTCOMES.pending;
  const icon = L.divIcon({
    className: 'incident-marker',
    html: `<div class="marker-pin ${status.className}" style="--marker-color:${cat.color}">
        <i class="fa-solid ${cat.icon}" aria-hidden="true"></i>
        <span class="marker-status-dot ${status.className}" title="${escapeHtml(status.label)}"></span>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30]
  });

  markerIconCache.set(key, icon);
  return icon;
}

function renderMap(incidents) {
  clusterGroup.clearLayers();
  state.markers.clear();

  incidents.forEach((incident) => {
    const marker = L.marker([incident.lat, incident.lon], {
      icon: createMarkerIcon(incident.category, incident.outcome),
      title: incident.place,
      alt: `${incident.place}, ${incident.locality}`
    });

    marker.bindPopup(popupHtml(incident), {
      maxWidth: 340,
      minWidth: 260,
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

function sourceListHtml(sources) {
  if (!sources.length) {
    return '<span class="source-missing"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Sin enlace de fuente</span>';
  }

  return `<ul class="source-list">
    ${sources.map((source) => {
      const type = SOURCE_TYPES[source.type] || SOURCE_TYPES.press;
      const name = escapeHtml(source.name || type.label);
      const link = source.url
        ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${name}</a>`
        : `<span>${name}</span>`;
      return `<li class="source-item">
        <span class="badge ${type.className}"><i class="fa-solid ${type.icon}" aria-hidden="true"></i> ${escapeHtml(type.short)}</span>
        ${link}
        ${source.note ? `<span class="source-meta">${escapeHtml(source.note)}</span>` : ''}
      </li>`;
    }).join('')}
  </ul>`;
}

function popupHtml(incident) {
  const cat = CATEGORIES[incident.category] || CATEGORIES.other;
  const status = STATUSES[incident.status] || STATUSES.investigating;
  const outcome = OUTCOMES[incident.outcome] || OUTCOMES.pending;

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
        ${escapeHtml(formatDateTime(incident.datetime, incident.time_precision))}
      </p>
      <div class="popup-outcome ${outcome.className}">
        <i class="fa-solid ${outcome.icon}" aria-hidden="true"></i>
        <span><strong>${escapeHtml(status.label)}</strong> · ${escapeHtml(outcomeDetail(incident))}</span>
      </div>
      <p class="popup-summary">${escapeHtml(incident.summary)}</p>
      <div class="popup-badges">
        <span class="badge ${status.className}"><i class="fa-solid ${status.icon}" aria-hidden="true"></i> ${escapeHtml(status.label)}</span>
        ${incident.demo ? '<span class="badge badge-demo">Ejemplo ficticio</span>' : ''}
      </div>
      <div class="popup-sources">
        <p class="popup-sources-title">Notas y fuentes (${incident.sources.length})</p>
        ${sourceListHtml(incident.sources)}
      </div>
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

  el('filter-source').innerHTML = '<option value="">Todas las fuentes</option>' +
    Object.entries(SOURCE_TYPES).map(([key, type]) => `<option value="${key}">${escapeHtml(type.label)}</option>`).join('');
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
    </ul>
    <h2 class="legend-subtitle">Resultado</h2>
    <ul>
      <li><span class="legend-dot outcome-false"><i class="fa-solid fa-ban" aria-hidden="true"></i></span> Falsas o descartadas</li>
      <li><span class="legend-dot outcome-real"><i class="fa-solid fa-bomb" aria-hidden="true"></i></span> Reales confirmadas</li>
      <li><span class="legend-dot outcome-pending"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i></span> Pendientes</li>
    </ul>`;
}

function getFilteredIncidents(options = {}) {
  const { q, country, category, status, source, outcome, period } = state.filters;
  const query = q.trim().toLowerCase();
  const cutoff = period === 'all' ? null : Date.now() - Number(period) * 86400000;

  return state.incidents
    .filter((incident) => !country || incident.country === country)
    .filter((incident) => !category || incident.category === category)
    .filter((incident) => !status || incident.status === status)
    .filter((incident) => options.ignoreOutcome || !outcome || incident.outcome === outcome)
    .filter((incident) => !source || incident.sources.some((item) => item.type === source))
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
        CATEGORIES[incident.category].label,
        STATUSES[incident.status].label,
        OUTCOMES[incident.outcome].label,
        incident.sources.map((item) => `${item.name} ${(SOURCE_TYPES[item.type] || SOURCE_TYPES.press).label}`).join(' ')
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

function computeStats(incidents) {
  const byStatus = { investigating: 0, evacuated: 0, hoax: 0, confirmed: 0, cleared: 0 };

  incidents.forEach((incident) => {
    if (byStatus[incident.status] == null) {
      byStatus.investigating += 1;
      return;
    }
    byStatus[incident.status] += 1;
  });

  const total = incidents.length;
  const pending = byStatus.investigating + byStatus.evacuated;
  const falseOrCleared = byStatus.hoax + byStatus.cleared;
  const real = byStatus.confirmed;
  const resolved = falseOrCleared + real;

  return {
    total,
    byStatus,
    pending,
    falseOrCleared,
    real,
    resolved,
    falseShare: resolved ? (falseOrCleared / resolved) * 100 : 0,
    realShare: resolved ? (real / resolved) * 100 : 0
  };
}

function renderOutcomeChips(stats) {
  const counts = {
    '': stats.total,
    false: stats.falseOrCleared,
    real: stats.real,
    pending: stats.pending
  };

  document.querySelectorAll('#outcome-chips .chip').forEach((chip) => {
    const key = chip.dataset.outcome || '';
    const label = chip.dataset.label || 'Todos';
    chip.textContent = `${label} (${counts[key] || 0})`;
    const active = (state.filters.outcome || '') === key;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
}

function renderBalance(stats) {
  const total = stats.total;

  el('balance-sub').textContent = total
    ? `${formatCount(total, 'aviso', 'avisos')} · ${formatCount(stats.resolved, 'resuelto', 'resueltos')} · ${formatCount(stats.pending, 'pendiente', 'pendientes')}`
    : 'Sin avisos para el filtro actual';

  if (!total) {
    el('balance-bar').innerHTML = '<span class="seg-empty" style="width:100%"></span>';
    el('balance-bar').setAttribute('aria-label', 'No hay avisos para el filtro actual');
    el('balance-legend').innerHTML = '<span class="muted">No hay avisos para el filtro actual.</span>';
    return;
  }

  if (!stats.resolved) {
    el('balance-bar').innerHTML = '<span class="seg-empty" style="width:100%"></span>';
    el('balance-bar').setAttribute('aria-label', 'No hay casos resueltos en el filtro actual');
    el('balance-legend').innerHTML = `
      <span class="legend-item"><span class="balance-dot pending"></span>Pendientes: ${stats.pending} (sin incluir en el porcentaje)</span>`;
    return;
  }

  const falsePct = stats.falseShare;
  const realPct = stats.realShare;

  el('balance-bar').innerHTML = `
    ${stats.falseOrCleared ? `<span class="seg-false" style="width:${falsePct}%" title="Falsas o descartadas: ${stats.falseOrCleared} de ${stats.resolved} resueltos"></span>` : ''}
    ${stats.real ? `<span class="seg-real" style="width:${realPct}%" title="Reales confirmadas: ${stats.real} de ${stats.resolved} resueltos"></span>` : ''}`;

  el('balance-bar').setAttribute(
    'aria-label',
    `Sobre ${stats.resolved} casos resueltos: falsas o descartadas ${formatPercent(falsePct)}; reales confirmadas ${formatPercent(realPct)}. Pendientes: ${stats.pending}, no incluidos.`
  );

  el('balance-legend').innerHTML = `
    <span class="legend-item"><span class="balance-dot false"></span>Falsas/descartadas: ${stats.falseOrCleared} de ${formatCount(stats.resolved, 'resuelto', 'resueltos')} (${formatPercent(falsePct)})</span>
    <span class="legend-item"><span class="balance-dot real"></span>Reales: ${stats.real} de ${formatCount(stats.resolved, 'resuelto', 'resueltos')} (${formatPercent(realPct)})</span>
    <span class="legend-item"><span class="balance-dot pending"></span>Pendientes: ${stats.pending} (sin incluir en el porcentaje)</span>`;
}

function monthlyStats(incidents) {
  const months = new Map();

  incidents.forEach((incident) => {
    if (!incident.date) return;
    const key = `${incident.date.getFullYear()}-${String(incident.date.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(key)) {
      months.set(key, {
        key,
        date: new Date(incident.date.getFullYear(), incident.date.getMonth(), 1),
        false: 0,
        real: 0,
        pending: 0,
        total: 0
      });
    }
    const month = months.get(key);
    month[incident.outcome] += 1;
    month.total += 1;
  });

  return Array.from(months.values())
    .sort((a, b) => a.date - b.date)
    .slice(-12);
}

function monthlyChartHtml(incidents) {
  const months = monthlyStats(incidents);
  if (!months.length) {
    return '<p class="note-empty">No hay datos mensuales.</p>';
  }

  const maxTotal = Math.max(...months.map((month) => month.total), 1);

  return `
    <div class="monthly-chart" role="img" aria-label="Evolución mensual de avisos por resultado">
      ${months.map((month) => {
        const height = Math.max(3, Math.round((month.total / maxTotal) * 96));
        const segments = ['false', 'real', 'pending']
          .filter((key) => month[key] > 0)
          .map((key) => `<span class="seg-${key}" style="height:${(month[key] / month.total) * 100}%"></span>`)
          .join('');
        return `<div class="month-col">
          <span class="month-total">${month.total}</span>
          <div class="month-bar" style="height:${height}px" title="${month.total} avisos">${segments}</div>
          <span class="month-label">${escapeHtml(monthFormatter.format(month.date))}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="balance-legend">
      <span class="legend-item"><span class="balance-dot false"></span>Falsas/descartadas</span>
      <span class="legend-item"><span class="balance-dot real"></span>Reales</span>
      <span class="legend-item"><span class="balance-dot pending"></span>Pendientes</span>
    </div>`;
}

function renderAnalysisStats(incidents, stats) {
  const container = el('analysis-stats');
  if (!container) return;

  const total = stats.total;
  const pct = (value) => (total ? (value / total) * 100 : 0);
  const policeCoverage = incidents.filter((incident) => incident.sources.some((source) => source.type === 'police')).length;
  const pressCoverage = incidents.filter((incident) => incident.sources.some((source) => source.type === 'press')).length;
  const officialCoverage = incidents.filter((incident) => incident.sources.some((source) => source.type === 'official' || source.type === 'official_statement')).length;

  container.innerHTML = `
    <div class="stat-cards">
      <div class="stat-card">
        <span>Avisos registrados</span>
        <strong>${total}</strong>
        <small>Conjunto completo · ${formatCount(stats.resolved, 'resuelto', 'resueltos')}</small>
      </div>
      <div class="stat-card stat-false">
        <span>Falsas o descartadas</span>
        <strong>${formatPercent(stats.falseShare)}</strong>
        <small>${stats.falseOrCleared} de ${stats.resolved} casos resueltos</small>
      </div>
      <div class="stat-card stat-real">
        <span>Reales confirmadas</span>
        <strong>${formatPercent(stats.realShare)}</strong>
        <small>${stats.real} de ${stats.resolved} casos resueltos</small>
      </div>
      <div class="stat-card stat-pending">
        <span>Pendientes</span>
        <strong>${stats.pending}</strong>
        <small>${formatPercent(pct(stats.pending))} del total · fuera del porcentaje</small>
      </div>
    </div>

    <div class="analysis-bar" role="img" aria-label="Distribución de casos resueltos: falsas o descartadas ${formatPercent(stats.falseShare)}; reales confirmadas ${formatPercent(stats.realShare)}. Pendientes: ${stats.pending}, fuera del porcentaje.">
      ${stats.resolved
        ? `${stats.falseOrCleared ? `<span class="seg-false" style="width:${stats.falseShare}%"></span>` : ''}
           ${stats.real ? `<span class="seg-real" style="width:${stats.realShare}%"></span>` : ''}`
        : '<span class="seg-empty" style="width:100%"></span>'}
    </div>

    <p class="analysis-caption">
      ${stats.resolved
        ? `Entre los casos resueltos (${stats.resolved}), el <strong>${formatPercent(stats.falseShare)}</strong> son falsas alarmas o avisos descartados y el <strong>${formatPercent(stats.realShare)}</strong> son amenazas reales confirmadas.`
        : 'No hay casos resueltos en el conjunto registrado.'}
      Los avisos pendientes (${stats.pending}) se mantienen fuera de ese porcentaje y de la barra superior.
    </p>

    <table class="stats-table">
      <thead>
        <tr>
          <th>Resultado</th>
          <th class="num">Avisos</th>
          <th class="num">% del total</th>
          <th>Qué incluye</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge status-hoax"><i class="fa-solid fa-ban" aria-hidden="true"></i> Falsas declaradas</span></td>
          <td class="num">${stats.byStatus.hoax}</td>
          <td class="num">${formatPercent(pct(stats.byStatus.hoax))}</td>
          <td>Amenazas declaradas falsas por la fuente.</td>
        </tr>
        <tr>
          <td><span class="badge status-cleared"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Descartadas</span></td>
          <td class="num">${stats.byStatus.cleared}</td>
          <td class="num">${formatPercent(pct(stats.byStatus.cleared))}</td>
          <td>Inspección finalizada sin riesgo ni explosivos.</td>
        </tr>
        <tr>
          <td><span class="badge status-confirmed"><i class="fa-solid fa-bomb" aria-hidden="true"></i> Reales confirmadas</span></td>
          <td class="num">${stats.byStatus.confirmed}</td>
          <td class="num">${formatPercent(pct(stats.byStatus.confirmed))}</td>
          <td>Artefacto explosivo real confirmado.</td>
        </tr>
        <tr>
          <td><span class="badge status-investigating"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i> Pendientes</span></td>
          <td class="num">${stats.pending}</td>
          <td class="num">${formatPercent(pct(stats.pending))}</td>
          <td>En investigación (${stats.byStatus.investigating}) o evacuación preventiva (${stats.byStatus.evacuated}).</td>
        </tr>
        <tr>
          <td><strong>Total</strong></td>
          <td class="num"><strong>${total}</strong></td>
          <td class="num"><strong>100 %</strong></td>
          <td>Conjunto completo de avisos.</td>
        </tr>
      </tbody>
    </table>

    <p class="analysis-caption">
      Cobertura de fuentes sobre ${formatCount(total, 'aviso', 'avisos')}: ${formatCount(policeCoverage, 'aviso con nota de policía', 'avisos con nota de policía')},
      ${formatCount(pressCoverage, 'aviso con nota de prensa', 'avisos con nota de prensa')} y
      ${formatCount(officialCoverage, 'aviso con fuente o declaración oficial', 'avisos con fuente o declaración oficial')}.
    </p>

    <h4 class="profile-subhead">Evolución mensual</h4>
    ${monthlyChartHtml(incidents)}`;
}

function renderAnalysisNotes(incidents) {
  const container = el('analysis-notes');
  if (!container) return;

  const notesByKey = new Map();

  incidents.forEach((incident) => {
    incident.sources.forEach((source) => {
      if (!source.url && !source.name) return;
      const key = source.url || `${source.name}|${incident.id}`;
      if (!notesByKey.has(key)) {
        notesByKey.set(key, { source, incidents: [] });
      }
      notesByKey.get(key).incidents.push(incident);
    });
  });

  const notes = Array.from(notesByKey.values()).sort((a, b) => {
    const dateA = a.source.date ? new Date(`${a.source.date}T12:00:00`).getTime() : 0;
    const dateB = b.source.date ? new Date(`${b.source.date}T12:00:00`).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    const incidentA = a.incidents[0]?.date?.getTime() || 0;
    const incidentB = b.incidents[0]?.date?.getTime() || 0;
    return incidentB - incidentA;
  });

  if (!notes.length) {
    container.innerHTML = '<p class="note-empty">No hay notas enlazadas.</p>';
    return;
  }

  const groups = { police: [], official: [], official_statement: [], press: [] };
  notes.forEach((note) => {
    const type = SOURCE_TYPES[note.source.type] ? note.source.type : 'press';
    groups[type].push(note);
  });

  const summary = `
    <p class="analysis-caption">
      ${formatCount(groups.police.length, 'nota de policía', 'notas de policía')} ·
      ${formatCount(groups.press.length, 'nota de prensa', 'notas de prensa')} ·
      ${formatCount(groups.official.length + groups.official_statement.length, 'fuente oficial o declaración', 'fuentes oficiales o declaraciones')}.
    </p>`;

  const groupHtml = (typeKey, open) => {
    const items = groups[typeKey];
    if (!items.length) return '';
    const type = SOURCE_TYPES[typeKey];
    return `<details class="note-group" ${open ? 'open' : ''}>
      <summary><span class="badge ${type.className}"><i class="fa-solid ${type.icon}" aria-hidden="true"></i> ${escapeHtml(type.label)}</span>${formatCount(items.length, 'nota', 'notas')}<span class="note-count">${formatCount(items.length, 'enlace', 'enlaces')}</span></summary>
      <ul class="note-list">
        ${items.map((note) => {
          const locations = unique(note.incidents.map((incident) => incident.locality)).join(' · ');
          const dates = unique(note.incidents.map((incident) => formatShortDate(incident.datetime, incident.time_precision))).join(' · ');
          const sourceDate = note.source.date ? `Publicado: ${formatSourceDate(note.source.date)}` : '';
          const name = escapeHtml(note.source.name || type.label);
          const link = note.source.url
            ? `<a href="${escapeHtml(note.source.url)}" target="_blank" rel="noopener noreferrer">${name}</a>`
            : `<span>${name}</span>`;
          return `<li class="note-item">
            ${link}
            <span class="note-meta">${escapeHtml(locations)} · ${escapeHtml(dates)}${sourceDate ? ` · ${escapeHtml(sourceDate)}` : ''}</span>
            ${note.source.note ? `<span class="note-meta">${escapeHtml(note.source.note)}</span>` : ''}
          </li>`;
        }).join('')}
      </ul>
    </details>`;
  };

  container.innerHTML = summary +
    groupHtml('police', true) +
    groupHtml('official', false) +
    groupHtml('official_statement', false) +
    groupHtml('press', true);
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
    const outcome = OUTCOMES[incident.outcome] || OUTCOMES.pending;

    return `
      <button type="button" class="incident-card ${outcome.className}" data-incident-id="${escapeHtml(incident.id)}" title="${escapeHtml(outcome.label)}">
        <span class="card-icon" style="--marker-color:${cat.color}">
          <i class="fa-solid ${cat.icon}" aria-hidden="true"></i>
        </span>
        <span class="card-body">
          <span class="card-top">
            <strong>${escapeHtml(incident.locality)}</strong>
            <span class="badge ${status.className}"><i class="fa-solid ${status.icon}" aria-hidden="true"></i> ${escapeHtml(status.label)}</span>
          </span>
          <span class="card-place">${escapeHtml(incident.place)}</span>
          <span class="card-meta">${escapeHtml(formatShortDate(incident.datetime, incident.time_precision))} · ${escapeHtml(incident.country_name || incident.country)}</span>
          <span class="card-sources"><i class="fa-solid fa-paperclip" aria-hidden="true"></i> ${escapeHtml(sourceSummary(incident))}</span>
        </span>
      </button>`;
  }).join('');
}

function applyFilters(options = {}) {
  const incidents = getFilteredIncidents();
  const baseIncidents = getFilteredIncidents({ ignoreOutcome: true });
  const stats = computeStats(baseIncidents);
  const allStats = computeStats(state.incidents);

  renderMap(incidents);
  renderList(incidents);
  renderBalance(stats);
  renderOutcomeChips(stats);
  renderAnalysisStats(state.incidents, allStats);
  renderAnalysisNotes(state.incidents);

  const countryCount = new Set(incidents.map((incident) => incident.country).filter(Boolean)).size;
  const incidentLabel = incidents.length === 1 ? 'aviso' : 'avisos';
  const countryLabel = countryCount === 1 ? 'país' : 'países';
  el('result-count').textContent = `${incidents.length} ${incidentLabel} · ${countryCount} ${countryLabel}`;

  el('map-empty').hidden = incidents.length !== 0;

  if (options.fit) {
    fitTo(incidents);
  }
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
/* Meta, sources & analysis profile                                    */
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

function analysisSourcesHtml(sources) {
  if (!Array.isArray(sources) || !sources.length) {
    return '<p class="note-empty">No hay fuentes adicionales del análisis.</p>';
  }

  return `<ul class="profile-sources">
    ${sources.map((source) => {
      const type = SOURCE_TYPES[source.type] || SOURCE_TYPES.press;
      const meta = [
        type.label,
        source.date ? formatSourceDate(source.date) : '',
        source.note || ''
      ].filter(Boolean).map(escapeHtml).join(' · ');
      return `<li>
        <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a>
        <span class="source-meta">${meta}</span>
      </li>`;
    }).join('')}
  </ul>`;
}

function renderAnalysisProfile() {
  const lead = el('analysis-lead');
  const disclaimer = el('analysis-disclaimer');
  const container = el('analysis-profile');
  if (!lead || !disclaimer || !container) return;

  if (!state.analysis) {
    lead.textContent = 'No se pudo cargar el análisis. Revisa data/analysis.json.';
    disclaimer.textContent = '';
    container.innerHTML = '<p class="note-empty">El mapa y las fichas siguen funcionando con los datos de avisos, pero el perfil no está disponible.</p>';
    return;
  }

  const analysis = state.analysis;
  const falseProfile = analysis.false_alarm_profile || {};
  const realProfile = analysis.real_attack_profile || {};

  lead.textContent = analysis.headline || '';
  disclaimer.textContent = analysis.meta?.disclaimer || '';

  const patterns = Array.isArray(falseProfile.patterns) ? falseProfile.patterns : [];
  const hypotheses = Array.isArray(falseProfile.hypotheses) ? falseProfile.hypotheses : [];
  const indicators = Array.isArray(falseProfile.indicators) ? falseProfile.indicators : [];
  const knownCases = Array.isArray(falseProfile.known_cases) ? falseProfile.known_cases : [];
  const facts = Array.isArray(realProfile.facts) ? realProfile.facts : [];
  const differences = Array.isArray(realProfile.differences) ? realProfile.differences : [];

  container.innerHTML = `
    <p class="profile-summary">${escapeHtml(falseProfile.summary || '')}</p>

    <div class="profile-grid">
      ${patterns.map((pattern) => `
        <div class="profile-card">
          <h4>${escapeHtml(pattern.title || '')}</h4>
          <p>${escapeHtml(pattern.text || '')}</p>
        </div>`).join('')}
    </div>

    <h4 class="profile-subhead">Hipótesis de autoría</h4>
    <div class="hypothesis-list">
      ${hypotheses.map((hypothesis) => {
        const confidence = CONFIDENCE[hypothesis.confidence] || CONFIDENCE.hipotesis;
        return `<div class="hypothesis">
          <div class="hypothesis-head">
            <h4>${escapeHtml(hypothesis.title || '')}</h4>
            <span class="confidence ${confidence.className}">${escapeHtml(confidence.label)}</span>
          </div>
          <p>${escapeHtml(hypothesis.text || '')}</p>
        </div>`;
      }).join('')}
    </div>
    <p class="analysis-caption">Las etiquetas de confianza son una valoración editorial basada en las fuentes enlazadas, no una calificación policial.</p>

    <h4 class="profile-subhead">Casos con autor conocido (sin datos personales)</h4>
    <div class="known-cases">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Lugar</th>
            <th>Perfil</th>
            <th>Método</th>
            <th>Motivación</th>
            <th>Resultado</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          ${knownCases.map((item) => `
            <tr>
              <td>${escapeHtml(item.date ? formatSourceDate(item.date) : '—')}</td>
              <td>${escapeHtml(item.place || '—')}</td>
              <td>${escapeHtml(item.profile || '—')}</td>
              <td>${escapeHtml(item.method || '—')}</td>
              <td>${escapeHtml(item.motive || '—')}</td>
              <td>${escapeHtml(item.outcome || '—')}</td>
              <td>${item.source ? `<a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">Ver</a>` : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="analysis-caption">${escapeHtml(falseProfile.known_cases_note || '')}</p>

    <h4 class="profile-subhead">Indicadores que vigilan los investigadores</h4>
    <ul class="profile-list">
      ${indicators.map((indicator) => `<li>${escapeHtml(indicator)}</li>`).join('')}
    </ul>

    <h4 class="profile-subhead">${escapeHtml(realProfile.title || 'El caso real')}</h4>
    <p class="profile-summary">${escapeHtml(realProfile.summary || '')}</p>
    <ul class="profile-list">
      ${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('')}
    </ul>
    <div class="profile-callout warning">${escapeHtml(realProfile.warning || '')}</div>
    <div class="profile-callout info">
      <strong>Diferencias clave frente a las falsas alarmas</strong>
      <ul class="profile-list">
        ${differences.map((difference) => `<li>${escapeHtml(difference)}</li>`).join('')}
      </ul>
    </div>

    <h4 class="profile-subhead">Fuentes del análisis</h4>
    ${analysisSourcesHtml(analysis.sources)}`;
}

/* ------------------------------------------------------------------ */
/* UI events                                                           */
/* ------------------------------------------------------------------ */

function openModal(modal, trigger) {
  if (!modal) return;
  lastModalTrigger = trigger || document.activeElement;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  const closeButton = modal.querySelector('.modal-close');
  if (closeButton) closeButton.focus();
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  if (lastModalTrigger && typeof lastModalTrigger.focus === 'function') {
    lastModalTrigger.focus();
  }
  lastModalTrigger = null;
}

function openAnalysisAt(sectionId, trigger) {
  const modal = el('analysis-modal');
  openModal(modal, trigger);

  if (!sectionId) return;

  requestAnimationFrame(() => {
    const target = el(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

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
    state.filters.outcome = '';
    applyFilters({ fit: true });
  });

  el('filter-source').addEventListener('change', (event) => {
    state.filters.source = event.target.value;
    applyFilters({ fit: true });
  });

  el('filter-period').addEventListener('change', (event) => {
    state.filters.period = event.target.value;
    applyFilters({ fit: true });
  });

  el('outcome-chips').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-outcome]');
    if (!chip) return;
    state.filters.outcome = chip.dataset.outcome || '';
    state.filters.status = '';
    el('filter-status').value = '';
    applyFilters({ fit: true });
  });

  el('reset-filters').addEventListener('click', () => {
    state.filters = { q: '', country: '', category: '', status: '', source: '', outcome: '', period: '180' };
    search.value = '';
    el('filter-country').value = '';
    el('filter-category').value = '';
    el('filter-status').value = '';
    el('filter-source').value = '';
    el('filter-period').value = '180';
    applyFilters({ fit: true });
  });

  el('incident-list').addEventListener('click', (event) => {
    const card = event.target.closest('[data-incident-id]');
    if (!card) return;
    focusIncident(card.dataset.incidentId);
  });

  const methodologyModal = el('methodology-modal');
  const analysisModal = el('analysis-modal');

  el('open-methodology').addEventListener('click', (event) => openModal(methodologyModal, event.currentTarget));
  el('open-analysis').addEventListener('click', (event) => openAnalysisAt(null, event.currentTarget));
  el('open-analysis-link').addEventListener('click', (event) => openAnalysisAt(null, event.currentTarget));
  el('open-notes').addEventListener('click', (event) => openAnalysisAt('analysis-notes-section', event.currentTarget));
  el('open-notes-footer').addEventListener('click', (event) => openAnalysisAt('analysis-notes-section', event.currentTarget));

  [methodologyModal, analysisModal].forEach((modal) => {
    modal.querySelectorAll('[data-close]').forEach((node) => {
      node.addEventListener('click', () => closeModal(modal));
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!analysisModal.hidden) closeModal(analysisModal);
    if (!methodologyModal.hidden) closeModal(methodologyModal);
  });
}

/* ------------------------------------------------------------------ */

init();
