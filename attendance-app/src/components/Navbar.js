// src/components/Navbar.js
import React from 'react';
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useDarkMode } from '../hooks/useDarkMode'
import { Menu, X, Sun, Moon } from 'lucide-react'

export default function Navbar() {
  const navigate = useNavigate()
  const [dark, setDark] = useDarkMode()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/login')
  }

  const links = [
    { to: '/students', label: 'Alunos' },
    { to: '/attendance', label: 'Presença' },
    { to: '/reports', label: 'Relatórios' },
    { to: '/finance-entry', label: 'Lançamentos' },
    { to: '/finance-report', label: 'Financeiro' },
    { to: '/teacher-schedule', label: 'Escala de Professores' },
  ]

  return (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between bg-navbar dark:bg-navbar-dark text-white px-4 py-3 shadow-md fixed w-full z-20">
        <button onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu size={24} />
        </button>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setDark(d => !d)}
            className="p-2 rounded hover:bg-blue-500 transition"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded transition"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-10"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slider menu */}
          <aside
      className={
        'fixed top-0 left-0 h-full w-64 bg-navbar dark:bg-navbar-dark shadow-xl z-20 transform transition-transform duration-300 ' +
        (open ? 'translate-x-0' : '-translate-x-full')
      }
    >
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <span className="font-bold text-lg text-gray-800 dark:text-gray-100">
            Menu
          </span>
          <button onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X size={20} className="text-gray-800 dark:text-gray-100" />
          </button>
        </div>
        <nav className="flex flex-col mt-4 px-4 space-y-2">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded text-white hover:bg-white/10 dark:hover:bg-white/10 transition"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
