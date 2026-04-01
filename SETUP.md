# LetLearn – Supabase + Local Dev Setup

## Prerequisites
- Node.js 18+
- Docker Desktop (running)
- Supabase CLI

---

## 1. Install Supabase CLI

```bash
npm install -g supabase
```

## 2. Start Local Supabase

```bash
supabase init       # first time only
supabase start
```

After starting, you'll get output like:
```
API URL: http://127.0.0.1:54321
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Copy the **anon key** and paste it into `js/main.js`:
```js
const SUPABASE_ANON_KEY = 'paste-your-anon-key-here';
```

## 3. Run the Database Migration

```bash
supabase db push
```

Or open http://127.0.0.1:54323 (Supabase Studio) → SQL Editor → paste content of `supabase/migrations/001_schema.sql` → Run.

## 4. Enable Google OAuth (for Google Sign-In)

### For local dev:
1. Go to http://127.0.0.1:54323 → Authentication → Providers → Google
2. Toggle on, add your Google OAuth credentials
3. Set **Redirect URL** to: `http://127.0.0.1:5500` (or your live-server port)

### For production (Supabase cloud):
1. Create project at https://supabase.com
2. Go to Authentication → Providers → Google
3. Add Google Client ID + Secret from https://console.cloud.google.com
4. Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/main.js` to cloud values

## 5. Serve the Site Locally

Use VS Code Live Server extension, or:
```bash
npx serve .
```

Open: http://localhost:5500

---

## File Structure

```
letlearn/
├── index.html                    ← Homepage
├── letlearn-signup.html          ← Sign up page
├── letlearn-tutor-signup.html    ← Tutor application page
├── letlearn-admin.html           ← Admin dashboard
├── css/
│   └── styles.css                ← All shared styles
├── js/
│   └── main.js                   ← Search engine, auth, modals
└── supabase/
    └── migrations/
        └── 001_schema.sql        ← DB schema (students, tutors, tracking)
```

## Tables Created

| Table | Purpose |
|-------|---------|
| `students` | Student accounts (linked to Supabase auth) |
| `tutor_applications` | Tutor sign-up applications |
| `scholarship_tracking` | Student scholarship save/apply tracking |
| `bookings` | Tutor session bookings |

## Cloudflare Worker
The AI scholarship search uses:
```
https://wandering-sea-42e1.adelakunabdulsalam001.workers.dev
```
This is already configured in `js/main.js`. No changes needed.
