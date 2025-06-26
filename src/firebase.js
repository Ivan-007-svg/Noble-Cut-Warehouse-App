import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyATvsgeJE6i7Q6vcXEd4Lo5fxZwASQNqsY",
  authDomain: "noble-cut.firebaseapp.com",
  projectId: "noble-cut",
  storageBucket: "noble-cut.appspot.com",
  messagingSenderId: "823877688810",
  appId: "1:823877688810:web:c9f25c0c83a8b2324b6693"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
