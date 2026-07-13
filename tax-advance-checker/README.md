<div dir="rtl">

# בדיקת מקדמות מס וביטוח לאומי

מערכת Web פנימית למשרד רואי חשבון לבדיקת התאמת מקדמות מס הכנסה וביטוח לאומי
ששולמו בפועל לעומת החבות הצפויה לתקופת ביניים במהלך שנת המס.

> מיועד לשימוש עובדי המשרד בלבד. שנת מס נוכחית: **2026**.

---

## תוכן עניינים

- [ארכיטקטורה](#ארכיטקטורה)
- [התקנה מהירה (Docker)](#התקנה-מהירה-docker)
- [התקנה ידנית (פיתוח)](#התקנה-ידנית-פיתוח)
- [משתמש ברירת מחדל](#משתמש-ברירת-מחדל)
- [מבנה הפרויקט](#מבנה-הפרויקט)
- [מנוע החישוב](#מנוע-החישוב)
- [בדיקות](#בדיקות)
- [עדכון פרמטרי מס](#עדכון-פרמטרי-מס)
- [גיבוי ואבטחה](#גיבוי-ואבטחה)

---

## ארכיטקטורה

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | Next.js 14 · TypeScript · Tailwind (RTL מלא) |
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2.0 |
| Database | PostgreSQL 16 |
| Storage | MinIO (תואם S3) — שמירת כל הקבצים שהועלו |
| Auth | JWT (email + password) · bcrypt |
| Reports | ReportLab (PDF) · openpyxl (Excel) |
| Parsing | pdfplumber · openpyxl · pandas |

</div>

```
┌──────────────┐   REST + JWT   ┌──────────────┐
│  Next.js     │ ─────────────► │  FastAPI     │
│  :3000       │ ◄───────────── │  :8000       │
└──────────────┘                └──────┬───────┘
                                       │
                          ┌────────────┴────────────┐
                          ▼                          ▼
                  ┌──────────────┐          ┌──────────────┐
                  │ PostgreSQL   │          │ MinIO        │
                  │ :5432        │          │ :9000/:9001  │
                  └──────────────┘          └──────────────┘
```

<div dir="rtl">

---

## התקנה מהירה (Docker)

דרישות מוקדמות: **Docker Desktop** (כולל Docker Compose v2).

</div>

```bash
# 1. שכפול / כניסה לתיקייה
cd tax-advance-checker

# 2. יצירת קובץ סביבה
cp .env.example .env
#    ערוך את .env — חובה לשנות JWT_SECRET וסיסמת admin בפרודקשן

# 3. הרמת כל השירותים
docker compose up --build
```

<div dir="rtl">

בהרצה הראשונה ה-Backend מריץ אוטומטית:
- `alembic upgrade head` — יצירת כל הטבלאות
- `python -m app.seed` — טעינת פרמטרי מס 2026 + יצירת משתמש admin

לאחר העלייה:

| שירות | כתובת |
|--------|-------|
| ממשק המערכת | http://localhost:3000 |
| API (Swagger) | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |

עצירה: `docker compose down` · מחיקת נתונים מלאה: `docker compose down -v`

---

## התקנה ידנית (פיתוח)

### Backend

</div>

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# הגדר משתני סביבה (או קובץ .env בתיקיית backend)
export DATABASE_URL="postgresql+psycopg://tac:tac_password@localhost:5432/tax_advance_checker"

alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

<div dir="rtl">

### Frontend

</div>

```bash
cd frontend
npm install
# צור .env.local עם: NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

<div dir="rtl">

---

## משתמש ברירת מחדל

נוצר אוטומטית מתוך `.env` (ניתן לשינוי):

| שדה | ערך ברירת מחדל |
|------|----------------|
| מייל | `admin@example.com` |
| סיסמה | `Admin123!` |
| תפקיד | Admin |

> **חובה להחליף סיסמה זו לפני שימוש אמיתי.** משתמשים נוספים נוצרים דרך מסך
> «משתמשים» (Admin בלבד). רק משתמשים מורשים במסד הנתונים יכולים להתחבר.

---

## מבנה הפרויקט

</div>

```
tax-advance-checker/
├── docker-compose.yml          # כל השירותים
├── .env.example
├── SPEC.md                     # מסמך אפיון מלא (PRD/ERD/Schema/Engine)
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app + routers
│   │   ├── config.py · database.py · security.py · deps.py · storage.py
│   │   ├── models.py · enums.py · api_schemas.py
│   │   ├── parsers.py          # מאזן בוחן (Excel/PDF) + תלושים
│   │   ├── seed.py             # פרמטרי מס 2026 + admin
│   │   ├── engine/             # ★ מנוע החישוב (Rules Engine)
│   │   │   ├── schemas.py
│   │   │   └── tax_engine.py
│   │   ├── services/calculation.py   # DB → engine → DB
│   │   └── routers/            # auth, cases, imports, advances,
│   │                           # calculations, reports, admin
│   ├── alembic/                # migrations
│   └── tests/                  # pytest — 22 בדיקות למנוע
└── frontend/
    ├── app/                    # App Router — login, dashboard, cases, admin
    ├── components/             # NavBar, Shell, case/*Tab
    └── lib/                    # api, auth, types, format
```

<div dir="rtl">

---

## מנוע החישוב

כל החישובים מבוססי **Rules Engine** מנותק מה-DB ונבדק ב-Unit Tests.
אפס פרמטרים מקודדים בקוד — מדרגות מס, נקודות זיכוי, מדרגות ב"ל ושווי נקודה
נטענים מטבלאות מסד הנתונים לפי שנת מס.

**עקרונות:**
- מס הכנסה — הכנסת התקופה מוקרנת לשנה מלאה, ממוסה לפי מדרגות, ומוחזרת יחסית (`months/12`)
- ביטוח לאומי — מדרגות חודשיות; הכנסת התקופה מחולקת לממוצע חודשי, מחויבת, ומוכפלת חזרה
- **כלל "שכר קודם"** — אצל עצמאי+שכיר, השכר ממצה קודם את המדרגה הנמוכה; רק היתרה מחויבת במסגרת העצמאי
- **בני זוג עצמאיים** — מס הכנסה וב"ל מחושבים **בנפרד** לכל אחד; המקדמה השוטפת היחידה המשותפת היא אחוז אחד מהמחזור המשותף
- **נקודות זיכוי** — בסיס + תוספת אישה + ילדים לפי גיל (2026) + נוספות ידניות, כולן יחסיות לתקופה

**ציון צבעוני** (לפי |פער| / חבות צפויה):
ירוק 0–10% · צהוב 10–20% · אדום מעל 20%

---

## בדיקות

</div>

```bash
cd backend
pytest -q
# 22 passed — מדרגות מס, נקודות זיכוי, ב"ל, כלל שכר-קודם, תקרות, בני זוג
```

<div dir="rtl">

---

## עדכון פרמטרי מס

ללא שינוי קוד — דרך מסך **Admin → פרמטרי מס**:
1. בחר שנת מס
2. ערוך מדרגות מס / מדרגות ב"ל / תקרות / נקודות זיכוי
3. שמור — חישובים חדשים ישתמשו מיד בפרמטרים המעודכנים

לפתיחת שנת מס חדשה: הזן את השנה ושמור את כל הטבלאות.

---

## גיבוי ואבטחה

- **קבצים** — כל קובץ שהועלה נשמר ב-MinIO לצמיתות (כולל גרסאות קודמות)
- **חישובים** — כל הרצת חישוב נשמרת כגרסה; הקודמות מסומנות `is_current=false`
- **Audit Trail** — מי ביצע, מתי, ואילו נתונים שונו (טבלת `calculation_audit`)
- **הרשאות** — Admin / Employee; רק משתמשים פעילים מורשים מתחברים
- בפרודקשן: החלף `JWT_SECRET`, סיסמאות MinIO/Postgres, והגבל CORS ל-domain האמיתי

---

*נבנה לפי מסמך האפיון [SPEC.md](SPEC.md).*

</div>
