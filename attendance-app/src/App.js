import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import TeacherSchedule from './pages/TeacherSchedule';
import DataBackup from './pages/DataBackup';
import UserManagement from './pages/UserManagement';
const FinanceEntry = lazy(() => import('./pages/FinanceEntry'));
const FinanceReport = lazy(() => import('./pages/FinanceReport'));

export default function App() {
  return <Router><div className="app-shell"><Navbar/><main className="app-main"><Suspense fallback={<div role="status" className="surface p-8 text-center text-gray-600 dark:text-gray-300">Carregando página…</div>}><Routes>
    <Route path="/login" element={<Login/>}/>
    <Route path="/" element={<PrivateRoute><Dashboard/></PrivateRoute>}/>
    <Route path="/students" element={<PrivateRoute><Students/></PrivateRoute>}/>
    <Route path="/attendance" element={<PrivateRoute><Attendance/></PrivateRoute>}/>
    <Route path="/reports" element={<PrivateRoute><Reports/></PrivateRoute>}/>
    <Route path="/teacher-schedule" element={<PrivateRoute><TeacherSchedule/></PrivateRoute>}/>
    <Route path="/backup" element={<PrivateRoute roles={['admin']}><DataBackup/></PrivateRoute>}/>
    <Route path="/users" element={<PrivateRoute roles={['admin']}><UserManagement/></PrivateRoute>}/>
    <Route path="/finance-entry" element={<PrivateRoute roles={['admin']}><FinanceEntry/></PrivateRoute>}/>
    <Route path="/finance-report" element={<PrivateRoute roles={['admin']}><FinanceReport/></PrivateRoute>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense></main></div></Router>;
}




