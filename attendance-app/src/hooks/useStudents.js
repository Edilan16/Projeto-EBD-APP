// src/hooks/useStudents.js
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export function useStudents() {
  return useQuery(['students'], async () => {
    const snap = await getDocs(collection(db, 'students'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}