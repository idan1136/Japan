const DATA = window.JAPAN_DATA;
const P = window.Planner;
const days = DATA.days;
const FOOD_STOPS = DATA.food_stops;
const DESTINATIONS = DATA.destinations;
const HOTELS = DATA.hotels;
const PLACES = DATA.places;
const GROUPS = DATA.restaurant_groups;
const names = DATA.region_names;
const colors = { tokyo: 'var(--tokyo)', alps: 'var(--alps)', okinawa: 'var(--okinawa)' };
const esc = P.escapeHtml;

function storeGet(key) { return P.storageGet(localStorage, key); }
let applyingRemote = false;
function storeSet(key, value) {
  P.storageSet(localStorage, key, value);
  if (!applyingRemote) touchStamp(key);
}
function restaurantKey(name) { return encodeURIComponent(name); }
function foodStopKey(name, date) { return encodeURIComponent(date + '__' + name); }
function restaurantBooked(key) { return storeGet('jp26_rest_' + key) === '1'; }
function foodStopDone(key) { return storeGet('jp26_food_' + key) === '1'; }

const MAP_PLATFORM = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'apple' : 'google';
function mapQuery(query) { return P.mapSearch(query, MAP_PLATFORM); }
function mapRoute(points, mode) { return P.mapDirections(points, mode, MAP_PLATFORM); }
function extLink(href, className, text) {
  const cls = className ? ' class="' + className + '"' : '';
  const external = MAP_PLATFORM === 'apple' ? '' : ' target="_blank" rel="noopener noreferrer"';
  return '<a' + cls + external + ' href="' + esc(href) + '">' + esc(text) + '</a>';
}

function eventsHTML(events) {
  if (!events || !events.length) return '';
  return events.map(function (event) {
    const source = /^https:\/\//.test(event.source || '') ? event.source : '';
    return '<div class="event"><div class="event-top"><div><h4>🎉 ' + esc(event.title) + '</h4><div class="event-time">' + esc(event.time) + '</div></div></div><div class="event-place">📍 ' + esc(event.place) + '</div><div class="event-note">' + esc(event.note) + '</div>' +
      (event.warning ? '<div class="warning">' + esc(event.warning) + '</div>' : '') +
      '<div class="event-actions">' + extLink(mapQuery(event.map), 'tiny-btn dark', 'מיקום במפות ↗') +
      (source ? extLink(source, 'tiny-btn', 'אתר רשמי ↗') : '') + '</div></div>';
  }).join('');
}

function foodHTML(date) {
  const stops = FOOD_STOPS[date] || [];
  if (!stops.length) return '';
  const rows = stops.map(function (stop) {
    const key = foodStopKey(stop.name, date);
    const done = foodStopDone(key);
    return '<div class="food ' + (done ? 'is-done' : '') + '"><div><div class="food-name">' + esc(stop.name) +
      (stop.pick ? '<span class="pick">⭐ מתאים למסלול</span>' : '') + '</div><div class="food-sub">' + esc(stop.area) + ' · ' + esc(stop.kind) + '</div><div class="food-note">' + esc(stop.note) + '</div></div><div class="food-actions">' +
      extLink(mapQuery(stop.name), 'icon-btn', 'מפה') +
      '<button class="food-check ' + (done ? 'is-done' : '') + '" data-fkey="' + esc(key) + '" type="button" aria-pressed="' + (done ? 'true' : 'false') + '">' + (done ? '✓ אכלנו' : 'אכלנו') + '</button></div></div>';
  }).join('');
  return '<div class="block"><div class="block-title"><h4>🍜 אוכל בדרך</h4></div><div class="food-list">' + rows + '</div></div>';
}

function movesHTML(moves) {
  if (!moves || !moves.length) return '';
  return '<details class="subdetails"><summary>זמני מעבר</summary><div class="move-list">' + moves.map(function (move) {
    return '<div class="move"><span>' + esc(move[0]) + '</span><b>' + esc(move[2]) + '</b><span>' + esc(move[1]) + '</span></div>';
  }).join('') + '</div></details>';
}

function restaurantsHTML(group) {
  const rows = GROUPS[group] || [];
  if (!rows.length) return '';
  const booked = rows.filter(function (row) { return restaurantBooked(restaurantKey(row[0])); }).length;
  const list = rows.map(function (row) {
    const key = restaurantKey(row[0]);
    const done = restaurantBooked(key);
    const mapAttrs = MAP_PLATFORM === 'apple' ? '' : ' target="_blank" rel="noopener noreferrer"';
    return '<div class="restaurant ' + (done ? 'is-booked' : '') + '"><a' + mapAttrs + ' href="' + esc(mapQuery(row[0])) + '"><div class="restaurant-name">' + esc(row[0]) + '</div><div class="restaurant-type">' + esc(row[1]) + ' · מפה ↗</div></a><button class="book-btn ' + (done ? 'is-booked' : '') + '" data-rkey="' + esc(key) + '" type="button" aria-pressed="' + (done ? 'true' : 'false') + '">' + (done ? '✓ הוזמן' : 'סגרתי') + '</button></div>';
  }).join('');
  return '<details class="subdetails restaurant-details"><summary>' + esc(P.restaurantSummary(rows.length, booked)) + '</summary><div class="restaurants">' + list + '</div></details>';
}

function routeHTML(day) {
  const points = P.routePoints(day);
  if (!points.length) return '';
  const chips = points.map(function (point, index) {
    return (index ? '<span class="arrow">←</span>' : '') + extLink(mapQuery(point), '', point);
  }).join('');
  return '<div class="block"><div class="block-title"><h4>המסלול</h4></div><div class="route-flow">' + chips + '</div>' +
    extLink(mapRoute(points, P.travelMode(day)), 'primary-link', P.routeLinkLabel(points)) + '</div>';
}

const CUSTOM_KEY = 'jp26_custom_rest';
const CHECK_KEY = 'jp26_custom_checks';
let currentFilter = 'all';

function loadList(key) {
  try {
    const parsed = JSON.parse(storeGet(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) { return []; }
}
function saveList(key, list) {
  if (!applyingRemote) {
    const meta = loadMeta();
    list.forEach(function (item) {
      const field = key + ':' + item.id;
      if (!meta[field]) meta[field] = Date.now();
    });
    P.storageSet(localStorage, META_KEY, JSON.stringify(meta));
  }
  storeSet(key, JSON.stringify(list));
}
function tombstone(bucket, id) {
  const meta = loadMeta();
  meta[bucket] = meta[bucket] || {};
  meta[bucket][id] = Date.now();
  delete meta[(bucket === 'removedChecks' ? CHECK_KEY : CUSTOM_KEY) + ':' + id];
  P.storageSet(localStorage, META_KEY, JSON.stringify(meta));
  schedulePush();
}
function customRestaurants() {
  return loadList(CUSTOM_KEY).filter(function (item) { return item && item.id && item.name && item.date; });
}
function customChecks() {
  return loadList(CHECK_KEY).filter(function (item) { return item && item.id && item.label; });
}

function customHTML(date) {
  const rows = customRestaurants().filter(function (item) { return item.date === date; });
  if (!rows.length) return '';
  return '<div class="block"><div class="block-title"><h4>מסעדות שהוספתם</h4></div><div class="custom-list">' + rows.map(function (item) {
    return '<div class="food"><div><div class="food-name">' + esc(item.name) + '</div><div class="food-sub">' + esc([item.area, item.kind].filter(Boolean).join(' · ')) + '</div><div class="food-note">' + esc(item.reason || '') + '</div></div><div class="food-actions">' +
      extLink(mapQuery(item.name + (item.area ? ' ' + item.area : '')), 'icon-btn', 'מפה') +
      '<button class="icon-btn remove-custom" type="button" data-id="' + esc(item.id) + '">הסרה</button></div></div>';
  }).join('') + '</div></div>';
}

function noteHTML(date) {
  return '<div class="note-box"><div class="block-title"><h4>פתק ליום</h4></div><textarea class="day-note" data-date="' + esc(date) + '" placeholder="הזמנה, שעה, או משהו שלא תרצו לשכוח">' + esc(storeGet('jp26_note_' + date) || '') + '</textarea></div>';
}

function searchBlob(day) {
  const food = (FOOD_STOPS[day.d] || []).map(function (stop) { return stop.name + ' ' + stop.area; }).join(' ');
  const added = customRestaurants().filter(function (item) { return item.date === day.d; }).map(function (item) { return item.name + ' ' + (item.area || ''); }).join(' ');
  return P.normalize([day.title, day.summary, (day.route || []).join(' '), food, added, storeGet('jp26_note_' + day.d) || ''].join(' '));
}

function statusHTML(day) {
  const parts = [];
  if (day.booked) parts.push('<span class="status ok">✓ ' + esc(day.booked) + '</span>');
  if (day.action) parts.push('<span class="status todo">● ' + esc(day.action) + '</span>');
  const stay = P.hotelFor(day.d, HOTELS);
  if (stay) parts.push('<span class="status hotel">🏨 ' + esc(stay.name) + '</span>');
  return parts.length ? '<div class="status-row">' + parts.join('') + '</div>' : '';
}

function render(keepOpen) {
  const today = P.todayISO(new Date());
  const hash = location.hash.replace('#', '');
  const previouslyOpen = keepOpen ? new Set([...document.querySelectorAll('.day[open]')].map(function (el) { return el.id; })) : null;
  document.getElementById('dayList').innerHTML = days.map(function (day) {
    const id = P.dayDomId(day.d);
    const open = previouslyOpen ? previouslyOpen.has(id) || (keepOpen && keepOpen.has(id)) : id === hash || (!hash && day.d === (days.some(function (item) { return item.d === today; }) ? today : days[0].d));
    const region = names[day.region] || '';
    return '<details class="day' + (day.d === today ? ' is-today' : '') + '" id="' + id + '" data-region="' + esc(day.region) + '" data-search="' + esc(searchBlob(day)) + '"' + (open ? ' open' : '') + '><summary><div class="date-box"><b>' + Number(day.d.slice(-2)) + '.10</b><span>' + esc(P.weekdayLabel(day.d)) + '</span></div><div class="day-title"><strong>' + esc(day.title) + '</strong><small>' + esc(day.summary) + '</small></div><div class="day-meta"><span class="region-dot" style="background:' + colors[day.region] + '" title="' + esc(region) + '"></span><span class="chev" aria-hidden="true">⌄</span></div></summary><div class="day-content">' +
      (day.image ? '<img class="day-image" src="' + esc(day.image) + '" alt="' + esc(day.title) + '">' : '') +
      eventsHTML(day.events) + '<p class="summary-text">' + esc(day.summary) + '</p>' + statusHTML(day) + routeHTML(day) + customHTML(day.d) + foodHTML(day.d) + movesHTML(day.moves) + restaurantsHTML(day.restaurant_group) + noteHTML(day.d) + '</div></details>';
  }).join('');
  applyFilter(currentFilter);
}

function checklistItems() {
  const custom = customChecks().map(function (item) { return { id: item.id, label: item.label, custom: true, group: 'mine' }; });
  return P.checklist.flatMap(function (group) { return group.items.map(function (item) { return Object.assign({ group: group.id }, item); }); }).concat(custom);
}

function renderChecklist() {
  const custom = customChecks();
  const groups = P.checklist.concat(custom.length ? [{ id: 'mine', title: 'הוספתי', items: custom.map(function (item) { return { id: item.id, label: item.label, custom: true }; }) }] : []);
  document.getElementById('checkGroups').innerHTML = groups.map(function (group) {
    return '<div class="card check-card"><h3>' + esc(group.title) + '</h3><div class="checks">' + group.items.map(function (item) {
      const done = storeGet('jp26_v2_' + item.id) === '1';
      return '<label class="check' + (done ? ' is-done' : '') + '"><input type="checkbox" data-save="' + esc(item.id) + '"' + (done ? ' checked' : '') + '><span>' + esc(item.label) + '</span>' +
        (item.custom ? '<button class="icon-btn remove-check" type="button" data-id="' + esc(item.id) + '">הסרה</button>' : '') + '</label>';
    }).join('') + '</div></div>';
  }).join('');
  const items = checklistItems();
  const done = items.filter(function (item) { return storeGet('jp26_v2_' + item.id) === '1'; }).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  document.getElementById('checkProgress').innerHTML = esc(done + ' מתוך ' + items.length + ' הושלמו') + '<div class="progress-bar"><span style="width:' + pct + '%"></span></div>';
}

function fillDaySelect() {
  const select = document.querySelector('#addRestaurant select[name="day"]');
  select.innerHTML = '<option value="">לפי המסלול</option>' + days.map(function (day) {
    return '<option value="' + day.d + '">' + Number(day.d.slice(-2)) + '.10 · ' + esc(day.title) + '</option>';
  }).join('');
}

function showPlaceMessage(text, warn) {
  const el = document.getElementById('placeMessage');
  el.textContent = text;
  el.classList.toggle('is-warn', !!warn);
}

function renderJump() {
  document.getElementById('dayJump').innerHTML = days.map(function (day) {
    const short = (names[day.region] || '').split(' / ')[0];
    return '<a href="#' + P.dayDomId(day.d) + '" data-region="' + esc(day.region) + '"><b>' + Number(day.d.slice(-2)) + '.10</b>' + esc(short) + '</a>';
  }).join('');
}

function renderHotels() {
  document.getElementById('hotelList').innerHTML = HOTELS.map(function (hotel) {
    return '<div class="simple-row"><div class="when">' + esc(hotel.dates) + '</div><div><b>' + esc(hotel.name) + '</b><small>' + esc(hotel.area) + '</small></div>' + extLink(mapQuery(hotel.name), '', 'מפה ↗') + '</div>';
  }).join('');
}

function renderDest() {
  document.getElementById('destinationList').innerHTML = DESTINATIONS.map(function (place) {
    return '<article class="destination"><div class="destination-top"><div><div class="destination-name">' + esc(place.name) + '</div><div class="restaurant-type">' + esc(place.type) + '</div></div><span class="destination-area">📍 ' + esc(place.area) + '</span></div><p>' + esc(place.why) + '</p>' + extLink(mapQuery(place.name), '', 'פתיחה במפות ↗') + '</article>';
  }).join('');
}

function visibleDays() {
  return [...document.querySelectorAll('.day')].filter(function (el) { return !el.classList.contains('hidden'); });
}

function syncToggle() {
  const items = visibleDays();
  const allOpen = items.length > 0 && items.every(function (el) { return el.open; });
  document.getElementById('toggleAll').textContent = allOpen ? 'סגור הכל' : 'פתח הכל';
}

function navOffset() {
  const nav = document.querySelector('.nav');
  return (nav ? nav.offsetHeight : 64) + 12;
}

function scrollToId(id, behavior) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - navOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: behavior || 'smooth' });
}

function applyFilter(filter) {
  currentFilter = filter || 'all';
  const query = P.normalize(document.getElementById('tripSearch').value);
  document.querySelectorAll('.day').forEach(function (el) {
    const regionMismatch = currentFilter !== 'all' && el.dataset.region !== currentFilter;
    const searchMismatch = query && !(el.dataset.search || '').includes(query);
    el.classList.toggle('hidden', regionMismatch || searchMismatch);
  });
  document.querySelectorAll('.day-jump a').forEach(function (el) {
    const day = document.getElementById(el.getAttribute('href').slice(1));
    el.classList.toggle('hidden', !day || day.classList.contains('hidden'));
  });
  const visible = visibleDays();
  const note = document.getElementById('filterNote');
  const labels = { all: 'כל הימים', tokyo: 'טוקיו', alps: 'האלפים', okinawa: 'אוקינאווה' };
  if (note) {
    note.textContent = visible.length
      ? labels[currentFilter] + ' · ' + visible.length + (visible.length === 1 ? ' יום' : ' ימים')
      : 'אין ימים שמתאימים לחיפוש';
  }
  const empty = document.getElementById('emptyDays');
  if (empty) empty.classList.toggle('hidden', visible.length > 0);
  syncToggle();
}

function paintCountdown() {
  const info = P.countdown(new Date());
  document.getElementById('countdown').textContent = info.value;
  document.getElementById('countdownLabel').textContent = info.label;
}

function initMap() {
  const el = document.getElementById('tripMap');
  if (!window.L) {
    el.innerHTML = '<p class="map-fallback">המפה לא נטענה. המסלול עצמו זמין גם בלי חיבור.</p>';
    return;
  }
  const map = L.map(el, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  const lines = P.mapLines(PLACES);
  L.polyline(lines.main, { weight: 3, opacity: 0.55, dashArray: '7 8' }).addTo(map);
  lines.dayTrips.forEach(function (line) {
    L.polyline(line, { weight: 2, opacity: 0.45, dashArray: '2 6' }).addTo(map);
  });
  PLACES.forEach(function (place) {
    L.circleMarker([place.lat, place.lng], { radius: 7, weight: 2, fillOpacity: 0.9 }).addTo(map).bindPopup('<b>' + esc(place.name) + '</b><br>' + esc(place.dates));
  });
  map.fitBounds(lines.main.concat(lines.dayTrips.flat()), { padding: [24, 24] });
  const fix = function () { map.invalidateSize(); };
  requestAnimationFrame(fix);
  window.addEventListener('resize', fix);
}

fillDaySelect();
renderChecklist();
render();
renderJump();
renderHotels();
renderDest();
paintCountdown();

document.querySelectorAll('.nav button[data-filter]').forEach(function (button) {
  button.addEventListener('click', function () {
    document.querySelectorAll('.nav button[data-filter]').forEach(function (item) {
      item.classList.remove('active');
      item.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    applyFilter(button.dataset.filter);
    const first = visibleDays()[0];
    if (first) first.open = true;
    scrollToId('days');
  });
});

document.querySelector('.nav').addEventListener('click', function (event) {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href').slice(1);
  if (!document.getElementById(id)) return;
  event.preventDefault();
  history.pushState(null, '', '#' + id);
  scrollToId(id);
});

document.getElementById('dayJump').addEventListener('click', function (event) {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const day = document.getElementById(link.getAttribute('href').slice(1));
  if (!day) return;
  event.preventDefault();
  day.open = true;
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      scrollToId(day.id, 'auto');
      root.style.scrollBehavior = previous;
    });
  });
});

document.getElementById('checklist').addEventListener('change', function (event) {
  const box = event.target.closest('[data-save]');
  if (!box) return;
  storeSet('jp26_v2_' + box.dataset.save, box.checked ? '1' : '0');
  const label = box.closest('.check');
  if (label) label.classList.toggle('is-done', box.checked);
  renderChecklist();
});

document.getElementById('checklist').addEventListener('click', function (event) {
  const button = event.target.closest('.remove-check');
  if (!button) return;
  event.preventDefault();
  tombstone('removedChecks', button.dataset.id);
  saveList(CHECK_KEY, customChecks().filter(function (item) { return item.id !== button.dataset.id; }));
  renderChecklist();
});

document.getElementById('addCheck').addEventListener('submit', function (event) {
  event.preventDefault();
  const input = event.target.elements.label;
  const label = input.value.trim();
  if (!label) return;
  const list = customChecks();
  list.push({ id: 'c' + Date.now().toString(36), label: label });
  saveList(CHECK_KEY, list);
  input.value = '';
  renderChecklist();
});

document.getElementById('addRestaurant').addEventListener('submit', function (event) {
  event.preventDefault();
  const form = event.target;
  const name = form.elements.name.value.trim();
  const area = form.elements.area.value.trim();
  const kind = form.elements.kind.value.trim();
  const date = form.elements.day.value;
  if (!name) return;
  const placed = P.placeRestaurant({ name: name, area: area, date: date }, { days: days, hotels: HOTELS, foodStops: FOOD_STOPS, regionNames: names });
  if (!placed.date) {
    showPlaceMessage(placed.reason, true);
    form.elements.day.focus();
    return;
  }
  const list = customRestaurants();
  list.push({ id: 'r' + Date.now().toString(36), name: name, area: area, kind: kind, date: placed.date, reason: placed.reason });
  saveList(CUSTOM_KEY, list);
  form.reset();
  fillDaySelect();
  const day = days.find(function (item) { return item.d === placed.date; });
  showPlaceMessage(name + ' נכנס ל-' + Number(placed.date.slice(-2)) + '.10 · ' + (day ? day.title : '') + '. ' + placed.reason, false);
  const open = new Set([...document.querySelectorAll('.day[open]')].map(function (el) { return el.id; }));
  open.add(P.dayDomId(placed.date));
  render(open);
  const card = document.getElementById(P.dayDomId(placed.date));
  if (card) card.scrollIntoView({ block: 'start' });
});

document.getElementById('tripSearch').addEventListener('input', function () { applyFilter(currentFilter); });

document.getElementById('dayList').addEventListener('input', function (event) {
  const note = event.target.closest('.day-note');
  if (!note) return;
  storeSet('jp26_note_' + note.dataset.date, note.value);
  const day = note.closest('.day');
  if (day) day.dataset.search = searchBlob(days.find(function (item) { return P.dayDomId(item.d) === day.id; }));
});

document.getElementById('toggleAll').addEventListener('click', function () {
  const items = visibleDays();
  const openAll = items.some(function (el) { return !el.open; });
  items.forEach(function (el) { el.open = openAll; });
  syncToggle();
});

document.getElementById('dayList').addEventListener('toggle', function (event) {
  if (event.target.classList.contains('day')) syncToggle();
}, true);

document.addEventListener('click', function (event) {
  const removeRest = event.target.closest('.remove-custom');
  if (removeRest) {
    event.preventDefault();
    tombstone('removedRests', removeRest.dataset.id);
    saveList(CUSTOM_KEY, customRestaurants().filter(function (item) { return item.id !== removeRest.dataset.id; }));
    render(new Set([...document.querySelectorAll('.day[open]')].map(function (el) { return el.id; })));
    return;
  }
  const food = event.target.closest('.food-check');
  if (food) {
    event.preventDefault();
    const key = 'jp26_food_' + food.dataset.fkey;
    const done = storeGet(key) !== '1';
    storeSet(key, done ? '1' : '0');
    food.classList.toggle('is-done', done);
    food.setAttribute('aria-pressed', done ? 'true' : 'false');
    food.textContent = done ? '✓ אכלנו' : 'אכלנו';
    const card = food.closest('.food');
    if (card) card.classList.toggle('is-done', done);
    return;
  }
  const book = event.target.closest('.book-btn');
  if (!book) return;
  event.preventDefault();
  const key = 'jp26_rest_' + book.dataset.rkey;
  const done = storeGet(key) !== '1';
  storeSet(key, done ? '1' : '0');
  book.classList.toggle('is-booked', done);
  book.setAttribute('aria-pressed', done ? 'true' : 'false');
  book.textContent = done ? '✓ הוזמן' : 'סגרתי';
  const row = book.closest('.restaurant');
  if (row) row.classList.toggle('is-booked', done);
  const details = book.closest('.restaurant-details');
  if (!details) return;
  const buttons = details.querySelectorAll('.book-btn');
  const booked = [...buttons].filter(function (item) { return item.classList.contains('is-booked'); }).length;
  details.querySelector('summary').textContent = P.restaurantSummary(buttons.length, booked);
});

const META_KEY = 'jp26_sync_meta';
const SYNC_URL = location.hostname.endsWith('github.io')
  ? 'https://japan-2026-sync-production.up.railway.app/api/state'
  : location.origin + '/api/state';

function loadMeta() {
  try { return JSON.parse(storeGet(META_KEY) || '{}'); } catch (err) { return {}; }
}
function touchStamp(key) {
  const meta = loadMeta();
  meta[key] = Date.now();
  P.storageSet(localStorage, META_KEY, JSON.stringify(meta));
  schedulePush();
}
function entry(key, value) {
  return { v: value, at: loadMeta()[key] || 0 };
}
function snapshot() {
  const doc = { checks: {}, customChecks: {}, restaurants: {}, food: {}, booked: {}, notes: {} };
  P.checklist.forEach(function (group) {
    group.items.forEach(function (item) {
      doc.checks[item.id] = entry('jp26_v2_' + item.id, storeGet('jp26_v2_' + item.id) === '1');
    });
  });
  customChecks().forEach(function (item) { doc.customChecks[item.id] = entry(CHECK_KEY + ':' + item.id, item); });
  const removedChecks = loadMeta().removedChecks || {};
  Object.keys(removedChecks).forEach(function (id) {
    if (!doc.customChecks[id]) doc.customChecks[id] = { v: null, at: removedChecks[id] };
  });
  customRestaurants().forEach(function (item) { doc.restaurants[item.id] = entry(CUSTOM_KEY + ':' + item.id, item); });
  const removedRests = loadMeta().removedRests || {};
  Object.keys(removedRests).forEach(function (id) {
    if (!doc.restaurants[id]) doc.restaurants[id] = { v: null, at: removedRests[id] };
  });
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.indexOf('jp26_food_') === 0) doc.food[key.slice(10)] = entry(key, storeGet(key) === '1');
    else if (key.indexOf('jp26_rest_') === 0) doc.booked[key.slice(10)] = entry(key, storeGet(key) === '1');
    else if (key.indexOf('jp26_note_') === 0) doc.notes[key.slice(10)] = entry(key, storeGet(key) || '');
  }
  return doc;
}
function applyDoc(doc) {
  applyingRemote = true;
  const meta = loadMeta();
  Object.keys(doc.checks || {}).forEach(function (id) {
    const row = doc.checks[id];
    const key = 'jp26_v2_' + id;
    if ((meta[key] || 0) <= row.at) {
      storeSet(key, row.v ? '1' : '0');
      meta[key] = row.at;
    }
  });
  let checks = customChecks();
  meta.removedChecks = meta.removedChecks || {};
  Object.keys(doc.customChecks || {}).forEach(function (id) {
    const row = doc.customChecks[id];
    const stamp = meta[CHECK_KEY + ':' + id] || meta.removedChecks[id] || 0;
    if (stamp > row.at) return;
    checks = checks.filter(function (item) { return item.id !== id; });
    if (row.v) checks.push(row.v);
    else meta.removedChecks[id] = row.at;
    meta[CHECK_KEY + ':' + id] = row.at;
  });
  storeSet(CHECK_KEY, JSON.stringify(checks));
  let rests = customRestaurants();
  meta.removedRests = meta.removedRests || {};
  Object.keys(doc.restaurants || {}).forEach(function (id) {
    const row = doc.restaurants[id];
    const stamp = meta[CUSTOM_KEY + ':' + id] || meta.removedRests[id] || 0;
    if (stamp > row.at) return;
    rests = rests.filter(function (item) { return item.id !== id; });
    if (row.v) rests.push(row.v);
    else meta.removedRests[id] = row.at;
    meta[CUSTOM_KEY + ':' + id] = row.at;
  });
  storeSet(CUSTOM_KEY, JSON.stringify(rests));
  Object.keys(doc.food || {}).forEach(function (id) {
    const key = 'jp26_food_' + id;
    if ((meta[key] || 0) <= doc.food[id].at) { storeSet(key, doc.food[id].v ? '1' : '0'); meta[key] = doc.food[id].at; }
  });
  Object.keys(doc.booked || {}).forEach(function (id) {
    const key = 'jp26_rest_' + id;
    if ((meta[key] || 0) <= doc.booked[id].at) { storeSet(key, doc.booked[id].v ? '1' : '0'); meta[key] = doc.booked[id].at; }
  });
  Object.keys(doc.notes || {}).forEach(function (date) {
    const key = 'jp26_note_' + date;
    if ((meta[key] || 0) <= doc.notes[date].at) { storeSet(key, doc.notes[date].v || ''); meta[key] = doc.notes[date].at; }
  });
  P.storageSet(localStorage, META_KEY, JSON.stringify(meta));
  applyingRemote = false;
}
let pushTimer = 0;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushState, 400);
}
function sameDoc(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function pushState() {
  const sent = snapshot();
  fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sent) })
    .then(function (res) { return res.json(); })
    .then(function (doc) {
      if (sameDoc(doc, sent)) return;
      applyDoc(doc);
      refreshShared();
    })
    .catch(function () {});
}
function pullState() {
  fetch(SYNC_URL)
    .then(function (res) { return res.json(); })
    .then(function (doc) {
      const merged = P.mergeShared(snapshot(), doc);
      if (sameDoc(merged, snapshot())) return;
      applyDoc(merged);
      refreshShared();
    })
    .catch(function () {});
}
function refreshShared() {
  renderChecklist();
  render(new Set([...document.querySelectorAll('.day[open]')].map(function (el) { return el.id; })));
}
pullState();
setInterval(pullState, 4000);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./service-worker.js').catch(function () {});
}
initMap();
