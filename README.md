# Workout Control — Baz5488.github.io

Mobile-first Progressive Web App for workout logging and progressive overload.

## Features
- Dashboard
- Full-body workout logging
- Reps / sets / load / RIR
- Rest timer
- Automatic next-target recommendation
- Progress view
- Weight and waist tracking
- Workout history
- JSON backup / restore
- PWA install support
- Optional Supabase authentication + cloud sync
- Local-first operation when cloud is not configured

## Deploy to GitHub Pages
This package is intended for the user-site repository:

`Baz5488.github.io`

1. Create the repository with that exact name (lowercase username is the GitHub convention).
2. Upload all files/folders from this package to the repository root.
3. Go to **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Choose `main` and `/ (root)`.
6. Save and wait a few minutes.
7. Open `https://baz5488.github.io/`.

GitHub Pages is a static host, so server-side PHP/Python code is not used here.

## Enable cloud database
1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. In Supabase Authentication settings, enable Email provider.
4. Copy the project URL and anon/publishable key into `config.js`.
5. Commit/push `config.js` to GitHub. The anon/publishable key is browser-facing; security comes from Row Level Security policies in the SQL schema.
6. Open the app, go to Settings, and create an account.

## Important
Do not put a Supabase service-role/secret key into `config.js` or any browser file.

## If you want a different repository
For `Baz5488/workout`, the project URL would normally be:
`https://baz5488.github.io/workout/`
not the root `https://baz5488.github.io/`.
