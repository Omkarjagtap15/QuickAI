import { Edit, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import Markdown from 'react-markdown';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const WriteArticle = () => {
  const articleLength = [
    { length: 800, text: 'Short (500-800 words)' },
    { length: 1200, text: 'Medium (800-1200 words)' },
    { length: 1600, text: 'Long (1200+ words)' },
  ];

  const [selectedLength, setSelectedLength] = useState(articleLength[0]);
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
        '/api/ai/generate-article',
        {
          topic: input.trim(),
          length: selectedLength.length,
        },
        {
          headers: { Authorization: `Bearer ${await getToken()}` },
        }
      );

      if (data.success) {
        setContent(data.content);
        toast.success('Article generated successfully!');
      } else {
        toast.error(data.message || 'Generation failed.');
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
      {/* Left Column: Configuration */}
      <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-5 bg-white rounded-xl border border-gray-200 shadow-sm'>
        <div className='flex items-center gap-3'>
          <Sparkles className='w-6 h-6 text-[#4A7AFF]' />
          <h1 className='text-xl font-semibold'>Article Configuration</h1>
        </div>
        <p className='mt-6 text-sm font-medium'>Article Topic</p>

        <input
          onChange={(e) => setInput(e.target.value)}
          value={input}
          type='text'
          className='w-full p-2.5 px-3 mt-2 outline-none text-sm rounded-lg border border-gray-300 focus:border-[#4A7AFF] transition'
          placeholder='e.g., The Future of Distributed Systems and AI Workflows'
          required
        />

        <p className='mt-4 text-sm font-medium'>Article Length</p>

        <div className='mt-3 flex gap-2 flex-wrap'>
          {articleLength.map((item, index) => (
            <span
              onClick={() => setSelectedLength(item)}
              className={`text-xs px-3.5 py-1.5 border rounded-full cursor-pointer transition ${
                selectedLength.text === item.text
                  ? 'bg-blue-50 text-blue-700 border-blue-300 font-medium'
                  : 'text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
              key={index}
            >
              {item.text}
            </span>
          ))}
        </div>

        <button
          disabled={loading}
          type='submit'
          className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#226BFF] to-[#65ADFF] hover:opacity-95 text-white px-4 py-2.5 mt-6 text-sm rounded-lg cursor-pointer transition font-medium disabled:opacity-50'
        >
          {loading ? (
            <span className='w-4 h-4 rounded-full border-2 border-t-transparent animate-spin'></span>
          ) : (
            <Edit className='w-4 h-4' />
          )}
          {loading ? 'Generating Article...' : 'Generate Article'}
        </button>
      </form>

      {/* Right Column: Content Preview */}
      <div className='w-full max-w-xl p-5 bg-white rounded-xl flex flex-col border border-gray-200 shadow-sm min-h-[420px] max-h-[640px]'>
        <div className='flex items-center gap-3 pb-3 border-b border-gray-100'>
          <Edit className='w-5 h-5 text-[#4A7AFF]' />
          <h2 className='text-lg font-semibold'>Generated Article</h2>
        </div>

        {!content ? (
          <div className='flex-1 flex justify-center items-center'>
            <div className='text-sm flex flex-col items-center gap-3 text-gray-400 text-center px-4'>
              <Edit className='w-8 h-8 text-gray-300' />
              <p>Enter a topic and click "Generate Article" to start producing structured content.</p>
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

export default WriteArticle;
