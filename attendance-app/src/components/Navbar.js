import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { useUserRole } from '../hooks/useUserRole';
import { useDarkMode } from '../hooks/useDarkMode';
import { Menu, X, Sun, Moon, BookOpen, Users, ClipboardCheck, ChartNoAxesColumn, Wallet, ReceiptText, CalendarDays, LogOut, House, DatabaseBackup, ShieldCheck } from 'lucide-react';

const links = [
  { to: '/', label: 'Início', icon: House },
  { to: '/students', label: 'Alunos', icon: Users },
  { to: '/attendance', label: 'Presença', icon: ClipboardCheck },
  { to: '/reports', label: 'Relatórios', icon: ChartNoAxesColumn },
  { to: '/finance-entry', label: 'Lançamentos', icon: Wallet, adminOnly: true },
  { to: '/finance-report', label: 'Financeiro', icon: ReceiptText, adminOnly: true },
  { to: '/teacher-schedule', label: 'Escala de professores', icon: CalendarDays },
  { to: '/backup', label: 'Backup e restauração', icon: DatabaseBackup, adminOnly: true },
  { to: '/users', label: 'Usuários e permissões', icon: ShieldCheck, adminOnly: true },
];

export default function Navbar() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const { role, loading: roleLoading, error: roleError } = useUserRole(user);
  const [dark, setDark] = useDarkMode();
  const [open, setOpen] = useState(false);
  const visibleLinks = links.filter(link => !link.adminOnly || role === 'admin');
  const handleLogout = async () => { await signOut(auth); setOpen(false); navigate('/login'); };

  return <>
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#176b55] px-4 text-white shadow-lg sm:px-6">
      <div className="flex items-center gap-3"><button onClick={() => setOpen(true)} aria-label="Abrir navegação" aria-expanded={open} className="rounded-lg p-2 hover:bg-white/10"><Menu size={21}/></button><BookOpen size={21}/><span className="font-semibold tracking-wide">Escola Bíblica</span></div>
      <div className="flex items-center gap-2"><button onClick={() => setDark(value => !value)} className="rounded-lg p-2 hover:bg-white/10" aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button><button onClick={handleLogout} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"><LogOut size={16}/><span className="hidden sm:inline">Sair</span></button></div>
    </header>
    {open && <button aria-label="Fechar navegação" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/45"/>}
    <aside aria-label="Navegação principal" className={`fixed bottom-0 left-0 top-0 z-50 w-[min(19rem,88vw)] transform bg-[#104d3e] p-4 text-white shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-white/15 px-2 pb-4 pt-2"><div className="flex items-center gap-3"><BookOpen/><div><p className="font-semibold">Escola Bíblica</p><p className="text-xs text-emerald-100/75">Painel de gestão</p></div></div><button onClick={() => setOpen(false)} aria-label="Fechar menu" className="rounded-lg p-2 hover:bg-white/10"><X size={20}/></button></div>
      {user && <div className="mx-1 mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3"><p className="truncate text-sm font-medium">{user.displayName || user.email || 'Conta conectada'}</p><div className="mt-1.5 flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${role === 'admin' ? 'bg-amber-300/20 text-amber-100' : 'bg-emerald-300/20 text-emerald-100'}`}>{role === 'admin' ? 'Administrador' : role === 'teacher' ? 'Professor' : roleError ? 'Perfil indisponível' : roleLoading ? 'Carregando perfil…' : 'Perfil não definido'}</span>{role === 'admin' && <span className="text-xs text-emerald-100/70">Acesso completo</span>}</div></div>}
      <nav className="mt-5 space-y-1">{visibleLinks.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({isActive}) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${isActive ? 'bg-white text-[#104d3e] font-semibold shadow' : 'text-emerald-50 hover:bg-white/10'}`}><Icon size={18}/>{label}</NavLink>)}</nav>
      <p className="absolute bottom-5 left-6 text-xs text-emerald-100/60">Organização com cuidado e propósito</p>
    </aside>
  </>;
}
