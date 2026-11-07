import { Protect, useClerk, useUser } from '@clerk/clerk-react'
import { Eraser, FileText, Hash, House, Image, LogOut, Scissors, SquarePen, Users, UserCheck } from 'lucide-react';
import React from 'react'
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/ai', label: 'Dashboard', Icon: House },
  { to: '/ai/write-article', label: 'Write Article', Icon: SquarePen },
  { to: '/ai/blog-titles', label: 'Blog Titles', Icon: Hash },
  { to: '/ai/generate-images', label: 'Generate Images', Icon: Image },
  { to: '/ai/remove-background', label: 'Remove Background', Icon: Eraser },
  { to: '/ai/remove-object', label: 'Remove Object', Icon: Scissors },
  { to: '/ai/review-resume', label: 'Review Resume', Icon: FileText },
  { to: '/ai/community', label: 'Community', Icon: Users },
]

const Sidebar = ({ sidebar, setSidebar, isGuest }) => {
  const { user } = useUser()
  const { signOut, openUserProfile } = useClerk()

  const displayName = user?.fullName || (isGuest ? 'Guest Evaluator' : 'User')
  const displayImage = user?.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'

  const handleSignOut = () => {
    if (user) {
      signOut()
    } else {
      sessionStorage.removeItem('quickai_guest_mode')
      window.location.href = '/'
    }
  }

  return (
    <div className={`w-60 bg-white border-r border-gray-200 flex flex-col justify-between items-center max-sm:absolute top-14 bottom-0 z-20 ${sidebar ? 'translate-x-0' : 'max-sm:-translate-x-full'} transition-all duration-300 ease-in-out`}>
      <div className='my-7 w-full'>
        <img src={displayImage} alt="User avatar" className='w-13 h-13 rounded-full mx-auto object-cover border border-gray-200 shadow-sm' />
        <h1 className='mt-2 text-center font-medium text-gray-800 text-sm'>{displayName}</h1>
        {isGuest && (
          <p className='text-[11px] text-center text-purple-600 font-medium'>Demo Access</p>
        )}
        <div className='px-6 mt-5 text-sm text-gray-600 font-medium'>
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/ai'}
              onClick={() => setSidebar(false)}
              className={({ isActive }) =>
                `px-3.5 py-2.5 flex items-center gap-3 rounded-lg mb-1 transition ${isActive ? 'bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white shadow-sm' : 'hover:bg-gray-100 text-gray-700'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      <div className='w-full border-t border-gray-200 p-4 px-6 flex items-center justify-between'>
        <div
          onClick={user ? openUserProfile : undefined}
          className={`flex gap-2.5 items-center ${user ? 'cursor-pointer' : ''}`}
        >
          <img src={displayImage} className='w-8 h-8 rounded-full object-cover border border-gray-200' alt="" />
          <div>
            <h1 className='text-xs font-semibold text-gray-800 max-w-[110px] truncate'>{displayName}</h1>
            <p className='text-[11px] text-gray-500'>
              {user ? (
                <Protect plan='premium' fallback="Free Plan">Premium Plan</Protect>
              ) : (
                'Free Plan (10 Quota)'
              )}
            </p>
          </div>
        </div>
        <LogOut
          onClick={handleSignOut}
          title={user ? 'Sign Out' : 'Exit Guest Mode'}
          className='w-4.5 h-4.5 text-gray-400 hover:text-gray-700 transition cursor-pointer'
        />
      </div>
    </div>
  )
}

export default Sidebar
