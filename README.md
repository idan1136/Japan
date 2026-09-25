# Japan 2026 — Portable Trip App

החבילה כוללת את האתר, הנתונים והתמונות המקומיות.

## קבצים עיקריים
- `index.html` — האתר
- `css/style.css` — העיצוב
- `js/app.js` — הלוגיקה
- `data/content.js` — הנתונים שהאתר קורא בפועל
- `data/*.json` — עותקי נתונים נפרדים ונוחים לייבוא/עריכה
- `data/restaurants.csv` — כל המסעדות בקובץ שנפתח ב-Excel/Google Sheets
- `images/` — תמונות/איורים מקומיים ואייקוני האפליקציה
- `manifest.json` + `service-worker.js` — תמיכה בהתקנה כ-PWA

## העלאה ל-Netlify
העלי את כל התיקייה `japan-2026-app` (או חלצי את ה-ZIP והעלי את התיקייה). `index.html` חייב להישאר בשורש.

## התקנה באייפון
אחרי שהאתר פומבי ב-Netlify: Safari → Share → Add to Home Screen.

## עריכת נתונים
כרגע האתר קורא מ-`data/content.js` כדי שגם פתיחה מקומית תעבוד בלי שרת. קבצי ה-JSON וה-CSV הם עותקים מסודרים של אותם נתונים.
