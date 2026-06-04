# World Cup 2026 Companion

A fully automatic, public web app that predicts who wins the World Cup and acts
as a daily companion: the title race, fixtures & results, group tables, and top
scorers. No login, no admin — scores arrive on a schedule and the app updates
itself.

Built with Next.js, deployed on Vercel, data from football-data.org.

---

## What's inside (plain English)

- **THE RACE** — all 48 teams ranked by their chance to win, seeded from the
  FIFA ranking. After every finished match both teams' ratings shift (the same
  Elo maths FIFA uses) and the whole board re-sorts. ▲▼ shows how far each team
  has climbed or slid since the pre-tournament seeding.
- **FIXTURES & RESULTS** — every match, grouped by day, with live and final
  scores.
- **GROUPS** — all 12 groups, each with the model's **predicted winner** and the
  real standings as games are played.
- **TOP SCORERS** — the golden-boot leaderboard (goals only).

It works **before the tournament starts too**: with no results yet it shows the
seed board, the fixtures, and friendly "starts June 11" panels for groups and
scorers.

### The two layers (so you can redesign safely)

- **The brain** is in `lib/` — the data and the maths. Leave it alone unless you
  want to change *how numbers are worked out*.
- **The face** is `app/` (the pages), `components/` (the building blocks) and
  `app/globals.css` (all the styling). Change these freely.

When you want a visual tweak, tell Claude Code: *"Only touch the styling — do
not change how results are pulled or calculated."*

---

## Deploying to Vercel — step by step

You'll do this once. Budget an afternoon of back-and-forth; that's normal.

### Step 1 — Get your free data token

1. Go to **https://www.football-data.org/client/register**.
2. Sign up. They email you an **API token** (a long string).
3. Keep it handy — you paste it into Vercel in Step 4. **Never put it in the
   code.**

### Step 2 — Put the code on GitHub

The folder you push is **this `wc2026` folder** (not its parent).

If you don't have a GitHub account, create one free at https://github.com.

The project already has a local git commit ready. To publish it:

1. On GitHub, click **New repository**, name it e.g. `wc2026`, leave it empty
   (no README), click **Create**.
2. GitHub shows you two commands under *"…or push an existing repository"*. In a
   terminal, from inside this `wc2026` folder, run them. They look like:

   ```bash
   git remote add origin https://github.com/YOUR-NAME/wc2026.git
   git branch -M main
   git push -u origin main
   ```

   (Copy the exact lines GitHub shows you — they have your username in them.)

### Step 3 — Import the project into Vercel

1. Go to **https://vercel.com** and sign up (the **Hobby** plan is free; signing
   in with GitHub is easiest).
2. Click **Add New… → Project**.
3. Find your `wc2026` repository and click **Import**.
4. Vercel auto-detects Next.js. **Leave all build settings at their defaults.**
   Don't click Deploy yet — do Step 4 first (or deploy, then add the token and
   redeploy).

### Step 4 — Add your environment variables

On the import screen (or later under **Project → Settings → Environment
Variables**), add:

| Name | Value |
| --- | --- |
| `FOOTBALL_DATA_TOKEN` | the token from Step 1 |
| `CRON_SECRET` | any long random string (e.g. run `openssl rand -hex 32`) |

`CRON_SECRET` is optional but recommended — it stops strangers from poking the
refresh endpoint.

### Step 5 — Deploy

Click **Deploy**. After a minute you get a live URL like
`https://wc2026-yourname.vercel.app`. That's your public app — share it.

> If you added the token *after* the first deploy, trigger a fresh deploy:
> **Deployments → … → Redeploy** so the new variable takes effect.

That's the Definition of Done: a public URL, the board live from seed ratings,
updating automatically as results come in.

---

## How the automatic updating works

- Each page pulls from football-data.org and **caches the result for a few
  minutes**. So it respects the free-tier rate limit and stays fast.
- When the cache expires, the next visitor triggers a quiet background refresh.
  A visit a few minutes later shows the new numbers.
- Ratings are **recomputed from scratch** every time by replaying all finished
  matches from the seed — so a match can never be counted twice. No database
  needed.
- A **daily Vercel Cron** (`vercel.json`) also nudges a refresh as a safety net.

### Want refreshes every 30 minutes?

Vercel's **free Hobby plan limits cron jobs to once per day**, so this ships set
to daily. The app still stays current from visitor traffic. If you upgrade to
**Pro** and want a guaranteed 30-minute beat, edit `vercel.json`:

```json
{ "crons": [ { "path": "/api/cron/refresh", "schedule": "*/30 * * * *" } ] }
```

---

## Running it on your own computer (optional)

```bash
# 1. install once
npm install

# 2. add your token for local testing
cp .env.local.example .env.local
#   then open .env.local and paste your token

# 3. start it
npm run dev
#   open http://localhost:3000
```

Without a token locally it runs in **preview mode**: the seed board shows, and
the other tabs show their "starts June 11" panels. That's expected.

---

## Adjusting the look later

Three ways, easiest first:

1. **Ask Claude Code in plain English** — "make the headline bigger", "change
   the pink accent to green", "more space on the cards". Remind it: *only touch
   the styling.*
2. **Edit `app/globals.css`** — the colours live at the top under `:root`
   (`--accent` pink, `--accent-2` teal, `--gold`). Fonts and spacing are all in
   that one file.
3. **Hand Claude Code a screenshot** of a mockup to rebuild against.

Keep design changes and data/logic changes in **separate steps** so a UI tweak
can't break the working engine.

---

## Optional polish (later)

- FIFA refreshes its ranking on **June 9** — you can update the seed ratings in
  `lib/teams.ts` then for the freshest start.
- A "share this board as an image" button.
- "Movement since the last refresh" (instead of since seeding) — this is the one
  feature that would need a small key-value store (e.g. Upstash Redis via the
  Vercel Marketplace). Not needed for v1.

---

## Troubleshooting

- **Everything says "preview mode" / "no data token".** The token isn't set, or
  you set it after deploying. Add `FOOTBALL_DATA_TOKEN` in Vercel and redeploy.
- **Groups/scorers are empty.** Normal before matches are played. Standings and
  scorers only fill in once games happen.
- **A team's flag is missing.** football-data.org may spell a team differently
  than our list — add the spelling to `lib/names.ts`.
- **Hit a build error.** Copy the full message and bring it back to Claude Code.
