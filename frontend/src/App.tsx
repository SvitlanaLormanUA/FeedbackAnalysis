import './App.css'
import AdminApp from './admin/AdminApp'
import FeedbackPage from './pages/FeedbackPage'

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '')

  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminApp />
  }

  return <FeedbackPage />
}
