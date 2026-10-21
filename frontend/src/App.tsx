import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/hooks/useAuth'
import { SettingsProvider } from '@/hooks/useSettings'
import { AppLayout } from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Patients from '@/pages/Patients'
import Browse from '@/pages/Browse'
import PatientRegister from '@/pages/PatientRegister'
import PatientDetails from '@/pages/PatientDetails'
import Analysis from '@/pages/Analysis'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/browse/:category" element={<Browse />} />
              <Route path="/browse/:category/:disease" element={<Browse />} />
              <Route path="/patients/new" element={<PatientRegister />} />
              <Route path="/patients/:id" element={<PatientDetails />} />
              <Route path="/patients/:id/edit" element={<PatientRegister />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/analysis/:id" element={<Analysis />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </SettingsProvider>
  )
}
