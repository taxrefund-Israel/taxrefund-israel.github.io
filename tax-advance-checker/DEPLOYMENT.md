<div dir="rtl">

# מדריך פריסה — שרת המשרד (רשת פנימית סגורה)

מטרה: התקנת המערכת על השרת הקיים, כך שכל מחשב ברשת ניגש דרך הדפדפן,
וההיסטוריה נשמרת מרכזית ב-PostgreSQL — משותפת, מגובה, עם audit trail.

---

## שלב 1 — דרישות מקדימות בשרת

צריך **Docker** + **Docker Compose** מותקנים על השרת:
- **Windows Server / Windows 10/11** → Docker Desktop
- **Linux (Ubuntu/Debian)** → `docker` + `docker compose plugin`
- **NAS (Synology/QNAP)** → חבילת Container Manager / Container Station

בדיקה שהכל מותקן:
```bash
docker --version
docker compose version
```

---

## שלב 2 — העתקת הפרויקט לשרת

העתק את כל תיקיית `tax-advance-checker` לשרת (כונן מקומי, לא תיקיית רשת —
לביצועים טובים יותר). לדוגמה ל-`C:\apps\tax-advance-checker` או `/opt/tax-advance-checker`.

---

## שלב 3 — הגדרת קובץ הסביבה

צור `.env` מתוך הדוגמה:
```bash
cp .env.example .env
```

ערוך את `.env` — **חובה לשנות בפרודקשן**:
```bash
# סיסמאות חזקות
POSTGRES_PASSWORD=<סיסמה-חזקה-אקראית>
MINIO_ROOT_PASSWORD=<סיסמה-חזקה-אקראית>
JWT_SECRET=<מחרוזת-אקראית-ארוכה-לפחות-32-תווים>

# משתמש מנהל ראשוני
SEED_ADMIN_EMAIL=admin@barshaf.co.il
SEED_ADMIN_PASSWORD=<סיסמה-ראשונית-חזקה>
SEED_ADMIN_NAME=מנהל המערכת

# כתובת ה-IP הקבועה של השרת ברשת (במקום 192.168.1.50)
NEXT_PUBLIC_API_URL=http://192.168.1.50:8000
CORS_ORIGINS=http://192.168.1.50:3000
```

> **חשוב:** הגדר לשרת **כתובת IP קבועה** (סטטית או הזמנה ב-DHCP), אחרת הכתובת תשתנה.

---

## שלב 4 — הרמת המערכת

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

בהרצה הראשונה אוטומטית: יצירת טבלאות + טעינת פרמטרי מס 2026 + יצירת משתמש מנהל.

בדיקת סטטוס:
```bash
docker compose ps
```

---

## שלב 5 — גישה מהמחשבים ברשת

כל עובד פותח בדפדפן:
```
http://192.168.1.50:3000
```
ומתחבר עם המייל והסיסמה שהוגדרו לו (המנהל יוצר משתמשים דרך מסך «משתמשים»).

---

## שלב 6 — אבטחת המעגל הסגור

1. **Firewall בשרת** — לחסום תעבורה יוצאת לאינטרנט; לאפשר רק רשת מקומית.
2. **ללא port forwarding** בראוטר — שום פורט לא נחשף לאינטרנט.
3. רק פורטים `3000` (ממשק) ו-`8000` (API) צריכים להיות נגישים ברשת הפנימית.
   PostgreSQL ו-MinIO **לא** חשופים החוצה (מטופל ב-`docker-compose.prod.yml`).

---

## שלב 7 — גיבוי אוטומטי (קריטי להיסטוריה)

ההיסטוריה כולה ב-PostgreSQL והקבצים ב-MinIO. הרץ גיבוי יומי:

**Linux (cron):** הוסף ל-`crontab -e`:
```bash
0 2 * * * /opt/tax-advance-checker/backup.sh
```

**Windows (Task Scheduler):** צור משימה יומית שמריצה `backup.ps1`.

הסקריפטים מצורפים בתיקייה (`backup.sh` / `backup.ps1`).

---

## תפעול שוטף

```bash
# צפייה בלוגים
docker compose logs -f backend

# עצירה
docker compose down

# הפעלה מחדש אחרי שינוי .env
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# שדרוג גרסה (אחרי עדכון קוד)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## שחזור מגיבוי

```bash
# שחזור מסד הנתונים
docker exec -i tac_db psql -U tac -d tax_advance_checker < backups/db_YYYY-MM-DD.sql
```

</div>
