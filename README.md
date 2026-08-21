# BookQuick — free-tier MVP

Zero-infra version of the alerting engine: a script on a GitHub Actions
schedule checks each target's booking page, diffs against the last known
status in `state.json`, and emails you the moment one flips to open.

No Redis, no database, no server to run. Costs $0. Ceiling: checks every
~5–10 minutes (GitHub Actions' minimum schedule granularity), and status
detection is a simple text-marker heuristic rather than a parsed API
response — good enough to prove the loop works, not the final word on
detection reliability.

See [docs/architecture.html](docs/architecture.html) for the target
production design this scales into.

## Setup

1. **Add targets** — edit [`targets.yaml`](targets.yaml). For each movie:
   - For BookMyShow, use `mode: showtime_regex` with the movie's
     **buytickets** URL (see the comments in `targets.yaml` for how to get
     it) — this is the reliable signal, unlike the movie page's "Book
     tickets" button which is present whether or not booking is open.
   - For other platforms: `open_marker` / `closed_marker` text found by
     hand via browser devtools.
   - `email`: where the alert goes.

2. **Set email credentials** as GitHub repo secrets
   (Settings → Secrets and variables → Actions):
   - `RESEND_API_KEY` — from [resend.com/api-keys](https://resend.com/api-keys)
     (free: 100 emails/day, sign up with just an email, no card).
   - `ALERT_FROM` — `onboarding@resend.dev` works immediately for testing;
     switch to an address on your own verified domain later if you want.

3. **Push to GitHub.** The workflow in
   [`.github/workflows/check.yml`](.github/workflows/check.yml) runs on its
   own schedule — nothing else to start.

4. **Test manually** before waiting on the schedule: repo → Actions →
   "Check booking status" → Run workflow.

## Run locally

```bash
pip install -r requirements.txt
cp .env.example .env   # then edit .env with your real RESEND_API_KEY
python check.py
```

`check.py` auto-loads `.env` if present. Without `RESEND_API_KEY` set, it
still runs and logs what it *would* have sent — useful for tuning
`open_marker`/`closed_marker` or `showtime_regex` without spamming
yourself.

## Known limitations (by design, for now)

- Text-marker detection breaks if the site redesigns its page — swap in a
  JSON-endpoint parser per platform once you know which sites you're
  actually tracking (see `fetch_status()` in `check.py`).
- 5-minute polling floor. For faster detection you need something always-on
  (see the "Robust Polling" milestone in the architecture doc) instead of
  GitHub Actions' scheduler.
- One email address per target, no browser extension, no per-user accounts
  yet — this is Milestone 1 of the roadmap in `docs/architecture.html`.
