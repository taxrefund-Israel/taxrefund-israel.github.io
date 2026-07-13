<div dir="rtl">

# כלי ציבורי — בדיקת מקדמות עצמאי 2026

עמוד HTML יחיד (`index.html`) לשילוב באתר: מחשבון מקדמות + התחברות Google + שמירת
היסטוריה בענן לכל משתמש (Firestore) + תוכן SEO. ללא שרת לתחזק.

**גישה מאומתת:** השדות **נעולים** עד התחברות עם חשבון Google. ניסיון להזין נתונים
ללא התחברות מציג הודעה וכפתור התחברות. כך כל שימוש בכלי משויך למשתמש — ומאפשר
שמירת היסטוריה אישית (וגם איסוף לידים איכותי).

**העלאת קבצים בצד הלקוח:** הכלי מנתח **מאזן בוחן** (Excel/PDF) ו**תלושי שכר** (PDF)
ומחלץ את הנתונים אוטומטית — באמצעות SheetJS ו-pdf.js, **לגמרי בתוך הדפדפן**. הקבצים
אף פעם לא נשלחים לשרת (יתרון פרטיות לכלי ציבורי). חילוץ דיגיטלי בלבד; PDF סרוק דורש
הזנה ידנית. כל הערכים המחולצים ניתנים לעריכה ובדיקה.

---

## שלב 1 — יצירת פרויקט Firebase (חינמי)

1. היכנס ל-[Firebase Console](https://console.firebase.google.com) → **Add project**.
2. תן שם (למשל `barshaf-tools`), סיים את האשף.
3. בתפריט → **Build → Authentication → Get started** → לשונית **Sign-in method** →
   הפעל **Google** → Save.
4. בתפריט → **Build → Firestore Database → Create database** → מצב **Production** →
   בחר אזור (למשל `europe-west`).

### קבלת מפתחות החיבור
5. ⚙️ **Project settings → General →** גלול ל-"Your apps" → לחץ **</> (Web)** →
   רשום אפליקציה → העתק את אובייקט `firebaseConfig`.
6. הדבק אותו ב-`index.html` במקום ה-placeholder (חפש `PASTE_API_KEY`).

> מפתחות Firebase ל-Web הם **ציבוריים מטבעם** — האבטחה נאכפת ב-Firestore Rules (שלב 2),
> לא בהסתרת המפתח.

---

## שלב 2 — כללי אבטחה ב-Firestore

ב-Firestore → לשונית **Rules** → הדבק והפעל (Publish):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/calculations/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

כך כל משתמש יכול לקרוא/לכתוב **רק** את הבדיקות שלו עצמו.

---

## שלב 3 — הרשאת הדומיין

ב-**Authentication → Settings → Authorized domains** → הוסף את הדומיין של האתר שלך
(למשל `www.barshaf.co.il`) ואת דומיין ה-Cloudflare Pages (`*.pages.dev`).
`localhost` כבר מורשה לבדיקות מקומיות.

---

## שלב 4 — פרסום ב-Cloudflare Pages

**אפשרות א' — העלאה ישירה:**
1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Upload assets**.
2. גרור את תיקיית `public-tool` (המכילה את `index.html`).
3. תקבל כתובת `https://<name>.pages.dev`.

**אפשרות ב' — מתוך Git / wrangler:**
```bash
npx wrangler pages deploy public-tool --project-name=advance-tax-tool
```

**שילוב כעמוד באתר קיים:** העתק את `index.html` לנתיב כמו `/tools/advance-tax-2026/`
באתר הסטטי, ועדכן את ה-`<link rel="canonical">` לכתובת הסופית.

---

## שלב 5 — SEO וקישור ממחלקת הכלים

1. באתר, תחת "כלים", הוסף קישור: **בדיקת מקדמות עצמאי 2026** → לעמוד.
2. ה-`<title>`, `description`, Open Graph ו-Schema.org כבר מובנים בעמוד.
3. עדכן את ה-`canonical` ואת ה-`og:title` לכתובת ולמיתוג שלך.
4. הוסף את העמוד ל-`sitemap.xml` של האתר כדי שגוגל יסרוק אותו.
5. התוכן (article) בתחתית מספק טקסט עשיר למילות מפתח — אפשר להרחיב לפי הצורך.

---

## בדיקה מקומית

פתח את `index.html` בדפדפן. ללא הגדרת Firebase — המחשבון יעבוד, אך התחברות
והיסטוריה יציגו הודעה. לאחר הדבקת `firebaseConfig` — התחברות Google והיסטוריה יעבדו
(גם מ-`localhost`).

---

## שלב 6 — הוספה למדור "כלים דיגיטליים" באתר

העמוד כבר מעוצב בשפת המשרד (זהב `#BF9B30` על כהה `#1B1B1E`, פונט almoni, לוגו, פוטר).
מומלץ לפרסם בתת-דומיין `advance.barshaf-cpa.com` (כמו `simulator` ו-`travel`).

הוסף את הכרטיס הבא ל-`barshaf-cpa-static/index.html`, בתוך `<div class="tools-grid">`
(אחרי הכרטיסים הקיימים):

```html
<a class="tool-card" href="https://advance.barshaf-cpa.com/" target="_blank" rel="noopener">
  <div class="tool-card-line"></div>
  <span class="tool-card-title">בדיקת מקדמות עצמאי 2026</span>
  <span class="tool-card-desc">בדיקה חינמית של מקדמות מס הכנסה וביטוח לאומי לעצמאים — קבלו אחוז מקדמות מומלץ והימנעו מהפתעות בסוף השנה</span>
  <span class="tool-card-cta">← כניסה לכלי</span>
</a>
```

> הכרטיס משתמש במחלקות הקיימות באתר (`tool-card`, `tool-card-title`...) ולכן יתמזג
> אוטומטית בעיצוב מדור הכלים.

---

## שלב 7 — פרסום לאוויר (Go-Live) + הופעה בגוגל

**מה שכבר עודכן בקבצים (מוכן):**
- ✅ כרטיס הכלי נוסף ל-`barshaf-cpa-static/index.html` (תפריט "כלים דיגיטליים")
- ✅ הכלי נוסף ל-`barshaf-cpa-static/sitemap.xml` (נתיב גילוי מהדומיין הראשי)
- ✅ `public-tool/sitemap.xml` + `public-tool/robots.txt` (לתת-הדומיין)
- ✅ תגי `robots`, `canonical`, Open Graph ו-Schema.org בעמוד

**מה שדורש את החשבונות שלך (בצע לפי הסדר):**

1. **Firebase (חובה לפני העלאה — הכלי נעול בלי זה):** השלם את שלבים 1–3 למעלה
   (פרויקט, Google Auth, Firestore Rules), הדבק `firebaseConfig` ב-`index.html`.

2. **העלאה ל-Cloudflare Pages:**
   ```bash
   npx wrangler pages deploy public-tool --project-name=advance-tax-tool
   ```

3. **חיבור תת-הדומיין `advance.barshaf-cpa.com`:**
   - ב-Cloudflare Pages → Project → **Custom domains → Set up a custom domain** →
     `advance.barshaf-cpa.com` (Cloudflare יוסיף רשומת CNAME אוטומטית אם הדומיין מנוהל אצלו).

4. **Firebase Authorized domains:** הוסף `advance.barshaf-cpa.com` תחת
   Authentication → Settings → Authorized domains (אחרת התחברות Google תיכשל בפרודקשן).

5. **פרסום מחדש של האתר הראשי** (כדי שכרטיס הכלי וה-sitemap המעודכן יעלו):
   ```bash
   npx wrangler pages deploy barshaf-cpa-static --project-name=<שם-הפרויקט-הקיים>
   ```

### הופעה בחיפושי גוגל

6. **Google Search Console** ([search.google.com/search-console](https://search.google.com/search-console)):
   - הוסף **Property** חדש מסוג URL prefix: `https://advance.barshaf-cpa.com/`
   - אמת בעלות (Cloudflare TXT — אוטומטי אם הדומיין אצל Cloudflare).
   - **Sitemaps →** הגש `https://advance.barshaf-cpa.com/sitemap.xml`
   - **URL Inspection →** הזן את כתובת הכלי → **Request Indexing**.
7. בנכס הקיים של `barshaf-cpa.com` → הגש מחדש את `sitemap.xml` המעודכן.

> **הערה על SEO לעמוד נעול:** הנעילה (overlay) היא ויזואלית בלבד — תוכן המאמר נמצא
> ב-HTML ונסרק במלואו ע"י גוגל. לכן הכלי יופיע בחיפושים על "מקדמות עצמאי 2026" וכד',
> והגולש מתבקש להתחבר רק כשהוא מנסה להזין נתונים.

---

## ההבדל מהמערכת הפנימית

| | כלי ציבורי (כאן) | מערכת פנימית (משרד) |
|---|---|---|
| קהל | כל גולש | עובדי המשרד |
| התחברות | Google | מייל+סיסמה מאושר |
| נתונים | Firestore (ענן Google) | PostgreSQL בשרת המשרד |
| העלאת קבצים / מאזן | ❌ (מחשבון מהיר) | ✅ |
| מטרה | SEO + לידים | בדיקות מקצועיות מלאות |

המנוע זהה בשניהם (מדרגות 2026, ביטוח לאומי, נקודות זיכוי, חלוקת הוצאות).

</div>
