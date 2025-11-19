import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDWubQGHaj-ptTHy14OmObC2nvtk274Xr4",
  authDomain: "eran-pro-mini.firebaseapp.com",
  projectId: "eran-pro-mini",
  storageBucket: "eran-pro-mini.firebasestorage.app",
  messagingSenderId: "393620302230",
  appId: "1:393620302230:web:bd87f2af83e235a95395b7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const ADMIN_UID = "ezx6k9JhkPbqbq9uEEF2anZNd2I3";