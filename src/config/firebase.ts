import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCPPR8D8Jk1hMWR2IHBCxSG7u5S3XKnSsk",
  authDomain: "my-carwashapp-e6aba.firebaseapp.com",
  projectId: "my-carwashapp-e6aba",
  storageBucket: "my-carwashapp-e6aba.firebasestorage.app",
  messagingSenderId: "1095794498344",
  appId: "1:1095794498344:web:138095a4caf33d25a84e1d",
  measurementId: "G-0D2ZHGEQNN"
};

// Inicializar solo si no existe
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Forzar online mode (sin persistencia)
if (typeof window !== 'undefined') {
  // @ts-ignore - forzar configuración online
  db._settings.experimentalForceLongPolling = true;
}
