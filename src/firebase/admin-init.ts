
import { initFirestore } from '@google-cloud/firestore';
import { initializeApp, getApp, getApps, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

function getServiceAccount() {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('Firebase service account key not found. Please set the FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
  }
  try {
    return JSON.parse(serviceAccountKey);
  } catch (e) {
    throw new Error('Failed to parse Firebase service account key. Make sure it is a valid JSON string.');
  }
}

let adminApp: App | undefined;

export function initializeAdminApp() {
  if (getApps().some(app => app.name === 'admin')) {
    const app = getApp('admin');
    return { app };
  }
  
  const serviceAccount = getServiceAccount();
  const app = initializeApp({
    credential: credential.cert(serviceAccount)
  }, 'admin');

  return { app };
}

export function createAuthorizedFirestore() {
  const db = new initFirestore({
    // The `channel` setting is experimental and subject to change.
    channel: {
      secure: true
    }
  });

  return db;
}
