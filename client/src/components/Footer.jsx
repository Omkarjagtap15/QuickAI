import React, { useState } from 'react';
import { assets } from '../assets/assets';
import toast from 'react-hot-toast';

const Footer = () => {
  const [email, setEmail] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter a valid email address.');
      return;
    }
    toast.success('Thank you for subscribing to QuickAI updates!');
    setEmail('');
  };

  return (
    <footer className="px-6 md:px-16 lg:px-24 xl:px-32 pt-8 w-full text-gray-500 mt-20">
      <div className="flex flex-col md:flex-row justify-between w-full gap-10 border-b border-gray-500/30 pb-6">
        <div className="md:max-w-96">
          <img className="h-9" src={assets.logo} alt="QuickAI Logo" />
          <p className="mt-6 text-sm">
            Experience the power of multi-provider AI with QuickAI. Transform your content workflow
            with high-throughput text, image, and document intelligence tools.
          </p>
        </div>
        <div className="flex-1 flex items-start md:justify-end gap-20">
          <div>
            <h2 className="font-semibold mb-5 text-gray-800">Platform</h2>
            <ul className="text-sm space-y-2">
              <li><a href="/ai" className="hover:text-primary transition">AI Studio</a></li>
              <li><a href="/ai/community" className="hover:text-primary transition">Community Feed</a></li>
              <li><a href="/health" className="hover:text-primary transition">System Health</a></li>
              <li><a href="/ai" className="hover:text-primary transition">Pricing Plans</a></li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 mb-5">Engineering Updates</h2>
            <form onSubmit={handleSubscribe} className="text-sm space-y-2">
              <p>Platform architecture releases, AI provider updates, and benchmark reports.</p>
              <div className="flex items-center gap-2 pt-4">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-gray-500/30 placeholder-gray-500 focus:ring-2 ring-indigo-600 outline-none w-full max-w-64 h-9 rounded px-2"
                  type="email"
                  placeholder="Enter your email"
                />
                <button type="submit" className="bg-primary hover:opacity-90 transition text-white px-4 h-9 rounded cursor-pointer font-medium">
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <p className="pt-4 text-center text-xs md:text-sm pb-5">
        Copyright {new Date().getFullYear()} © QuickAI Platform. All Rights Reserved.
      </p>
    </footer>
  );
};

export default Footer;
