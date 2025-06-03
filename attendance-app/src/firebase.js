// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBGyy0fIZOtqAQYOu1xNFsFitVK9gP7JRg",
  authDomain: "presen-ebd.firebaseapp.com",
  projectId: "presen-ebd",
  storageBucket: "presen-ebd.firebasestorage.app",
  messagingSenderId: "1026014965697",
  appId: "1:1026014965697:web:26d93509fb2272bd5a8940",
  measurementId: "G-L8JH8Y5WLD"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Habilita cache/offline persistence com suporte a múltiplas abas
try {
  enableIndexedDbPersistence(db, { synchronizeTabs: true });
} catch (err) {
  if (err.code === 'failed-precondition') {
    // Provavelmente múltiplas abas abertas
    console.warn('Persistência não habilitada: múltiplas abas abertas.');
  } else if (err.code === 'unimplemented') {
    // O navegador não suporta todas as funcionalidades necessárias
    console.warn('Persistência não suportada neste navegador.');
  } else {
    console.warn('Erro ao habilitar persistência:', err);
  }
}