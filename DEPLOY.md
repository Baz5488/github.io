# Deployment checklist

## A. Create the correct GitHub Pages repository
Create a **public** repository named exactly:

`Baz5488.github.io`

GitHub user-site repositories use the `<username>.github.io` convention.

## B. Upload
Upload the contents of this folder, not the parent folder itself. `index.html` must be in the repository root.

## C. Pages
Repository → Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)` → Save.

## D. Open
`https://baz5488.github.io/`

If it still shows the old 404, wait a few minutes and hard-refresh. GitHub notes publication can take up to about 10 minutes.

## E. Cloud sync
The app works without cloud sync. For cloud sync, create a Supabase project, run `supabase/schema.sql`, then edit `config.js`:

```js
window.WORKOUT_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-OR-PUBLISHABLE-KEY"
};
```

Never use the Supabase service-role/secret key in this file.
