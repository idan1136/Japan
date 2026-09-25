const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const Planner = require('./js/planner.js');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('./data/content.js', 'utf8'), sandbox);
const data = sandbox.window.JAPAN_DATA;

test('weekday is the full Hebrew label, not the first word', function () {
  assert.equal(Planner.weekdayLabel('2026-10-01'), 'יום ה׳');
  assert.equal(Planner.weekdayLabel('2026-10-03'), 'שבת');
  data.days.forEach(function (day) {
    const label = Planner.weekdayLabel(day.d);
    assert.notEqual(label, 'יום', day.d);
    assert.equal(label.endsWith(','), false, day.d);
  });
});

test('countdown covers before, opening day, during, and after', function () {
  assert.deepEqual(Planner.countdown(new Date(2026, 8, 25, 23, 50)), { phase: 'before', days: 6, value: '6', label: 'ימים עד הטיול' });
  assert.equal(Planner.countdown(new Date(2026, 8, 30, 10)).label, 'יום עד הטיול');
  assert.equal(Planner.countdown(new Date(2026, 9, 1, 0, 10)).phase, 'start');
  assert.deepEqual(Planner.countdown(new Date(2026, 9, 5, 15)), { phase: 'during', days: 5, value: '5', label: 'יום 5 מתוך 16' });
  assert.equal(Planner.countdown(new Date(2026, 9, 17)).phase, 'after');
});

test('walking days are not sent to Google as transit', function () {
  ['2026-10-01', '2026-10-02', '2026-10-04'].forEach(function (iso) {
    const day = data.days.find(function (item) { return item.d === iso; });
    const url = new URL(Planner.mapDirections(Planner.routePoints(day), Planner.travelMode(day)));
    assert.equal(url.searchParams.get('travelmode'), 'walking', iso);
  });
  const alps = data.days.find(function (item) { return item.d === '2026-10-05'; });
  assert.equal(Planner.travelMode(alps), 'driving');
});

test('Gotemba is a return day trip and the main line ends in Tokyo', function () {
  const lines = Planner.mapLines(data.places);
  assert.deepEqual(lines.main[0], lines.main[lines.main.length - 1]);
  assert.notEqual(lines.main[lines.main.length - 1][0], 35.3077);
  const gotemba = data.days.find(function (item) { return item.d === '2026-10-14'; });
  const points = Planner.routePoints(gotemba);
  assert.equal(points.length, 2);
  const url = new URL(Planner.mapDirections(points, Planner.travelMode(gotemba)));
  assert.equal(url.searchParams.get('travelmode'), 'transit');
  assert.match(url.searchParams.get('origin'), /Blossom/);
});

test('every night except the flight home has the hotel from the hotel list', function () {
  data.days.forEach(function (day) {
    const stay = Planner.hotelFor(day.d, data.hotels);
    if (day.d === '2026-10-16') assert.equal(stay, null);
    else assert.ok(stay, day.d);
  });
  assert.equal(Planner.hotelFor('2026-10-04', data.hotels).name, 'Hotel Musse Ginza Meitetsu');
  assert.equal(Planner.hotelFor('2026-10-06', data.hotels).name, 'Honjin Hiranoya Kofukan');
});

test('map links escape ampersands and reject markup', function () {
  assert.equal(Planner.escapeHtml('a & <b>'), 'a &amp; &lt;b&gt;');
  const route = Planner.mapDirections(['Cat Street', 'Ebisu', 'Shibuya'], 'walking');
  assert.equal(route.includes('%2520'), false);
  assert.match(route, /waypoints=Ebisu%2C%20Japan/);
  const apple = Planner.mapDirections(['Ebisu', 'Shibuya'], 'walking', 'apple');
  assert.match(apple, /^https:\/\/maps\.apple\.com\/\?saddr=/);
  assert.match(apple, /dirflg=w/);
  const url = Planner.mapDirections(['A', 'B'], 'walking');
  assert.match(Planner.escapeHtml(url), /&amp;origin=/);
  assert.equal(new URL(Planner.mapDirections(['Only'], 'transit')).searchParams.get('query'), 'Only, Japan');
});

test('a restaurant lands on the day that actually visits that area', function () {
  const ctx = { days: data.days, hotels: data.hotels, foodStops: data.food_stops, regionNames: data.region_names };
  assert.equal(Planner.placeRestaurant({ name: 'Afuri', area: 'Ebisu' }, ctx).date, '2026-10-02');
  assert.equal(Planner.placeRestaurant({ name: 'בית קפה', area: 'זמאמי' }, ctx).date, '2026-10-10');
  assert.equal(Planner.placeRestaurant({ name: 'קאיסקי', area: 'קנזאווה' }, ctx).date, '2026-10-07');
  assert.equal(Planner.placeRestaurant({ name: 'Ramen', area: 'שינג׳וקו' }, ctx).date, '2026-10-03');
  assert.equal(Planner.placeRestaurant({ name: 'Outlets food', area: 'Gotemba' }, ctx).date, '2026-10-14');
  const vague = Planner.placeRestaurant({ name: 'משהו', area: 'טוקיו' }, ctx);
  assert.equal(vague.date, null);
  assert.equal(vague.confident, false);
  assert.equal(Planner.checklist.length, 3);
  assert.ok(Planner.checklist.some(function (group) { return group.items.some(function (item) { return item.id === 'zamami'; }); }));
});

test('storage failures do not throw', function () {
  const broken = { getItem: function () { throw new Error('denied'); }, setItem: function () { throw new Error('denied'); } };
  assert.equal(Planner.storageGet(broken, 'k'), null);
  assert.doesNotThrow(function () { Planner.storageSet(broken, 'k', '1'); });
});
