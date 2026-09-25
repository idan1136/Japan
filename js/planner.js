(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Planner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const WALKING = new Set(['2026-10-01', '2026-10-02', '2026-10-04']);
  const DRIVING = new Set(['2026-10-05', '2026-10-06', '2026-10-09', '2026-10-11', '2026-10-12']);
  const MODES = new Set(['walking', 'driving', 'transit']);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function parseDay(iso) {
    const p = String(iso).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function todayISO(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function weekdayLabel(iso) {
    const parts = new Intl.DateTimeFormat('he-IL', { weekday: 'short' }).formatToParts(parseDay(iso));
    const part = parts.find(function (item) { return item.type === 'weekday'; });
    return part ? part.value : '';
  }

  function dayDomId(iso) {
    return 'day-' + Number(String(iso).slice(-2));
  }

  function countdown(now) {
    const today = parseDay(todayISO(now));
    const start = parseDay('2026-10-01');
    const end = parseDay('2026-10-16');
    const until = daysBetween(today, start);
    if (until > 1) return { phase: 'before', days: until, value: String(until), label: 'ימים עד הטיול' };
    if (until === 1) return { phase: 'before', days: 1, value: '1', label: 'יום עד הטיול' };
    if (until === 0) return { phase: 'start', days: 0, value: 'היום', label: 'הטיול מתחיל היום' };
    const index = daysBetween(start, today) + 1;
    const total = daysBetween(start, end) + 1;
    if (index <= total) return { phase: 'during', days: index, value: String(index), label: 'יום ' + index + ' מתוך ' + total };
    return { phase: 'after', days: 0, value: '✓', label: 'הטיול הסתיים' };
  }

  function travelMode(day) {
    if (day.travel && MODES.has(day.travel)) return day.travel;
    if (WALKING.has(day.d)) return 'walking';
    if (DRIVING.has(day.d)) return 'driving';
    return 'transit';
  }

  function routePoints(day) {
    const route = (day.route || []).slice();
    if (day.d === '2026-10-14' && route.length === 1) return ['The Blossom Hibiya', route[0]];
    return route;
  }

  function mapSearch(query) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query + ', Japan');
  }

  function mapDirections(points, mode) {
    const list = points || [];
    if (list.length < 2) return mapSearch(list[0] || 'Japan');
    const travel = MODES.has(mode) ? mode : 'walking';
    const enc = encodeURIComponent;
    const origin = enc(list[0] + ', Japan');
    const dest = enc(list[list.length - 1] + ', Japan');
    const wp = list.slice(1, -1).map(function (point) { return enc(point + ', Japan'); }).join('|');
    let url = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + dest + '&travelmode=' + travel;
    if (wp) url += '&waypoints=' + encodeURIComponent(wp).replace(/%7C/g, '|');
    return url;
  }

  function routeLinkLabel(points) {
    return points && points.length >= 2 ? 'פתח את המסלול ב-Google Maps ↗' : 'פתיחה במפות ↗';
  }

  function hotelFor(iso, hotels) {
    const day = Number(String(iso).slice(-2));
    for (let i = 0; i < hotels.length; i += 1) {
      const match = String(hotels[i].dates).match(/(\d+)(?:–(\d+))?\.10/);
      if (!match) continue;
      const from = Number(match[1]);
      const to = match[2] ? Number(match[2]) : from;
      if (day >= from && day <= to) return hotels[i];
    }
    return null;
  }

  function mapLines(places) {
    const by = {};
    places.forEach(function (place) { by[place.name] = [place.lat, place.lng]; });
    return {
      main: [by.Tokyo, by['Kamikochi / Takayama'], by.Kanazawa, by.Okinawa, by.Tokyo],
      dayTrips: [[by.Okinawa, by.Zamami], [by.Tokyo, by.Gotemba, by.Tokyo]]
    };
  }

  function restaurantSummary(total, booked) {
    return 'עוד מסעדות באזור · ' + total + ' (' + booked + ' הוזמנו)';
  }

  const ALIAS_GROUPS = [
    ['ginza', 'גינזה'],
    ['yurakucho', 'יוראקוצו'],
    ['hibiya', 'היביה', 'היבייה'],
    ['shibuya', 'שיבויה'],
    ['harajuku', 'הראג׳וקו', 'הראגוקו'],
    ['omotesando', 'אומוטסנדו'],
    ['ebisu', 'אביסו'],
    ['nakameguro', 'נקאמגורו', 'נאקאמגורו'],
    ['daikanyama', 'דאיקניאמה'],
    ['shimokitazawa', 'שימוקיטזאווה', 'שימוקיטאזאווה'],
    ['shinjuku', 'שינג׳וקו', 'שינגוקו'],
    ['kabukicho', 'קבוקיצו'],
    ['asakusa', 'אסאקוסה'],
    ['kuramae', 'קוראמה'],
    ['yanaka', 'יאנקה'],
    ['nezu', 'נזו'],
    ['kagurazaka', 'קגוראזקה'],
    ['roppongi', 'רופונגי'],
    ['gotemba', 'גותמבה', 'גוטמבה'],
    ['kanazawa', 'קנזאווה'],
    ['takayama', 'טקיאמה'],
    ['kamikochi', 'קמיקוצי'],
    ['okinawa', 'אוקינאווה'],
    ['naha', 'נהה'],
    ['zamami', 'זמאמי'],
    ['tokyo', 'טוקיו'],
    ['japan', 'יפן']
  ];
  const GENERIC_TERMS = new Set(['tokyo', 'טוקיו', 'japan', 'יפן']);

  const CHECKLIST = [
    { id: 'before', title: 'לפני הטיול', items: [
      { id: 'passport', label: 'דרכון בתוקף' },
      { id: 'esim', label: 'eSIM או אינטרנט ליפן' },
      { id: 'suica', label: 'כרטיס IC / Suica' },
      { id: 'cash', label: 'מזומן בינים' },
      { id: 'insurance', label: 'ביטוח נסיעות' },
      { id: 'adapter', label: 'מתאם חשמל לשקע יפני' },
      { id: 'zamami', label: 'הפלגה לזמאמי · 10.10' },
      { id: 'itaema', label: 'Itaema Sushi · להזמין' },
      { id: 'lantern', label: 'להחליט אם נוסעים לפסטיבל הפנסים · 3.10' },
      { id: 'tug', label: 'לתאם צלילה מול משיכת החבל בנאהה · 11.10' },
      { id: 'harry', label: 'לשמור את כרטיס Harry Potter · 3.10 בשעה 11:30' },
      { id: 'luggage', label: 'לתכנן מזוודות לטיסות הפנים טוקיו ↔ אוקינאווה' }
    ]},
    { id: 'pack', title: 'לארוז', items: [
      { id: 'shoes', label: 'נעלי הליכה' },
      { id: 'rain', label: 'מעיל גשם דק' },
      { id: 'layers', label: 'שכבות לערב באלפים' },
      { id: 'swim', label: 'בגד ים וציוד שנורקל' },
      { id: 'meds', label: 'תרופות אישיות' },
      { id: 'battery', label: 'סוללה ניידת' }
    ]},
    { id: 'during', title: 'במהלך הטיול', items: [
      { id: 'checkin-ginza', label: 'צ׳ק-אין Hotel Musse Ginza · 1.10' },
      { id: 'car', label: 'איסוף רכב לטקיאמה וקמיקוצ׳י · 5.10' },
      { id: 'flight-oka', label: 'טיסה לאוקינאווה · 8.10' },
      { id: 'flight-back', label: 'טיסה חזרה לטוקיו · 13.10' },
      { id: 'checkout', label: 'צ׳ק-אאוט וטיסה הביתה · 16.10' }
    ]}
  ];

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/['’׳״"]/g, '').replace(/\s+/g, ' ').trim();
  }

  function termMatches(token, alias) {
    if (token === alias) return true;
    if (token.length < 3 || alias.length < 3) return false;
    return alias.startsWith(token) || token.startsWith(alias);
  }

  function expandQuery(query) {
    const tokens = normalize(query).split(' ').filter(Boolean);
    const terms = new Set();
    tokens.forEach(function (token) {
      let grouped = false;
      ALIAS_GROUPS.forEach(function (group) {
        const normalized = group.map(normalize);
        if (normalized.some(function (alias) { return termMatches(token, alias); })) {
          grouped = true;
          normalized.forEach(function (alias) { terms.add(alias); });
        }
      });
      if (!grouped) terms.add(token);
    });
    return { tokens: tokens, terms: [...terms] };
  }

  function blobHits(blob, terms) {
    return terms.some(function (term) { return term.length > 1 && blob.includes(term); });
  }

  function placeRestaurant(input, ctx) {
    const name = String(input.name || '').trim();
    const area = String(input.area || '').trim();
    const forced = String(input.date || '').trim();
    const expanded = expandQuery(area || name);
    const specific = expanded.terms.filter(function (term) { return !GENERIC_TERMS.has(term); });
    const ranked = [];
    if (specific.length) {
      ctx.days.forEach(function (day) {
        if (day.d === '2026-10-16') return;
        const stay = hotelFor(day.d, ctx.hotels || []);
        const food = (ctx.foodStops && ctx.foodStops[day.d] || []).map(function (stop) { return stop.name + ' ' + stop.area; }).join(' ');
        const fields = [
          { weight: 8, label: 'המסלול עובר שם', text: (day.route || []).join(' ') },
          { weight: 5, label: 'יש שם אוכל באותו אזור', text: food },
          { weight: 4, label: 'זה אזור המלון', text: stay ? stay.name + ' ' + stay.area : '' },
          { weight: 4, label: 'זה על מעבר של היום', text: (day.moves || []).flat().join(' ') },
          { weight: 2, label: 'זה מופיע בתיאור היום', text: day.title + ' ' + day.summary + ' ' + ((ctx.regionNames || {})[day.region] || '') }
        ];
        let score = 0;
        let why = '';
        fields.forEach(function (field) {
          if (blobHits(normalize(field.text), specific)) {
            score += field.weight;
            if (!why) why = field.label;
          }
        });
        if (score > 0) ranked.push({ date: day.d, title: day.title, score: score, why: why });
      });
      ranked.sort(function (a, b) { return b.score - a.score || a.date.localeCompare(b.date); });
    }
    if (forced) {
      const chosen = ctx.days.find(function (day) { return day.d === forced; });
      return { date: forced, title: chosen ? chosen.title : '', reason: 'שמתם את זה ביום שבחרתם', confident: true, alternatives: [] };
    }
    if (!specific.length) {
      return { date: null, title: '', reason: 'זה אזור כללי מדי, ויש כמה ימים מתאימים. בחרו יום.', confident: false, alternatives: [] };
    }
    if (!ranked.length) {
      return { date: null, title: '', reason: area ? 'לא מצאתי את האזור במסלול. בחרו יום ידנית.' : 'כתבו שכונה או אזור, למשל Ebisu או קנזאווה.', confident: false, alternatives: [] };
    }
    const best = ranked[0];
    const tied = ranked.filter(function (item) { return item.score === best.score; });
    if (tied.length > 1) {
      return { date: null, title: '', reason: 'יש כמה ימים שמתאימים באותה מידה. בחרו יום.', confident: false, alternatives: tied.slice(0, 4) };
    }
    const alternatives = ranked.slice(1, 3);
    return { date: best.date, title: best.title, reason: best.why, confident: true, alternatives: alternatives };
  }

  function storageGet(storage, key) {
    try { return storage.getItem(key); } catch (err) { return null; }
  }

  function storageSet(storage, key, value) {
    try { storage.setItem(key, value); } catch (err) { /* private mode */ }
  }

  return {
    escapeHtml: escapeHtml,
    weekdayLabel: weekdayLabel,
    todayISO: todayISO,
    countdown: countdown,
    travelMode: travelMode,
    routePoints: routePoints,
    mapSearch: mapSearch,
    mapDirections: mapDirections,
    routeLinkLabel: routeLinkLabel,
    hotelFor: hotelFor,
    mapLines: mapLines,
    dayDomId: dayDomId,
    restaurantSummary: restaurantSummary,
    storageGet: storageGet,
    storageSet: storageSet,
    checklist: CHECKLIST,
    normalize: normalize,
    placeRestaurant: placeRestaurant
  };
});
