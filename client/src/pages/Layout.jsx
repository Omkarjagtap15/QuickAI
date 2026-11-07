import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'
import { Menu, Sparkles, X, UserCheck } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { SignIn, useUser } from '@clerk/clerk-react'

const Layout = () => {
  const navigate = useNavigate()
  const [sidebar, setSidebar] = useState(false)
  const { user } = useUser()
  const [isGuest, setIsGuest] = useState(() => Boolean(sessionStorage.getItem('quickai_guest_mode')))

  const handleEnterGuest = () => {
    sessionStorage.setItem('quickai_guest_mode', 'true')
    setIsGuest(true)
  }

  const isAuthorized = Boolean(user || isGuest)

  return isAuthorized ? (
    <div className='flex flex-col items-start justify-start h-screen'>
      <nav className='w-full px-8 min-h-14 flex items-center justify-between border-b border-gray-200 bg-white'>
        <img className='cursor-pointer w-32 sm:w-44' src={assets.logo} alt="QuickAI Logo" onClick={() => navigate('/')} />
        <div className='flex items-center gap-3'>
          {!user && isGuest && (
            <div className='flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-xs text-purple-700 font-medium'>
              <Sparkles className='w-3.5 h-3.5 text-purple-600' />
              <span>Guest Demo Mode (10 Free Quota)</span>
            </div>
          )}
          {sidebar ? (
            <X onClick={() => setSidebar(false)} className='w-6 h-6 text-gray-600 sm:hidden cursor-pointer' />
          ) : (
            <Menu onClick={() => setSidebar(true)} className='w-6 h-6 text-gray-600 sm:hidden cursor-pointer' />
          )}
        </div>
      </nav>
      <div className='flex-1 w-full flex h-[calc(100vh-64px)]'>
        <Sidebar sidebar={sidebar} setSidebar={setSidebar} isGuest={!user && isGuest} />
        <div className='flex-1 bg-[#F4F7FB] overflow-y-auto'>
          <Outlet />
        </div>
      </div>
    </div>
  ) : (
    <div className='flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-purple-50/30 p-4'>
      <div className='w-full max-w-md bg-white rounded-2xl shadow-lg border border-purple-100 p-8 text-center mb-6'>
        <img className='h-9 mx-auto mb-4 cursor-pointer' src={assets.logo} alt="QuickAI" onClick={() => navigate('/')} />
        <h2 className='text-xl font-bold text-gray-900 mb-2'>Explore QuickAI Platform</h2>
        <p className='text-sm text-gray-600 mb-6'>
          Test all 6 AI tools, atomic quota metering, and social feed without creating an account, or sign in to save creations to your profile.
        </p>

        <button
          onClick={handleEnterGuest}
          className='w-full py-3.5 px-4 bg-gradient-to-r from-[#3C81F6] to-[#9234EA] hover:opacity-95 text-white font-medium rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-sm mb-4'
        >
          <Sparkles className='w-4 h-4' />
          <span>Launch Instant Demo (No Sign-Up Required)</span>
        </button>

        <div className='relative my-4'>
          <div className='absolute inset-0 flex items-center'>
            <div className='w-full border-t border-gray-200'></div>
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-white px-3 text-gray-400 font-medium'>or sign in with Clerk</span>
          </div>
        </div>
      </div>

      <div className='w-full max-w-md flex justify-center'>
        <SignIn />
      </div>
    </div>
  )
}

export default Layout
