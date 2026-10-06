import React, { useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { useUserRole } from '../hooks/useUserRole';
import { UserPlus, ShieldCheck, Copy } from 'lucide-react';

export default function UserManagement() {
  const [currentUser] = useAuthState(auth);
  const { role: currentRole } = useUserRole(currentUser);
  const [users, setUsers] = useState([]);
  const [uid, setUid] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('teacher');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => onSnapshot(collection(db, 'users'), snapshot => setUsers(snapshot.docs.map(item => ({ uid: item.id, ...item.data() })).sort((a, b) => (a.displayName || a.email || a.uid).localeCompare(b.displayName || b.email || b.uid, 'pt-BR'))), () => setError('Não foi possível carregar usuários. Confira suas permissões.')), []);
  const isAdmin = currentRole === 'admin';
  const canChange = user => user.uid !== currentUser?.uid;

  async function saveUser(event) {
    event.preventDefault();
    const cleanUid = uid.trim();
    if (!isAdmin || !cleanUid || cleanUid.includes('/')) return;
    if (cleanUid === currentUser.uid && newRole !== 'admin') { setError('Não é possível remover seu próprio acesso de administrador nesta tela.'); return; }
    setBusy(true); setError(''); setStatus('');
    try {
      await setDoc(doc(db, 'users', cleanUid), {
        role: newRole,
        email: email.trim(),
        displayName: displayName.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      setStatus('Perfil salvo. O usuário terá a nova permissão na próxima atualização do perfil.');
      setUid(''); setEmail(''); setDisplayName(''); setNewRole('teacher');
    } catch {
      setError('Não foi possível salvar o perfil. Confira se o UID pertence a uma conta do Firebase Authentication.');
    } finally { setBusy(false); }
  }

  async function changeRole(user, value) {
    if (!canChange(user) || !window.confirm(`Alterar ${user.displayName || user.email || user.uid} para ${value === 'admin' ? 'administrador' : 'professor'}?`)) return;
    setError(''); setStatus('');
    try {
      await setDoc(doc(db, 'users', user.uid), { role: value, updatedAt: serverTimestamp() }, { merge: true });
      setStatus('Permissão atualizada.');
    } catch { setError('Não foi possível alterar a permissão.'); }
  }

  if (!isAdmin) return <p role="alert" className="surface p-5">Esta área é exclusiva para administradores.</p>;
  return <section className="mx-auto max-w-4xl space-y-5">
    <header><h1 className="page-title">Usuários e permissões</h1><p className="page-subtitle">Defina quem pode administrar o app e quem pode registrar chamadas.</p></header>
    {status && <p role="status" className="surface border-l-4 border-emerald-600 p-3 text-emerald-900">{status}</p>}{error && <p role="alert" className="surface border-l-4 border-rose-600 p-3 text-rose-800">{error}</p>}
    <form onSubmit={saveUser} className="surface grid gap-3 p-5 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Cadastrar ou atualizar um perfil</h2><label className="text-sm font-medium">UID do Firebase Authentication<input value={uid} onChange={event => setUid(event.target.value)} className="field mt-1" required /></label><label className="text-sm font-medium">Permissão<select value={newRole} onChange={event => setNewRole(event.target.value)} className="field mt-1"><option value="teacher">Professor</option><option value="admin">Administrador</option></select></label><label className="text-sm font-medium">Nome para exibição (opcional)<input value={displayName} onChange={event => setDisplayName(event.target.value)} className="field mt-1" /></label><label className="text-sm font-medium">E-mail (opcional)<input type="email" value={email} onChange={event => setEmail(event.target.value)} className="field mt-1" /></label><button disabled={busy} className="btn-primary inline-flex items-center justify-center gap-2 sm:col-span-2"><UserPlus size={17}/>{busy ? 'Salvando…' : 'Salvar perfil'}</button></form>
    <section className="surface overflow-hidden"><div className="border-b border-gray-100 p-4 dark:border-gray-700"><h2 className="font-semibold">Perfis cadastrados</h2><p className="mt-1 text-sm text-gray-500">O usuário precisa existir em Authentication antes de receber um perfil.</p></div><div className="divide-y divide-gray-100 dark:divide-gray-700">{users.map(user => <div key={user.uid} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate font-medium">{user.displayName || user.email || 'Usuário sem nome'}</p><p className="break-all text-xs text-gray-500">UID: {user.uid}</p></div><span className="text-sm">{user.role === 'admin' ? 'Administrador' : 'Professor'}</span>{canChange(user) && <select aria-label={`Permissão de ${user.displayName || user.email || user.uid}`} value={user.role} onChange={event => changeRole(user, event.target.value)} className="field w-auto"><option value="teacher">Professor</option><option value="admin">Administrador</option></select>}</div>)}{!users.length && <p className="p-6 text-center text-sm text-gray-500">Nenhum perfil encontrado.</p>}</div></section>
    <aside className="surface flex items-start gap-3 p-4 text-sm text-gray-600 dark:text-gray-300"><ShieldCheck size={19} className="mt-0.5 shrink-0"/><p>Para cadastrar alguém, crie primeiro a conta em Firebase Authentication e copie o UID dela. O usuário recebe acesso de professor quando entrar pela primeira vez; você pode promovê-lo nesta tela.</p><button title="Copiar seu UID" className="shrink-0 rounded p-1" onClick={() => navigator.clipboard?.writeText(currentUser.uid)}><Copy size={16}/></button></aside>
  </section>;
}

