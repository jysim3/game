// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
// import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { fetchAndActivate, getRemoteConfig } from "firebase/remote-config";

const firebaseConfig = {
  apiKey: "AIzaSyDxOgOeHFVzZAFt6USqyiZOsjwdWVDSxI4",
  authDomain: "jysim3-1.firebaseapp.com",
  projectId: "jysim3-1",
  storageBucket: "jysim3-1.firebasestorage.app",
  messagingSenderId: "364146645897",
  appId: "1:364146645897:web:a5348ebbb6a2dafb08df58",
  measurementId: "G-NGZG40LQ7Q",
  databaseURL: "https://jysim3-1-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const database = getDatabase(app);
// export const auth = getAuth(app);
export const remoteConfig = getRemoteConfig(app);
if (window.location.hostname === "localhost") {
  //connectFirestoreEmulator(db, "127.0.0.1", 8080);
  //connectAuthEmulator(auth, "http://127.0.0.1:9099");
}
remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
remoteConfig.defaultConfig = {
  phoneCountryCode: "+61",
};
fetchAndActivate(remoteConfig);
