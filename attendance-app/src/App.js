import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import TeacherSchedule from './pages/TeacherSchedule';

// Lazy loading das páginas financeiras
const FinanceEntry = lazy(() => import('./pages/FinanceEntry'));
const FinanceReport = lazy(() => import('./pages/FinanceReport'));

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
        <Navbar />

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-16">
          <Suspense fallback={<div className="text-center">Carregando...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route
                path="/students"
                element={
                  <PrivateRoute>
                    <Students />
                  </PrivateRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <PrivateRoute>
                    <Attendance />
                  </PrivateRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <PrivateRoute>
                    <Reports />
                  </PrivateRoute>
                }
              />
              <Route
                path="/teacher-schedule"
                element={
                  <PrivateRoute>
                    <TeacherSchedule />
                  </PrivateRoute>
                }
              />
              <Route
                path="/finance-entry"
                element={
                  <PrivateRoute>
                    <FinanceEntry />
                  </PrivateRoute>
                }
              />
              <Route
                path="/finance-report"
                element={
                  <PrivateRoute>
                    <FinanceReport />
                  </PrivateRoute>
                }
              />

              {/* Redireciona rotas desconhecidas para login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}
