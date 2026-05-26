import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const FIREBASE_ENABLED = Boolean(
  config.apiKey && config.projectId && config.appId,
);

export const DEFAULT_PAGE_ID =
  (import.meta.env.VITE_DEFAULT_PAGE_ID as string | undefined) ?? "toiki";

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function getFirebase(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
} | null {
  if (!FIREBASE_ENABLED) return null;
  if (!_app) {
    _app = initializeApp(config);
    _auth = getAuth(_app);
    _db = initializeFirestore(_app, { ignoreUndefinedProperties: true });
  }
  return { app: _app!, auth: _auth!, db: _db! };
}

export async function signInWithGoogle(): Promise<User> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured");
  const result = await signInWithPopup(fb.auth, new GoogleAuthProvider());
  return result.user;
}

export async function signOutAll(): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  await signOut(fb.auth);
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(fb.auth, cb);
}
