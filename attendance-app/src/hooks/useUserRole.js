import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useUserRole(user) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(!!user);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const creatingProfile = useRef(false);

  useEffect(() => {
    if (!user) { setRole(null); setLoading(false); setError(''); return undefined; }
    setLoading(true); setError(''); creatingProfile.current = false;
    const profileRef = doc(db, 'users', user.uid);
    return onSnapshot(profileRef, snapshot => {
      if (snapshot.exists()) {
        const nextRole = snapshot.data().role;
        if (nextRole === 'admin' || nextRole === 'teacher') {
          setRole(nextRole); setError(''); setLoading(false);
        } else {
          setRole(null); setError('O perfil não tem uma função válida. Peça ao administrador para corrigir o perfil.'); setLoading(false);
        }
        return;
      }
      setLoading(true);
      if (creatingProfile.current) return;
      creatingProfile.current = true;
      setDoc(profileRef, {
        role: 'teacher',
        email: user.email || '',
        displayName: user.displayName || '',
        createdAt: serverTimestamp()
      }).catch(() => {
        setError('Não foi possível criar seu perfil. Peça a um administrador para cadastrar seu UID no Firebase.');
        setLoading(false);
      }).finally(() => { creatingProfile.current = false; });
    }, () => {
      setRole(null); setError('Não foi possível consultar seu perfil de acesso. Verifique a conexão e as regras do Firestore.'); setLoading(false);
    });
  }, [user, attempt]);

  return { role, loading, error, retry: () => setAttempt(value => value + 1) };
}
