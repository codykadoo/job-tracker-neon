// Firebase Web SDK initialization for browser (module script)
// Docs: https://firebase.google.com/docs/web/setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// Optional SDKs you can enable next:
// import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBLbyxHRh8Ve9gGDne8wLldTjeVpugDd7s",
  authDomain: "jobmapper-1b4f2.firebaseapp.com",
  projectId: "jobmapper-1b4f2",
  storageBucket: "jobmapper-1b4f2.firebasestorage.app",
  messagingSenderId: "269814150490",
  appId: "1:269814150490:web:0e8e5b5b45e7f9cb8daf63",
  measurementId: "G-JCC160XLGM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
window.firebaseApp = app;

// Initialize Auth
const auth = getAuth(app);
window.firebaseAuth = auth;
window.firebaseSignIn = async (email, password) => {
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred.user;
};

// Expose password reset function for self-service reset links
window.firebaseSendPasswordReset = async (email) => {
  if (!email || typeof email !== 'string') {
    throw new Error('A valid email address is required');
  }
  return await sendPasswordResetEmail(auth, email);
};

// Initialize Analytics when supported
const ANALYTICS_ENABLED = (typeof localStorage !== 'undefined' && localStorage.getItem('ENABLE_ANALYTICS') === 'true');
isSupported().then((supported) => {
  if (supported && ANALYTICS_ENABLED) {
    const analytics = getAnalytics(app);
    window.firebaseAnalytics = analytics;
    console.log("Firebase Analytics initialized");
  } else {
    // Disabled by default to avoid noisy GA requests in development
    // Enable by setting localStorage.setItem('ENABLE_ANALYTICS','true') in the console
    // or via an app-level toggle.
    // Note: We still log support state minimally for visibility.
    if (!ANALYTICS_ENABLED) {
      console.log("Firebase Analytics disabled (set ENABLE_ANALYTICS=true to enable)");
    } else {
      console.log("Firebase Analytics not supported in this environment");
    }
  }
});