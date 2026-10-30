import { useAuth, useUser } from '@clerk/clerk-react';
import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const Community = () => {
  const [creations, setCreations] = useState([]);
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { getToken } = useAuth();

  const fetchCreations = async (cursor = null) => {
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : '?limit=20';
      const { data } = await axios.get(`/api/user/get-published-creations${query}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (data.success) {
        if (cursor) {
          setCreations((prev) => [...prev, ...data.creations]);
        } else {
          setCreations(data.creations);
        }
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      setLoadingMore(true);
      fetchCreations(nextCursor);
    }
  };

  // Optimistic & atomic like toggle: updates state in-place without refetching the full database
  const imageLikeToggle = async (id) => {
    if (!user) return;
    const userId = user.id;

    // Optimistically update UI
    setCreations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const alreadyLiked = Array.isArray(c.likes) && c.likes.includes(userId);
        const updatedLikes = alreadyLiked
          ? c.likes.filter((uid) => uid !== userId)
          : [...(c.likes || []), userId];

        return {
          ...c,
          likes: updatedLikes,
          like_count: updatedLikes.length,
        };
      })
    );

    try {
      const { data } = await axios.post(
        '/api/user/toggle-like-creation',
        { id },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      );

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
        // Rollback on failure
        fetchCreations();
      }
    } catch (error) {
      toast.error(error.message);
      fetchCreations();
    }
  };

  useEffect(() => {
    if (user) {
      fetchCreations();
    }
  }, [user]);

  return !loading ? (
    <div className='flex-1 h-full flex flex-col gap-4 p-6'>
      <div className='flex justify-between items-center'>
        <h1 className='text-xl font-semibold text-slate-800'>Community Creations</h1>
        <span className='text-xs text-slate-500 font-medium'>
          Showing {creations.length} creations • Keyset paginated
        </span>
      </div>

      <div className='bg-white h-full w-full rounded-xl overflow-y-scroll p-4'>
        <div className='flex flex-wrap gap-4'>
          {creations.map((creation) => {
            const isLiked =
              user && Array.isArray(creation.likes) && creation.likes.includes(user.id);
            const count =
              typeof creation.like_count === 'number'
                ? creation.like_count
                : Array.isArray(creation.likes)
                ? creation.likes.length
                : 0;

            return (
              <div
                key={creation.id}
                className='relative group w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm'
              >
                <img
                  src={creation.content}
                  alt={creation.prompt}
                  className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-105'
                  loading='lazy'
                />

                <div className='absolute inset-0 flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/80 via-transparent to-transparent text-white transition-opacity duration-200'>
                  <div />
                  <div className='flex justify-between items-end gap-2'>
                    <p className='text-xs line-clamp-2 drop-shadow-sm'>{creation.prompt}</p>
                    <div className='flex gap-1.5 items-center bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs'>
                      <span>{count}</span>
                      <Heart
                        onClick={() => imageLikeToggle(creation.id)}
                        className={`w-4 h-4 hover:scale-125 transition-transform cursor-pointer ${
                          isLiked ? 'fill-red-500 text-red-500' : 'text-white'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div className='flex justify-center my-6'>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className='px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition cursor-pointer'
            >
              {loadingMore ? 'Loading more creations...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className='flex justify-center items-center h-full'>
      <span className='w-10 h-10 my-1 rounded-full border-3 border-primary border-t-transparent animate-spin'></span>
    </div>
  );
};

export default Community;
