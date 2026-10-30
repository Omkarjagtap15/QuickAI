import React from 'react';
import { useNavigate } from 'react-router-dom';
import { assets } from '../assets/assets';

const Hero = () => {
  const navigate = useNavigate();

  return (
    <div className='px-4 sm:px-20 xl:px-32 relative inline-flex flex-col w-full justify-center bg-[url(/gradientBackground.png)] bg-cover bg-no-repeat min-h-screen'>
      <div className='text-center mb-6'>
        <h1 className='text-3xl sm:text-5xl md:text-6xl 2xl:text-7xl font-semibold mx-auto leading-[1.2]'>
          High-performance AI SaaS <br /> built for <span className='text-primary'>creators & developers</span>
        </h1>
        <p className='mt-4 max-w-xs sm:max-w-lg 2xl:max-w-xl m-auto max-sm:text-xs text-gray-600'>
          Multi-provider AI platform powered by resilient queue pipelines, atomic free-tier metering, and
          instant text and visual intelligence tools.
        </p>
      </div>

      <div className='flex flex-wrap justify-center gap-4 text-sm max-sm:text-xs'>
        <button
          onClick={() => navigate('/ai')}
          className='bg-primary text-white px-10 py-3 rounded-lg hover:scale-102 active:scale-95 transition cursor-pointer font-medium'
        >
          Start creating now
        </button>
        <button
          onClick={() => navigate('/ai/community')}
          className='bg-white px-10 py-3 rounded-lg border border-gray-300 hover:scale-102 active:scale-95 transition cursor-pointer font-medium'
        >
          Explore Community Feed
        </button>
      </div>

      <div className='flex items-center gap-4 mt-8 mx-auto text-gray-600 text-sm'>
        <img src={assets.user_group} alt='' className='h-8' />
        <span>Enterprise-grade resilience • Atomic quota protection • Real-time processing</span>
      </div>
    </div>
  );
};

export default Hero;
