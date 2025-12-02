# Deploy / Switch Firebase Project

This document explains how to point the app to a different Firebase project (useful when moving to another Firebase account).

1) Create new Firebase project
- Go to https://console.firebase.google.com/ and create a new project.
- Enable Firestore (native mode), Authentication (Email/Password), and Storage if used.

2) Register a Web App and copy client config
- In Project Settings → Your apps → Add a web app.
- Copy the config object values: `apiKey`, `authDomain`, `projectId`, `appId`, `messagingSenderId`, `measurementId`.

3) Create Service Account for server/admin actions
- Project Settings → Service accounts → Generate new private key.
- Save the JSON file securely (example: `C:\secrets\firebase-service-account.json`).

4) Local development (PowerShell)
- Install dependencies:
```powershell
cd 'c:\Users\rodrigo\Documents\My Carwashapp'
npm install
```

- Set environment variables in the same PowerShell session (example):
```powershell
$env:NEXT_PUBLIC_FIREBASE_API_KEY = 'your_api_key'
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'your-project.firebaseapp.com'
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'your_project_id'
$env:NEXT_PUBLIC_FIREBASE_APP_ID = 'your_app_id'
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'your_messaging_sender_id'
# Optional: measurement id
$env:NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = ''

# For server/admin actions (create users, set claims) set the service account JSON
$env:FIREBASE_SERVICE_ACCOUNT_KEY = Get-Content -Raw 'C:\secrets\firebase-service-account.json'

npm run dev
# Open http://localhost:9002
```

5) Deploying to production (Vercel / hosting)
- Add the `NEXT_PUBLIC_FIREBASE_*` variables in your host's environment variable settings (Vercel: Project Settings → Environment Variables).
- Add `FIREBASE_SERVICE_ACCOUNT_KEY` as a secret/environment variable on the host (value is the full JSON string).
- Deploy the Firestore rules using Firebase CLI:
```powershell
firebase login
firebase use --add  # select the new project
firebase deploy --only firestore:rules
```

6) Migrating data (optional, advanced)
- Use `gcloud` to export/import Firestore data between projects (requires proper permissions and billing enabled):
  - Export from source project to a GCS bucket
  - Import into destination project
- Auth users export/import requires password hashes; often easier to recreate users or ask them to reset passwords.

Square payments environment
- If you plan to use Square in production, set the following environment variables on your host:
  - `SQUARE_ACCESS_TOKEN` (secret)
  - `SQUARE_LOCATION_ID`

Local dev note: If `SQUARE_ACCESS_TOKEN` is not set, the server action will return a mock success response so flows won't break during development.

7) Security notes
- Never commit service account JSON to the repo.
- Use host secret managers (Vercel, AWS Secrets Manager, GCP Secret Manager) for production.
- Verify your `firestore.rules` and `storage.rules` after switching projects.

If you want, I can:
- Patch the repo to read client config from environment variables (already applied).
- Add a script to create the first admin account remotely (I can add `scripts/create-first-admin.js`).
- Help you set environment variables on Vercel or Firebase Hosting.
