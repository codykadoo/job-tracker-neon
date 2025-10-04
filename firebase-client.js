// Firebase Web SDK initialization for browser (module script)
// Docs: https://firebase.google.com/docs/web/setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
// Optional SDKs you can enable next:
// import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

// Initialize Analytics when supported
isSupported().then((supported) => {
  if (supported) {
    const analytics = getAnalytics(app);
    window.firebaseAnalytics = analytics;
    console.log("Firebase Analytics initialized");
  } else {
    console.log("Firebase Analytics not supported in this environment");
  }
});