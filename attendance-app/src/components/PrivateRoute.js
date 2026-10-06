import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { useUserRole } from '../hooks/useUserRole';

export default function PrivateRoute({ children, roles }) {
  const [user, authLoading] = useAuthState(auth);
  const profile = useUserRole(user);
  if (authLoading || (user && profile.loading)) return <div role="status" className="surface p-8 text-center">Carregando acesso…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile.error) return <section role="alert" className="surface mx-auto max-w-2xl space-y-3 p-6"><h1 className="text-lg font-semibold">Não foi possível validar seu acesso</h1><p>{profile.error}</p><p className="break-all text-sm text-gray-600 dark:text-gray-300">Seu UID: <strong>{user.uid}</strong></p><button onClick={profile.retry} className="btn-primary">Tentar novamente</button><button onClick={() => navigator.clipboard?.writeText(user.uid)} className="ml-2 rounded-lg border px-3 py-2">Copiar UID</button></section>;
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return children;
}
