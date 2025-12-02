# Firebase Studio

This is a NextJS starter in Firebase Studio.

Quick start
1. Copy `.env.example` to `.env.local` and fill the `NEXT_PUBLIC_FIREBASE_*` values with your Firebase web app config.
2. If you need admin actions (create users, set claims), set `FIREBASE_SERVICE_ACCOUNT_KEY` in your environment using the service account JSON.
3. Install and run:

```powershell
npm install
npm run dev
```

See `README-DEPLOY.md` for full deploy and switching-project instructions.

To explore the app, open `src/app/page.tsx`.
