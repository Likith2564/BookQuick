# BookQuick

Real-time-ish alerting for movie ticket bookings: add a movie/cinema/date on
the website, and get emailed the moment its BookMyShow booking status flips
from "coming soon" to open.

Two parts:

- **[`web/`](web)** — Next.js site. Sign in with a magic-link email, add/remove
  watches. Backed by Supabase (Postgres + auth), deployed free on Vercel.
- **[`check.py`](check.py)** — the checker. Runs on a GitHub Actions schedule
  (every ~5–10 minutes, GitHub's minimum granularity), reads every user's
  watchers from Supabase, fetches each target's booking page, and emails via
  [Resend](https://resend.com) when a status flips to open.

No server of your own to run, no Redis/queue — see
[docs/architecture.html](docs/architecture.html) for the production design
this is the free-tier stepping stone toward.

## One-time setup

### 1. Supabase (database + auth)

1. Create a free project at [supabase.com](https://supabase.com).
2. Dashboard → SQL Editor → New query → paste [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. Dashboard → Settings → API. You'll need three values from here:
   - **Project URL**
   - **anon / public key** — safe to expose in the website
   - **service_role key** — full access, bypasses row-level security.
     Only ever goes in `check.py`'s env / GitHub secrets. **Never** put it
     in the website.
4. Dashboard → Authentication → URL Configuration: add your site's URL
   (`http://localhost:3000` for local dev, your Vercel URL once deployed)
   to **Redirect URLs**, so magic-link emails redirect back correctly.

### 2. Resend (email)

Sign up at [resend.com](https://resend.com) (free: 100 emails/day), grab a
key from [resend.com/api-keys](https://resend.com/api-keys).

Resend's sandbox sender `onboarding@resend.dev` only delivers to the email
you signed up with — fine while testing solo. Once other people are using
the site, verify a domain at resend.com/domains and send from an address
on it instead.

### 3. The website (`web/`)

```bash
cd web
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

Open http://localhost:3000, sign in via magic link, add a watch.

Deploy: push to GitHub, import the repo on [vercel.com](https://vercel.com)
with **root directory set to `web/`**, add the same two env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Vercel's
project settings.

### 4. The checker (`check.py`)

Add as **GitHub Actions repo secrets** (Settings → Secrets and variables →
Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`ALERT_FROM`. The workflow in
[`.github/workflows/check.yml`](.github/workflows/check.yml) runs on its
own schedule from there — nothing else to start.

To run/test locally instead:

```bash
pip install -r requirements.txt
cp .env.example .env   # fill in the same four values
python check.py
```

Without those env vars set, `check.py` still runs and logs what it *would*
have sent, so you can test detection logic without spamming yourself.

## Adding a watch's URL correctly

For BookMyShow, use **"Showtime detection"** mode with the movie's
**buytickets** page (language/format + date already selected) — not the
movie's landing page, whose "Book tickets" button is present whether or
not booking is actually open. Get it by opening the movie on
bookmyshow.com, clicking "Book tickets", picking a language/format — the
resulting URL is the one to use. The buytickets page renders real showtime
slots ("07:15 PM" etc.) as plain text once seats go on sale, and none
beforehand — that's the actual signal `check.py` looks for.

For other platforms, use "Text marker" mode with `open_marker` /
`closed_marker` text found by hand via browser devtools.

## Known limitations (by design, for now)

- 5-minute polling floor — GitHub Actions won't schedule more often.
  Faster detection needs something always-on (see the "Robust Polling"
  milestone in the architecture doc).
- One `buytickets` URL per watch, fetched fresh each run — no proxy
  rotation or headless-browser fallback yet for platforms that block plain
  HTTP requests (BookMyShow doesn't, as tested).
- Browser extension (original Phase 4 in the architecture doc) hasn't been
  built — the website covers the same "add a watch" job for now.
