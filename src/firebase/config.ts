// Configuration is loaded from environment variables so you can point
// this app to any Firebase project without changing source files.
// Client-visible variables must be prefixed with NEXT_PUBLIC_.
export const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
};

// Helpful runtime check when running locally to catch missing vars early.
if (typeof window !== 'undefined') {
  // client runtime: warn if minimal config missing (only for dev)
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    // eslint-disable-next-line no-console
    console.warn('[firebase/config] Missing NEXT_PUBLIC_FIREBASE_* variables. The app may not initialize correctly.');
  }
}
