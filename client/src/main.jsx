import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import axios from 'axios'

// Set default base URL from environment
axios.defaults.baseURL = import.meta.env.VITE_BASE_URL || ''

// Intercept requests: If Authorization header is missing or contains null/undefined,
// fallback to guest demo token if guest mode is active
axios.interceptors.request.use((config) => {
  const authHeader = config.headers?.Authorization
  if (!authHeader || authHeader === 'Bearer null' || authHeader === 'Bearer undefined' || authHeader === 'Bearer ') {
    const isGuest = sessionStorage.getItem('quickai_guest_mode')
    if (isGuest) {
      config.headers.Authorization = 'Bearer mock-token-guest'
    }
  }
  return config
})

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key')
}

createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl='/'>
    <BrowserRouter>
       <App />
    </BrowserRouter>
  </ClerkProvider>
)
