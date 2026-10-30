import React from 'react';
import { assets } from '../assets/assets';

const Testimonial = () => {
  const testimonials = [
    {
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200',
      name: 'Sarah Chen',
      title: 'Full Stack Engineer & Tech Writer',
      content:
        'The streaming response speed and clean Markdown rendering make QuickAI my daily driver for long-form tech guides. The token throughput is impressive.',
      rating: 5,
    },
    {
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200',
      name: 'Marcus Thorne',
      title: 'Product Growth Lead',
      content:
        'Having AI background removal and image generation in the same workspace cut our design iteration turnaround from days to minutes.',
      rating: 5,
    },
    {
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200',
      name: 'Priya Patel',
      title: 'Technical Recruiter',
      content:
        'The AI Resume Review tool extracts structured strengths and actionable gaps with surprising nuance. Highly recommended for candidates preparing for engineering loops.',
      rating: 5,
    },
  ];

  return (
    <div className='px-4 sm:px-20 xl:px-32 py-24'>
      <div className='text-center'>
        <h2 className='text-slate-700 text-[42px] font-semibold'>Built for Creators & Engineers</h2>
        <p className='text-gray-500 max-w-lg mx-auto'>
          Designed with reliability, predictable latencies, and high quality AI generation.
        </p>
      </div>
      <div className='flex flex-wrap mt-10 justify-center'>
        {testimonials.map((item, index) => (
          <div
            key={index}
            className='p-8 m-4 max-w-xs rounded-lg bg-[#FDFDFE] shadow-lg border border-gray-100 hover:-translate-y-1 transition duration-300 cursor-pointer flex flex-col justify-between'
          >
            <div>
              <div className='flex items-center gap-1'>
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <img
                      key={i}
                      src={i < item.rating ? assets.star_icon : assets.star_dull_icon}
                      className='w-4 h-4'
                      alt='star'
                    />
                  ))}
              </div>
              <p className='text-gray-600 text-sm my-5 leading-relaxed'>"{item.content}"</p>
            </div>
            <div>
              <hr className='mb-5 border-gray-200' />
              <div className='flex items-center gap-4'>
                <img src={item.image} className='w-12 h-12 object-cover rounded-full' alt={item.name} />
                <div className='text-sm text-gray-700'>
                  <h3 className='font-semibold'>{item.name}</h3>
                  <p className='text-xs text-gray-500'>{item.title}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Testimonial;
