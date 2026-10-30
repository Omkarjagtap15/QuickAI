import { useAuth } from '@clerk/clerk-react';
import { Hash, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Markdown from 'react-markdown';
import axios from 'axios';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const BlogTitles = () => {
  const blogCategories = [
    'General',
    'Technology',
    'Business',
    'Health',
    'Lifestyle',
    'Education',
    'Travel',
    'Food',
  ];

  const [selectedCategory, setSelectedCategory] = useState('General');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');

  const { getToken } = useAuth();

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      setLoading(true);

      const { data } = await axios.post(
        '/api/ai/generate-blog-title',
        {
          keyword: input.trim(),
          category: selectedCategory,
        },
        {
          headers: { Authorization: `Bearer ${await getToken()}` },
        }
      );

      if (data.success) {
        setContent(data.content);
        toast.success('Titles generated successfully!');
      } else {
        toast.error(data.message || 'Generation failed');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
      {/* Left Column: Form */}
      <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-5 bg-white rounded-xl border border-gray-200 shadow-sm'>
        <div className='flex items-center gap-3'>
          <Sparkles className='w-6 h-6 text-[#8E37EB]' />
          <h1 className='text-xl font-semibold'>AI Title Generator</h1>
        </div>
        <p className='mt-6 text-sm font-medium'>Target Keyword / Topic</p>

        <input
          onChange={(e) => setInput(e.target.value)}
          value={input}
          type='text'
          className='w-full p-2.5 px-3 mt-2 outline-none text-sm rounded-lg border border-gray-300 focus:border-[#8E37EB] transition'
          placeholder='e.g., Microservices Observability'
          required
        />

        <p className='mt-4 text-sm font-medium'>Niche Category</p>

        <div className='mt-3 flex gap-2 flex-wrap'>
          {blogCategories.map((item) => (
            <span
              onClick={() => setSelectedCategory(item)}
              className={`text-xs px-3.5 py-1.5 border rounded-full cursor-pointer transition ${
                selectedCategory === item
                  ? 'bg-purple-50 text-purple-700 border-purple-300 font-medium'
                  : 'text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
              key={item}
            >
              {item}
            </span>
          ))}
        </div>

        <button
          disabled={loading}
          type='submit'
          className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#C341F6] to-[#8E37EB] hover:opacity-95 text-white px-4 py-2.5 mt-6 text-sm rounded-lg cursor-pointer transition font-medium disabled:opacity-50'
        >
          {loading ? (
            <span className='w-4 h-4 rounded-full border-2 border-t-transparent animate-spin'></span>
          ) : (
            <Hash className='w-4 h-4' />
          )}
          {loading ? 'Generating Titles...' : 'Generate Titles'}
        </button>
      </form>

      {/* Right Column: Output */}
      <div className='w-full max-w-xl p-5 bg-white rounded-xl flex flex-col border border-gray-200 shadow-sm min-h-[380px]'>
        <div className='flex items-center gap-3 pb-3 border-b border-gray-100'>
          <Hash className='w-5 h-5 text-[#8E37EB]' />
          <h2 className='text-lg font-semibold'>Generated Titles</h2>
        </div>

        {!content ? (
          <div className='flex-1 flex justify-center items-center'>
            <div className='text-sm flex flex-col items-center gap-3 text-gray-400 text-center px-4'>
              <Hash className='w-8 h-8 text-gray-300' />
              <p>Enter a keyword and click "Generate Titles" to view high-ranking variations.</p>
            </div>
          </div>
        ) : (
          <div className='mt-3 h-full overflow-y-scroll text-sm text-slate-700 pr-2'>
            <div className='prose prose-sm max-w-none'>
              <Markdown>{content}</Markdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogTitles;
