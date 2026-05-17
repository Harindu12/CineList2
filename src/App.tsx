import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Clapperboard, X, Plus, Home, Search as SearchIcon, Trash2, User, List, Star, ImagePlus, Download, UploadCloud, Bookmark, BarChart2, ChevronLeft, CheckCircle2, PlayCircle, RefreshCw, Edit3, Menu, Upload, ChevronDown } from 'lucide-react';

import { db, auth } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AuthView } from './AuthView';

const STORAGE_KEY = 'cinelist_v1';

type TitleType = 'movie' | 'tv';
type TitleStatus = 'watching' | 'plan' | 'completed';

export type CollectionItem = {
   isCollection: true;
   id: string;
   title: string;
   items: TitleItem[];
   genre: string;
   status?: string;
   poster?: string;
};

export type ListItem = TitleItem | CollectionItem;

export interface SeasonItem {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  status?: TitleStatus;
}

export interface TitleItem {
  id: number;
  title: string;
  type: TitleType;
  year?: string;
  director?: string;
  genre?: string;
  rating?: string;
  cast?: string[];
  synopsis?: string;
  poster?: string;
  status?: TitleStatus;
  progress?: number;
  tmdbId?: number;
  seasons?: SeasonItem[];
}

const AvatarDisplay = ({ avatar, size = 32 }: { avatar?: string, size?: number }) => {
  const isUrl = avatar?.startsWith('http://') || avatar?.startsWith('https://') || avatar?.startsWith('data:image/');
  
  if (isUrl) {
    return (
      <img 
        src={avatar} 
        alt="Avatar" 
        className="rounded-full object-cover shadow-inner"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  
  return (
    <div 
      className="bg-[#f0ede8] rounded-full flex items-center justify-center shadow-inner shrink-0"
      style={{ width: size, height: size, fontSize: size / 2 }}
    >
      {avatar || '🧑'}
    </div>
  );
};

export default function App() {
  const [currentProfile, setCurrentProfile] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [items, setItems] = useState<TitleItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [posterQuery, setPosterQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [filter, setFilter] = useState('All');

  const handleFilterClick = (f: string) => {
    setFilter(f);
  };

  const [activeView, setActiveView] = useState<'home' | 'stats'>('home');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [allUsers, setAllUsers] = useState<{username: string, displayName?: string, avatar?: string}[]>([]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setEditAvatar(dataUrl);
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const username = user.email.split('@')[0];
        setCurrentProfile(username);
        // Default to viewing own profile if no viewing profile is set
        setViewingProfile(prev => prev || username);
        
        // Ensure user exists in collection
        try {
          await setDoc(doc(db, 'users', username), {
            username: username,
            displayName: user.displayName || username,
          }, { merge: true });
        } catch (e) {
           console.error("Error updating user document:", e);
        }
      } else {
        setCurrentProfile(null);
      }
      setIsInitializing(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
       const usersMap: any[] = [];
       snapshot.forEach(doc => {
          if (doc.id !== 'undefined' && doc.data().username) {
             usersMap.push({
                username: doc.data().username,
                displayName: doc.data().displayName || doc.data().username,
                avatar: doc.data().avatar
             });
          }
       });
       setAllUsers(usersMap);
    }, (error) => {
       console.error("Error fetching users:", error);
    });

    return () => {
       unsubAuth();
       unsubUsers();
    };
  }, []);

  // Hardware Back Button Support
  useEffect(() => {
    const handlePopState = () => {
      setSelectedId(null);
      setShowAdd(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectId = (id: number) => {
    window.history.pushState({ overlay: 'detail' }, '');
    setSelectedId(id);
  };

  const handleCloseDetail = () => {
    if (selectedId !== null) {
      window.history.back();
    } else {
      setSelectedId(null);
    }
  };

  const handleOpenAdd = () => {
    window.history.pushState({ overlay: 'add' }, '');
    setShowAdd(true);
  };

  const handleCloseAdd = () => {
    if (showAdd) {
       window.history.back();
    } else {
       setShowAdd(false);
    }
  };

  useEffect(() => {
    if (!viewingProfile) return;
    setIsInitializing(true);
    let migrated = false;
    
    // Auto-migrate old titles to mahiru's profile
    if (viewingProfile === 'mahiru') {
      const migrateTitles = async () => {
        try {
          const oldTitlesSnapshot = await getDocs(collection(db, 'titles'));
          if (!oldTitlesSnapshot.empty) {
            for (const document of oldTitlesSnapshot.docs) {
              const data = document.data();
              await setDoc(doc(db, 'users', 'mahiru', 'watchlist', document.id), data);
              // Clean up old titles after migrating
              try {
                await deleteDoc(doc(db, 'titles', document.id));
              } catch(e) {
                console.log(e);
              }
            }
          }
          
          // Legacy check: localStorage migration
          const legacyLocal = localStorage.getItem('cinelist_v1');
          if (legacyLocal) {
            try {
              const parsed = JSON.parse(legacyLocal);
              if (Array.isArray(parsed) && parsed.length > 0) {
                 for (const item of parsed) {
                    await setDoc(doc(db, 'users', 'mahiru', 'watchlist', String(item.id)), item);
                 }
                 // Optional: clean up so we don't spam writes
                 localStorage.removeItem('cinelist_v1');
              }
            } catch (e) {
               console.log("Error parsing legacy local storage");
            }
          }
        } catch (e) {
          console.error("Migration error:", e)
        }
      };
      migrateTitles();
    }

    const sub = onSnapshot(collection(db, 'users', viewingProfile, 'watchlist'), (snapshot) => {
      const fbItems: TitleItem[] = [];
      const seenTitles = new Set();
      const duplicatesToDelete: string[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const titleKey = data.title?.toLowerCase().trim();
        
        if (titleKey && seenTitles.has(titleKey)) {
          duplicatesToDelete.push(doc.id);
          return;
        }
        if (titleKey) seenTitles.add(titleKey);

        fbItems.push({
          ...data,
          id: parseInt(doc.id, 10),
        } as TitleItem);
      });

      // Cleanup duplicates in Firebase silently
      if (duplicatesToDelete.length > 0) {
        duplicatesToDelete.forEach(id => {
          deleteDoc(doc(db, 'users', viewingProfile, 'watchlist', id)).catch(console.error);
        });
      }

      // Sort by creation time (id) descending
      fbItems.sort((a, b) => b.id - a.id);
      setItems(fbItems);
      setIsInitializing(false);
    });
    
    return () => sub();
  }, [viewingProfile]);

  const handleAdd = async () => {
    if (!nameQuery.trim()) return;

    setIsLoading(true);
    setStatusText('Adding...');

    try {
      const TMDB_API_KEY = "2053bd75e7016400293c3759defe1af9";
      const searchRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(nameQuery)}`);
      
      if (!searchRes.ok) {
        throw new Error('Failed to search TMDB');
      }
      
      const searchData = await searchRes.json();
      if (!searchData.results || searchData.results.length === 0) {
        throw new Error('No results found');
      }
      
      let bestMatch = searchData.results[0];
      // Try to find an exact title match first
      const exactMatch = searchData.results.find((r: any) => 
        (r.title || r.name || '').toLowerCase() === nameQuery.trim().toLowerCase()
      );
      if (exactMatch) {
        bestMatch = exactMatch;
      }
      
      const mediaType = bestMatch.media_type === 'tv' ? 'tv' : 'movie';
      const tmdbId = bestMatch.id;
      
      let info: any = {
        title: bestMatch.title || bestMatch.name || nameQuery,
        type: mediaType,
        tmdbId: tmdbId,
        year: (bestMatch.release_date || bestMatch.first_air_date || '').split('-')[0],
        synopsis: bestMatch.overview || '',
        poster: bestMatch.poster_path ? `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}` : undefined,
        rating: bestMatch.vote_average ? `${bestMatch.vote_average.toFixed(1)}/10` : '',
        genre: '',
        director: '',
        cast: [],
      };

      const detailsRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
      let seasonsData: SeasonItem[] = [];
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        if (detailsData.genres && detailsData.genres.length > 0) {
          info.genre = detailsData.genres.map((g: any) => g.name).join(', ');
        }
        if (detailsData.credits && detailsData.credits.crew) {
          const director = detailsData.credits.crew.find((c: any) => c.job === 'Director');
          if (director) info.director = director.name;
        }
        if (detailsData.credits && detailsData.credits.cast) {
          info.cast = detailsData.credits.cast.slice(0, 5).map((c: any) => c.name);
        }
        if (mediaType === 'tv' && detailsData.seasons) {
          seasonsData = detailsData.seasons
            .filter((s: any) => s.season_number > 0)
            .map((s: any) => ({
              id: s.id,
              season_number: s.season_number,
              name: s.name,
              episode_count: s.episode_count,
              status: 'plan',
              progressItemCount: 0
            }));
        }
      }

      const title = info.title;

      if (items.some((i) => i.title.toLowerCase() === title.toLowerCase())) {
        setStatusText('Already in list.');
        setIsLoading(false);
        setTimeout(() => setStatusText(''), 3000);
        return;
      }

      const id = Date.now();
      
      const newItem: TitleItem = {
        id,
        title: title,
        type: info.type === 'tv' ? 'tv' : 'movie',
        year: info.year,
        director: info.director || '',
        genre: info.genre || '',
        rating: info.rating || '',
        cast: info.cast || [],
        synopsis: info.synopsis || '',
        status: 'plan',
        progress: 0,
        tmdbId: info.tmdbId,
        ...(seasonsData.length > 0 && { seasons: seasonsData })
      };
      
      if (info.poster) newItem.poster = info.poster;
      if (posterQuery.trim()) {
        newItem.poster = posterQuery.trim();
      }

      await setDoc(doc(db, 'users', currentProfile!, 'watchlist', id.toString()), newItem);
      
      setNameQuery('');
      setPosterQuery('');
      handleCloseAdd();
      setStatusText('');
    } catch (err: any) {
      console.error("API Error:", err);
      // Fallback
      if (items.some((i) => i.title.toLowerCase() === nameQuery.trim().toLowerCase())) {
        setStatusText('Already in list.');
        setIsLoading(false);
        setTimeout(() => setStatusText(''), 3000);
        return;
      }

      const id = Date.now();
      const newItem: TitleItem = {
        id,
        title: nameQuery,
        type: 'movie',
        status: 'plan',
        progress: 0,
      };
      if (posterQuery.trim()) {
         newItem.poster = posterQuery.trim();
      }
      
      await setDoc(doc(db, 'users', currentProfile!, 'watchlist', id.toString()), newItem);
      
      setNameQuery('');
      setPosterQuery('');
      handleCloseAdd();
      setStatusText('');
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = async (id: number, updates: Partial<TitleItem>) => {
    await updateDoc(doc(db, 'users', currentProfile!, 'watchlist', id.toString()), updates);
  };

  const removeItem = async (id: number) => {
    await deleteDoc(doc(db, 'users', currentProfile!, 'watchlist', id.toString()));
  };

  // Filtering
  const filteredItems = useMemo(() => {
     let filtered = items;
     if (filter === 'Watching') filtered = items.filter(i => i.status === 'watching');
     else if (filter === 'Plan to Watch') filtered = items.filter(i => i.status === 'plan' || !i.status);
     else if (filter === 'Completed') filtered = items.filter(i => i.status === 'completed');
     else if (filter === 'Movies') filtered = items.filter(i => i.type === 'movie');
     else if (filter === 'Series') filtered = items.filter(i => i.type === 'tv');
     
     if (searchQuery.trim() !== '') {
       filtered = filtered.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()));
     }
     
     return filtered;
  }, [items, filter, searchQuery]);

  // Export from Firestore just to match schema
  const handleExport = () => {
    const dataStr = JSON.stringify(items);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import into Cloud Storage
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result;
        if (typeof text !== 'string') return;
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          // Push to cloud db
          for (let item of parsed) {
            const tempId = item.id || Date.now();
            await setDoc(doc(db, 'users', currentProfile!, 'watchlist', tempId.toString()), {
              ...item,
              id: tempId
            });
          }
          alert(`Successfully imported ${parsed.length} titles to your cloud database!`);
        }
      } catch (err: any) {
        alert("Failed to import. Make sure it's a valid JSON export.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const syncMetadata = async () => {
    if (isSyncing || items.length === 0) return;
    setIsSyncing(true);
    setStatusText('Syncing metadata...');

      const TMDB_API_KEY = "2053bd75e7016400293c3759defe1af9";
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const needsUpdate = !item.cast || item.cast.length === 0 || !item.rating?.includes('/') || !item.synopsis || !item.director || !item.genre;
        
        if (needsUpdate || !item.tmdbId) {
          setStatusText(`Syncing [${i+1}/${items.length}] ${item.title}...`);
          try {
            let tmdbId = item.tmdbId;
            let mediaType = item.type;
            
            if (!tmdbId) {
               const searchRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}`);
               if (searchRes.ok) {
                 const searchData = await searchRes.json();
                 if (searchData.results && searchData.results.length > 0) {
                   const bestMatch = searchData.results[0];
                   tmdbId = bestMatch.id;
                   mediaType = bestMatch.media_type === 'tv' ? 'tv' : 'movie';
                 }
               }
            }
            
            if (tmdbId) {
               const detailsRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
               if (detailsRes.ok) {
                  const detailsData = await detailsRes.json();
                  
                  let director = '';
                  if (detailsData.credits && detailsData.credits.crew) {
                    const dirObj = detailsData.credits.crew.find((c: any) => c.job === 'Director');
                    if (dirObj) director = dirObj.name;
                  }
                  
                  let cast: string[] = [];
                  if (detailsData.credits && detailsData.credits.cast) {
                    cast = detailsData.credits.cast.slice(0, 5).map((c: any) => c.name);
                  }
                  
                  let genre = '';
                  if (detailsData.genres && detailsData.genres.length > 0) {
                     genre = detailsData.genres.map((g: any) => g.name).join(', ');
                  }
                  
                  let seasonsData: SeasonItem[] = [];
                  if (mediaType === 'tv' && detailsData.seasons) {
                     seasonsData = detailsData.seasons
                       .filter((s: any) => s.season_number > 0)
                       .map((s: any) => ({
                         id: s.id,
                         season_number: s.season_number,
                         name: s.name,
                         episode_count: s.episode_count,
                         status: 'plan',
                         progressItemCount: 0
                       }));
                  }
                  
                  // If it already had seasons in DB, keep their statuses
                  if (seasonsData.length > 0 && item.seasons) {
                     seasonsData = seasonsData.map(newS => {
                        const oldS = item.seasons!.find(s => s.id === newS.id || s.season_number === newS.season_number);
                        if (oldS) {
                           return { ...newS, status: oldS.status };
                        }
                        return newS;
                     });
                  }
                  
                  const updates: any = {
                    year: (detailsData.release_date || detailsData.first_air_date || item.year || '').split('-')[0],
                    director: director || item.director || '',
                    genre: genre || item.genre || '',
                    rating: detailsData.vote_average ? `${detailsData.vote_average.toFixed(1)}/10` : item.rating || '',
                    cast: cast.length > 0 ? cast : item.cast || [],
                    synopsis: detailsData.overview || item.synopsis || '',
                    type: mediaType,
                    tmdbId: tmdbId
                  };
                  
                  if (seasonsData.length > 0) {
                     updates.seasons = seasonsData;
                  }
                  
                  if (detailsData.poster_path && !item.poster) {
                     updates.poster = `https://image.tmdb.org/t/p/w500${detailsData.poster_path}`;
                  }
                  
                  await updateDoc(doc(db, 'users', currentProfile!, 'watchlist', item.id.toString()), updates);
               }
            }
          } catch (err) {
            console.error(`Failed to sync ${item.title}:`, err);
          }
          // Small delay
          await new Promise(r => setTimeout(r, 1000));
        }
      }

    setIsSyncing(false);
    setStatusText('Sync complete.');
    setTimeout(() => setStatusText(''), 3000);
  };

  const watchingItems = items.filter(i => i.status === 'watching');
  const planItems = items.filter(i => i.status === 'plan' || !i.status);
  const completedItems = items.filter(i => i.status === 'completed');

  const selectedItem = items.find(i => i.id === selectedId);

  if (isInitializing && !currentProfile) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#f0ede8] max-w-[430px] mx-auto relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center z-10"
        >
          <div className="w-20 h-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-[#e0ddd6] flex items-center justify-center mb-6 relative overflow-hidden">
             <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,transparent,#1a19170a)]" />
             <div className="flex gap-1.5 z-10 items-end h-[32px]">
                <motion.div animate={{ height: ["16px", "32px", "16px"] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} className="w-2.5 bg-[#1a1917] rounded-full" />
                <motion.div animate={{ height: ["24px", "12px", "24px"] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} className="w-2.5 bg-[#1a1917]/60 rounded-full" />
                <motion.div animate={{ height: ["12px", "24px", "12px"] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} className="w-2.5 bg-[#1a1917]/30 rounded-full" />
             </div>
          </div>
          
          <div className="font-serif text-[32px] tracking-[-0.03em] leading-none text-[#1a1917] font-bold mb-4">
             Watch<em className="italic ml-[1px]">list</em>
          </div>
          
          <div className="flex items-center gap-2 text-[#9b9890] text-[13px] font-medium tracking-wide bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white">
             <span className="w-3.5 h-3.5 border-2 border-[#1a1917]/20 border-t-[#1a1917] rounded-full animate-spin" />
             Loading library...
          </div>
        </motion.div>
        
        {/* Decorative background blobs */}
        <div className="absolute top-[20%] left-[-10%] w-[200px] h-[200px] bg-white rounded-full blur-[60px] opacity-60" />
        <div className="absolute bottom-[20%] right-[-10%] w-[200px] h-[200px] bg-white rounded-full blur-[60px] opacity-60" />
      </div>
    );
  }

  if (!currentProfile) {
     return <AuthView />;
  }

  const isReadOnly = viewingProfile !== currentProfile;
  const currentUserObj = allUsers.find(u => u.username === currentProfile);
  const meEmoji = currentUserObj?.avatar || '🧑';
  const currentUserDisplayName = currentUserObj?.displayName || currentProfile;

  return (
    <div className="relative h-[100dvh] bg-[#f0ede8] w-full max-w-[430px] mx-auto overflow-hidden font-sans flex flex-col">
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />

      {/* HEADER - FLUSH WITH BACKGROUND */}
      <div className="flex-shrink-0 pt-6 transition-all pb-0">
        
        {/* TOP ROW: TITLE & SETTINGS/ACTIONS */}
        <div className="px-[24px] flex items-center justify-between mb-2 relative h-12">
          {/* Menu Button (Left) */}
          <button 
             onClick={() => setShowMainMenu(true)}
             className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#1a1917] hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer"
          >
             <Menu size={24} strokeWidth={2.5} />
          </button>

          {/* Title (Center) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-serif text-[32px] tracking-[-0.03em] leading-none text-[#1a1917] font-bold pointer-events-none">
             Watch<em className="italic ml-[1px]">list</em>
          </div>

          {statusText && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-[#1a1917]/10 px-3 py-1 rounded-full backdrop-blur-sm transition-all animate-pulse z-20">
               <span className="text-[10px] font-bold text-[#1a1917] whitespace-nowrap">{statusText}</span>
            </div>
          )}

          {/* Avatar (Right) */}
          <div className="flex items-center gap-1.5 p-1 -mr-2">
             <div 
               className="cursor-pointer active:scale-95 transition-transform border border-[#e0ddd6] rounded-full shadow-sm"
               onClick={() => setShowProfileSwitcher(true)}
             >
                <AvatarDisplay avatar={meEmoji} size={36} />
             </div>
          </div>
        </div>

         <div className="px-[24px] mb-4 flex">
           {isReadOnly && (
              <div className="bg-[#1a1917] text-white px-4 py-2 rounded-[14px] text-[13px] font-medium flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.1)] w-full">
                 <span className="flex items-center gap-2">Viewing <strong className="text-white capitalize">{viewingProfile}</strong>'s list</span>
                 <button onClick={() => setViewingProfile(currentProfile)} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full text-[#ffffff] transition-colors border border-white/10 active:scale-95 flex items-center justify-center font-semibold" style={{ fontSize: '11px' }}>Return</button>
              </div>
           )}
         </div>

        {activeView === 'home' && (
          <>
            {/* SEARCH BAR */}
            <div className="px-[24px] mb-4">
              <div 
                className="bg-white rounded-[24px] flex items-center gap-2 px-4 py-3 cursor-text transition-all border border-[#e0ddd6] shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus-within:ring-2 focus-within:ring-[#1a1917]/10 focus-within:border-[#1a1917]/20" 
              >
                <SearchIcon size={16} className="text-[#9b9890] shrink-0" strokeWidth={2.5} />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your list…"
                  className="bg-transparent border-none outline-none text-[#1a1917] text-[15px] font-medium w-full tracking-[-0.01em] placeholder:text-[#9b9890]"
                />
              </div>
            </div>

            {/* CAPSULE TABS */}
            <div className="flex items-center px-[24px] pb-4 hidden-scrollbar overflow-x-auto scrollable relative z-10 w-full">
               <div className="flex items-center gap-2 w-full pr-4 relative">
                {['All', 'Watching', 'Plan to Watch', 'Completed'].map((f) => (
                  <button 
                    key={f} 
                    onClick={() => handleFilterClick(f)} 
                    className={`text-[13px] font-medium px-4 py-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors relative z-10 outline-none ${filter === f ? 'text-white font-bold' : 'text-[#9b9890] hover:text-[#1a1917]'}`}
                  >
                    {filter === f && (
                       <motion.div 
                         layoutId="activeFilter" 
                         className="absolute inset-0 bg-[#1a1917] rounded-full -z-10"
                         transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                       />
                    )}
                    {f}
                  </button>
                ))}
               </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 bg-[#e8e5df] rounded-t-[24px] shadow-[0_-4px_16px_rgba(0,0,0,0.02)] flex flex-col min-h-0 relative z-10 w-full mt-2 relative">
        <div className={`absolute inset-0 flex flex-col ${activeView === 'home' ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}>
           <div className="px-[24px] pb-[14px] pt-[20px] text-[11px] font-semibold tracking-[0.08em] uppercase text-[#9b9890] flex-shrink-0 bg-[#e8e5df] rounded-t-[24px]">
              {filter === 'All' ? (searchQuery ? 'Search Results' : 'All Titles') : filter}
           </div>
           <StackingList key={filter} items={isInitializing ? null : filteredItems} isInitializing={isInitializing} onSelect={handleSelectId} isReadOnly={isReadOnly} currentProfile={currentProfile} />
        </div>
        
        {activeView === 'stats' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex flex-col overflow-y-auto scrollable no-scrollbar pb-[110px] px-[24px] pt-8 z-20 bg-[#e8e5df] rounded-t-[24px]"
          >
              <motion.h2 
               initial={{ opacity: 0, y: 15 }} 
               animate={{ opacity: 1, y: 0 }} 
               transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
               className="font-serif text-[42px] tracking-[-0.04em] leading-[0.9] text-[#1a1917] mb-[32px]"
            >
               Your<br/><em className="italic text-[#9b9890]">Overview</em>
            </motion.h2>
            
            <div className="grid grid-cols-2 gap-[12px]">
               {/* Card 1: Total Library */}
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white/60 backdrop-blur-md rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-white/50 flex flex-col justify-between aspect-square col-span-1 hover:bg-white transition-colors duration-500 cursor-default"
               >
                  <div className="text-[11px] text-[#9b9890] font-bold tracking-[0.08em] uppercase">Library Size</div>
                  <div className="font-serif text-[72px] leading-[0.8] tracking-[-0.05em] text-[#1a1917] mt-4">{items.length}</div>
               </motion.div>

               {/* Card 2: Split */}
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 20, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-[#1a1917] rounded-[24px] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-[#302e2a] flex flex-col justify-between aspect-square col-span-1 text-white hover:scale-[1.02] transition-transform duration-500 cursor-default"
               >
                  <div className="text-[11px] text-[#858279] font-bold tracking-[0.08em] uppercase">Format</div>
                  <div className="flex flex-col gap-4 mt-4">
                     <div className="flex items-end justify-between">
                        <div className="flex items-center gap-2"><span className="text-[16px] opacity-80">🎬</span> <span className="text-[22px] font-semibold leading-none">{items.filter(i=>i.type==='movie').length}</span></div>
                        <div className="flex items-center gap-2"><span className="text-[22px] font-semibold leading-none">{items.filter(i=>i.type==='tv').length}</span> <span className="text-[16px] opacity-80">📺</span></div>
                     </div>
                     <div className="flex w-full h-[4px] rounded-full overflow-hidden bg-[#333]">
                        <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${items.length ? (items.filter(i=>i.type==='movie').length / items.length) * 100 : 0}%` }}
                           transition={{ delay: 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                           className="h-full bg-white rounded-full" 
                        />
                     </div>
                  </div>
               </motion.div>
               
               {/* Card 3: Matrix */}
               <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20, ease: [0.16, 1, 0.3, 1] }}
                  className="col-span-2 bg-white/60 backdrop-blur-md rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-white/50 flex flex-col gap-5 mt-1"
               >
                  <div className="flex justify-between items-center">
                    <div className="text-[11px] text-[#9b9890] font-bold tracking-[0.08em] uppercase">Progress Matrix</div>
                    <button 
                      onClick={syncMetadata}
                      disabled={isSyncing}
                      className="text-[10px] font-bold text-[#1a1917] bg-white border border-[#e0ddd6] px-3 py-1.5 rounded-full hover:bg-black/5 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-[#e8a020] animate-pulse" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={10} />
                          Refresh Missing Info
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                     <div className="flex flex-col items-center justify-center bg-white rounded-[16px] py-5 shadow-sm border border-[#e0ddd6]/50 hover:-translate-y-1 transition-transform duration-400 ease-out cursor-default">
                        <div className="text-[28px] font-serif font-medium text-[#1a1917] leading-none mb-2">{items.filter(i=>i.status==='watching').length}</div>
                        <div className="text-[10px] text-[#2e7d32] font-bold uppercase tracking-[0.06em]">Watching</div>
                     </div>
                     <div className="flex flex-col items-center justify-center bg-white rounded-[16px] py-5 shadow-sm border border-[#e0ddd6]/50 hover:-translate-y-1 transition-transform duration-400 ease-out cursor-default">
                        <div className="text-[28px] font-serif font-medium text-[#1a1917] leading-none mb-2">{items.filter(i=>i.status==='plan' || !i.status).length}</div>
                        <div className="text-[10px] text-[#d4840a] font-bold uppercase tracking-[0.06em]">Plan</div>
                     </div>
                     <div className="flex flex-col items-center justify-center bg-white rounded-[16px] py-5 shadow-sm border border-[#e0ddd6]/50 hover:-translate-y-1 transition-transform duration-400 ease-out cursor-default">
                        <div className="text-[28px] font-serif font-medium text-[#1a1917] leading-none mb-2">{items.filter(i=>i.status==='completed').length}</div>
                        <div className="text-[10px] text-[#6a1bdb] font-bold uppercase tracking-[0.06em]">Completed</div>
                     </div>
                  </div>
               </motion.div>
            </div>
        </motion.div>
      )}
      </div>

      {/* ITEM DETAIL VIEW */}
      <AnimatePresence>
        {selectedItem && (
           <ItemDetailView 
              key="detail-view"
              item={selectedItem} 
              onClose={handleCloseDetail}
              onUpdate={(updates) => updateItem(selectedItem.id, updates)}
              onRemove={removeItem}
              isReadOnly={isReadOnly}
           />
        )}
      </AnimatePresence>

      {/* ADD OVERLAY */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => !isLoading && handleCloseAdd()} className="fixed inset-0 bg-[#1a1917]/30 backdrop-blur-sm z-[60] w-full max-w-[430px] mx-auto" />
            <motion.div 
              initial={{ opacity: 0, y: "100%", scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: "100%", scale: 0.95 }}
               transition={{ type: "spring", bounce: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
               className="fixed inset-x-0 bottom-0 z-[70] p-4 pt-16 pointer-events-none w-full max-w-[430px] mx-auto gpu-accel"
             >
               <div className="w-full bg-[#f0ede8] border border-[#e0ddd6] rounded-[24px] p-6 pb-8 shadow-[0_20px_40px_rgba(0,0,0,0.2)] pointer-events-auto flex flex-col gap-4">
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="font-serif text-[30px] leading-none text-[#1a1714] tracking-[-0.02em]">Add title</h3>
                     <button onClick={() => !isLoading && handleCloseAdd()} className="text-[#a09890] hover:bg-black/5 active:bg-black/10 cursor-pointer p-2 -mr-2 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="flex flex-col gap-3 relative">
                     <input 
                        autoFocus
                        placeholder="Movie or series name..." 
                        value={nameQuery}
                        onChange={e=>setNameQuery(e.target.value)}
                        onKeyDown={e=>e.key==='Enter' && !isLoading && nameQuery && handleAdd()}
                        className="w-full bg-[#ffffff] border border-[#e0ddd6] rounded-[14px] py-[14px] px-4 text-[#1a1714] text-[14px] font-medium outline-none focus:border-[#c5c2bb] placeholder:text-[#a09890] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                     />
                     <input 
                        placeholder="Image URL (optional)" 
                        value={posterQuery}
                        onChange={e=>setPosterQuery(e.target.value)}
                        onKeyDown={e=>e.key==='Enter' && !isLoading && nameQuery && handleAdd()}
                        className="w-full bg-[#ffffff] border border-[#e0ddd6] rounded-[14px] py-[14px] px-4 text-[#1a1714] text-[14px] font-medium outline-none focus:border-[#c5c2bb] placeholder:text-[#a09890] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                     />
                     
                     {statusText && <div className="text-[13px] text-[#a09890] font-medium px-1">{statusText}</div>}

                     <button 
                        disabled={!nameQuery || isLoading}
                        onClick={handleAdd}
                        className="w-full mt-2 bg-[#1a1917] text-white font-semibold py-[14px] rounded-[14px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:opacity-90 disabled:opacity-50 text-[14px] flex items-center justify-center cursor-pointer transition-opacity"
                     >
                        {isLoading ? 'Adding...' : 'Add to watchlist'}
                     </button>
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN MENU OVERLAY */}
      <AnimatePresence>
        {showMainMenu && (
          <>
             <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setShowMainMenu(false)} className="fixed inset-0 bg-[#1a1917]/40 backdrop-blur-sm z-[80] w-full max-w-[430px] mx-auto cursor-pointer" />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: -10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: -10 }}
               transition={{ type: "spring", stiffness: 300, damping: 30, ease: [0.16, 1, 0.3, 1] }}
               className="absolute top-[80px] left-[20px] bg-[#f0ede8] rounded-[24px] p-5 z-[90] shadow-[0_16px_40px_rgba(0,0,0,0.2)] w-[260px] border border-[#e0ddd6] flex flex-col gap-4 origin-top-left gpu-accel"
             >
                <div className="flex items-center justify-between mb-2">
                   <h2 className="text-[20px] font-serif font-bold text-[#1a1917]">Menu</h2>
                   <button onClick={() => setShowMainMenu(false)} className="p-1 rounded-full hover:bg-black/5 active:scale-95 transition-all text-[#a09890] hover:text-[#1a1917] cursor-pointer -mr-2">
                     <X size={20} strokeWidth={2.5} />
                   </button>
                </div>
                
                <div className="flex flex-col gap-2">
                   <button 
                      onClick={() => {
                         setShowMainMenu(false);
                         handleExport();
                      }}
                      className="w-full flex items-center gap-3 p-4 rounded-[16px] bg-white border border-[#e0ddd6]/50 hover:border-[#e0ddd6] hover:shadow-sm transition-all active:scale-[0.98] text-left cursor-pointer group"
                   >
                      <div className="w-10 h-10 bg-[#f0ede8] rounded-full flex items-center justify-center text-[#1a1917] group-hover:bg-[#1a1917] group-hover:text-white transition-colors shrink-0">
                         <Download size={18} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col">
                         <span className="font-semibold text-[#1a1917] text-[15px]">Extract List</span>
                         <span className="text-[#9b9890] text-[12px] font-medium leading-none">Download to JSON</span>
                      </div>
                   </button>
                   
                   <button 
                      onClick={() => {
                         setShowMainMenu(false);
                         fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-3 p-4 rounded-[16px] bg-white border border-[#e0ddd6]/50 hover:border-[#e0ddd6] hover:shadow-sm transition-all active:scale-[0.98] text-left cursor-pointer group"
                   >
                      <div className="w-10 h-10 bg-[#f0ede8] rounded-full flex items-center justify-center text-[#1a1917] group-hover:bg-[#1a1917] group-hover:text-white transition-colors shrink-0">
                         <Upload size={18} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col">
                         <span className="font-semibold text-[#1a1917] text-[15px]">Upload List</span>
                         <span className="text-[#9b9890] text-[12px] font-medium leading-none">Import from JSON</span>
                      </div>
                   </button>
                   
                   <button 
                      onClick={() => {
                         setShowMainMenu(false);
                         syncMetadata();
                      }}
                      disabled={isSyncing}
                      className="w-full flex items-center gap-3 p-4 rounded-[16px] bg-white border border-[#e0ddd6]/50 hover:border-[#e0ddd6] hover:shadow-sm transition-all active:scale-[0.98] text-left cursor-pointer group disabled:opacity-50"
                   >
                      <div className="w-10 h-10 bg-[#f0ede8] rounded-full flex items-center justify-center text-[#1a1917] group-hover:bg-[#1a1917] group-hover:text-white transition-colors shrink-0">
                         <RefreshCw size={18} strokeWidth={2.5} className={isSyncing ? 'animate-spin' : ''} />
                      </div>
                      <div className="flex flex-col">
                         <span className="font-semibold text-[#1a1917] text-[15px]">Refresh Tools</span>
                         <span className="text-[#9b9890] text-[12px] font-medium leading-none">Sync missing images</span>
                      </div>
                   </button>
                </div>
             </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* USER SETTINGS OVERLAY */}
      <AnimatePresence>
        {showProfileSwitcher && (
          <>
             <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setShowProfileSwitcher(false)} className="fixed inset-0 bg-[#1a1917]/40 backdrop-blur-sm z-[80] w-full max-w-[430px] mx-auto" />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               transition={{ type: "spring", stiffness: 300, damping: 30, ease: [0.16, 1, 0.3, 1] }}
               className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#f0ede8] rounded-[28px] p-5 z-[90] shadow-[0_16px_40px_rgba(0,0,0,0.2)] w-[280px] border border-[#e0ddd6] flex flex-col gap-3 gpu-accel"
             >
                <div className="flex flex-col items-center gap-2 mb-4">
                  <div className="relative group overflow-hidden border border-[#e0ddd6] rounded-full shadow-sm mb-0">
                     <AvatarDisplay avatar={meEmoji} size={64} />
                     <button 
                        onClick={() => {
                           setShowProfileSwitcher(false);
                           setEditDisplayName(currentUserDisplayName!);
                           setEditAvatar(meEmoji);
                           setShowEditProfile(true);
                        }}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                     >
                        <Edit3 size={20} className="text-white" />
                     </button>
                  </div>
                  <span className="font-bold text-[#1a1917] text-[18px] capitalize">{currentUserDisplayName}</span>
                </div>
                
                <div className="w-full h-[1px] bg-[#e0ddd6] mb-2" />

                 <div className="flex flex-col gap-2 mb-2">
                    <span className="text-[12px] font-bold text-[#9b9890] uppercase tracking-wider ml-1">View list from</span>
                    <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto scrollable no-scrollbar pr-1">
                       {allUsers.filter(u => u.username !== currentProfile).length === 0 ? (
                          <div className="text-[13px] text-[#9b9890] p-2 text-center">No other users yet</div>
                       ) : (
                          allUsers.filter(u => u.username !== currentProfile).map(u => (
                             <button
                                key={u.username}
                                onClick={() => {
                                   setViewingProfile(u.username);
                                   setShowProfileSwitcher(false);
                                }}
                                className="flex items-center gap-3 p-3 rounded-[16px] bg-white border border-[#e0ddd6]/50 hover:border-[#e0ddd6] hover:shadow-sm transition-all active:scale-[0.98] w-full text-left"
                             >
                                <AvatarDisplay avatar={u.avatar} size={32} />
                                <span className="font-medium text-[#1a1917] text-[14px] truncate capitalize">{u.displayName || u.username}</span>
                             </button>
                          ))
                       )}
                    </div>
                 </div>
                 
                 <div className="w-full h-[1px] bg-[#e0ddd6] mt-2 mb-2" />

                <button 
                  onClick={() => {
                     setShowProfileSwitcher(false);
                     setEditDisplayName(currentUserDisplayName!);
                     setEditAvatar(meEmoji);
                     setShowEditProfile(true);
                  }}
                  className="w-full py-2.5 rounded-[12px] text-[#1a1917] font-semibold text-[14px] bg-[#e8e5df] hover:bg-[#e0ddd6] transition-colors mb-2 cursor-pointer"
                >
                   Edit Profile
                </button>

                <button
                   onClick={() => {
                      signOut(auth);
                      setShowProfileSwitcher(false);
                   }}
                   className="w-full bg-[#1a1917] text-white font-semibold py-[14px] rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:opacity-90 disabled:opacity-50 text-[14px] transition-opacity"
                >
                   Log Out
                </button>
             </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* EDIT PROFILE OVERLAY */}
      <AnimatePresence>
        {showEditProfile && (
          <>
             <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setShowEditProfile(false)} className="fixed inset-0 bg-[#1a1917]/40 backdrop-blur-sm z-[80] w-full max-w-[430px] mx-auto cursor-pointer" />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               transition={{ type: "spring", stiffness: 300, damping: 30, ease: [0.16, 1, 0.3, 1] }}
               className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#f0ede8] rounded-[28px] p-5 z-[90] shadow-[0_16px_40px_rgba(0,0,0,0.2)] w-[280px] border border-[#e0ddd6] flex flex-col gap-3 gpu-accel"
             >
                <div className="flex items-center justify-between mb-4">
                   <h2 className="text-[20px] font-serif font-bold text-[#1a1917]">Edit Profile</h2>
                   <button onClick={() => setShowEditProfile(false)} className="p-1 rounded-full hover:bg-black/5 active:scale-95 transition-all text-[#a09890] hover:text-[#1a1917] cursor-pointer">
                     <X size={20} strokeWidth={2.5} />
                   </button>
                </div>
                
                <div className="flex flex-col gap-2">
                   <label className="text-[12px] font-bold text-[#9b9890] uppercase tracking-wider ml-1">Avatar (Emoji, URL, or Image)</label>
                   <div className="flex items-center gap-2">
                     <div className="flex-1 relative">
                       <input 
                         type="text"
                         value={editAvatar}
                         onChange={(e) => setEditAvatar(e.target.value)}
                         placeholder="🧑 or https://..."
                         className="w-full bg-white border border-[#e0ddd6] rounded-[14px] px-4 py-3 text-[14px] text-left outline-none focus:border-[#c5c2bb] focus:ring-2 focus:ring-[#1a1917]/10 placeholder:text-[#a09890]"
                       />
                     </div>
                     <label className="shrink-0 bg-[#e8e5df] text-[#1a1917] p-3 rounded-[14px] cursor-pointer hover:bg-[#e0ddd6] transition-colors border border-[#e0ddd6]">
                       <ImagePlus size={20} />
                       <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                     </label>
                   </div>
                </div>
                
                <div className="flex flex-col gap-2 mb-4">
                   <label className="text-[12px] font-bold text-[#9b9890] uppercase tracking-wider ml-1">Display Name</label>
                   <input 
                     type="text"
                     value={editDisplayName}
                     onChange={(e) => setEditDisplayName(e.target.value)}
                     placeholder="Your name"
                     className="w-full bg-white border border-[#e0ddd6] rounded-[14px] px-4 py-3 text-[14px] outline-none focus:border-[#c5c2bb] focus:ring-2 focus:ring-[#1a1917]/10 placeholder:text-[#a09890]"
                   />
                </div>
                
                <button
                   onClick={async () => {
                      setIsLoading(true);
                      try {
                         await setDoc(doc(db, 'users', currentProfile!), {
                            username: currentProfile!,
                            displayName: editDisplayName.trim() || currentProfile!,
                            avatar: editAvatar.trim() || '🧑'
                         }, { merge: true });
                         setShowEditProfile(false);
                      } catch(e) {
                         console.error("Error saving profile", e);
                      } finally {
                         setIsLoading(false);
                      }
                   }}
                   disabled={isLoading}
                   className="w-full bg-[#1a1917] text-white font-semibold py-[14px] rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:opacity-90 disabled:opacity-50 text-[14px] transition-opacity cursor-pointer"
                >
                   {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
             </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* SMALL FLOATING BOTTOM BAR */}
      <div className="fixed bottom-[24px] left-1/2 -translate-x-1/2 bg-[#1a1917]/95 backdrop-blur-xl rounded-[28px] px-6 py-2.5 flex items-center justify-center gap-6 z-[50] shadow-[0_16px_40px_rgba(0,0,0,0.25)] border border-[#302e2a] gpu-accel">
        <button onClick={() => setActiveView('home')} className={`flex flex-col items-center justify-center gap-1 outline-none transition-all cursor-pointer min-w-[44px] ${activeView === 'home' ? 'text-white' : 'text-[#858279] hover:text-[#c4c1b9]'}`}>
           <Home size={20} strokeWidth={2.5} />
           <span className="text-[10px] font-bold tracking-wide leading-none">Home</span>
        </button>
        
        {!isReadOnly && (
           <button onClick={handleOpenAdd} className="w-[42px] h-[42px] bg-white rounded-full flex items-center justify-center text-[#1a1917] outline-none hover:scale-105 active:scale-95 transition-all shadow-[0_2px_12px_rgba(255,255,255,0.15)] cursor-pointer mx-1">
              <Plus size={22} strokeWidth={3} />
           </button>
        )}
        
        <button onClick={() => setActiveView('stats')} className={`flex flex-col items-center justify-center gap-1 outline-none transition-all cursor-pointer min-w-[44px] ${activeView === 'stats' ? 'text-white' : 'text-[#858279] hover:text-[#c4c1b9]'}`}>
           <BarChart2 size={20} strokeWidth={2.5} />
           <span className="text-[10px] font-bold tracking-wide leading-none">Stats</span>
        </button>
      </div>

    </div>
  );
}

// Sub-components

function SeasonCard({ season, series, currentProfile, isReadOnly }: { season: SeasonItem, series: TitleItem, currentProfile?: string | null, isReadOnly?: boolean }) {
  const handleStatusToggle = async (newStatus: TitleStatus) => {
    if (isReadOnly || !currentProfile) return;
    if (!series.seasons) return;
    const updatedSeasons = series.seasons.map(s => s.id === season.id ? { ...s, status: newStatus } : s);
    
    // Automatically recalculate series overall status based on seasons
    let overallStatus = series.status;
    const allCompleted = updatedSeasons.every(s => s.status === 'completed');
    const anyWatching = updatedSeasons.some(s => s.status === 'watching' || s.status === 'completed');
    
    if (allCompleted) {
       overallStatus = 'completed';
    } else if (anyWatching) {
       overallStatus = 'watching';
    } else {
       overallStatus = 'plan';
    }

    try {
       await updateDoc(doc(db, 'users', currentProfile, 'watchlist', series.id.toString()), { 
          seasons: updatedSeasons,
          status: overallStatus
       });
    } catch (err) {
       console.error("Failed to update season status", err);
    }
  };
  
  return (
      <div className="relative flex items-center gap-[12px] p-[8px_16px] w-full bg-white group hover:bg-black/[0.02] transition-colors border border-[#e0ddd6]/50 rounded-[12px] shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
         <div className="flex-1 min-w-0 flex flex-col justify-center">
           <div className="text-[14px] font-semibold text-[#1a1917] tracking-[-0.01em] truncate">{season.name}</div>
           <div className="text-[12px] text-[#9b9890] font-medium">{season.episode_count} Episodes</div>
         </div>
         <div className="flex shrink-0 gap-2 items-center" onClick={(e) => e.stopPropagation()}>
           {!isReadOnly && (
             <>
               <button onClick={() => handleStatusToggle('plan')} className={`p-1.5 rounded-full transition-colors cursor-pointer ${season.status === 'plan' || !season.status ? 'bg-[#d4840a]/10 text-[#d4840a]' : 'hover:bg-black/5 text-[#9b9890]'}`}>
                  <Bookmark size={16} strokeWidth={2.5} />
               </button>
               <button onClick={() => handleStatusToggle('watching')} className={`p-1.5 rounded-full transition-colors cursor-pointer ${season.status === 'watching' ? 'bg-[#6a1bdb]/10 text-[#6a1bdb]' : 'hover:bg-black/5 text-[#9b9890]'}`}>
                  <PlayCircle size={16} strokeWidth={2.5} />
               </button>
               <button onClick={() => handleStatusToggle('completed')} className={`p-1.5 rounded-full transition-colors cursor-pointer ${season.status === 'completed' ? 'bg-[#388e3c]/10 text-[#388e3c]' : 'hover:bg-black/5 text-[#9b9890]'}`}>
                  <CheckCircle2 size={16} strokeWidth={2.5} />
               </button>
             </>
           )}
           {isReadOnly && (
             <div className="p-1.5">
               {season.status === 'completed' && <CheckCircle2 size={16} strokeWidth={2.5} className="text-[#388e3c]" />}
               {season.status === 'watching' && <PlayCircle size={16} strokeWidth={2.5} className="text-[#6a1bdb]" />}
               {(season.status === 'plan' || !season.status) && <Bookmark size={16} strokeWidth={2.5} className="text-[#d4840a]" />}
             </div>
           )}
         </div>
      </div>
  );
}

function StackingList({ items, isInitializing, onSelect, isReadOnly, currentProfile }: { items: TitleItem[] | null, isInitializing: boolean, onSelect: (id: number) => void, isReadOnly?: boolean, currentProfile?: string | null }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(120);
  const [expandedColId, setExpandedColId] = useState<string | null>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    requestAnimationFrame(() => {
       const firstCard = scrollerRef.current?.querySelector('.card-inner') as HTMLElement;
       if (firstCard) setCardH(firstCard.offsetHeight);
    });
  }, [items]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => {
      if (typeof window === 'undefined') return;
      window.requestAnimationFrame(() => {
        const scrollerRect = scroller.getBoundingClientRect();
        const anchors = scroller.querySelectorAll('.card-wrap-anchor') as NodeListOf<HTMLElement>;
        
        anchors.forEach((anchor) => {
          const wrap = anchor.querySelector('.card-wrap-sticky') as HTMLElement;
          if (!wrap) return;
          const card = wrap.querySelector('.card-inner') as HTMLElement;
          if (!card) return;
          
          wrap.style.perspective = 'none'; // Clear 3D
          
          const anchorRect = anchor.getBoundingClientRect();
          // How far the natural position of this item scrolled past the top of the viewport
          const passedBy = (scrollerRect.top + 10) - anchorRect.top; // +10 to match the pt-[10px] of the sticky wrap
          
          if (passedBy > 0) {
             if (passedBy > cardH * 1.5) {
                // Far off-screen
                if (card.style.opacity !== '0') {
                    card.style.transform = `translate3d(0, -32px, 0) scale(0.95)`;
                    card.style.opacity = '0';
                }
             } else {
                 const rawProgress = Math.min(passedBy / cardH, 1);
                 const easeProgress = 1 - Math.pow(1 - rawProgress, 3);
                 
                 const translateY = -(easeProgress * 28);
                 const scale = 1 - (easeProgress * 0.05);
                 const opacity = 1 - (passedBy / (cardH * 0.9));
                 
                 card.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
                 card.style.opacity = Math.max(opacity, 0).toString();
             }
          } else {
             card.style.transform = 'translate3d(0, 0, 0) scale(1)';
             card.style.opacity = '1';
          }
        });
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    // trigger once to set initial state
    setTimeout(onScroll, 50);
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [items, cardH]);

  if (isInitializing) {
     return (
        <div ref={scrollerRef} className="flex-1 overflow-y-auto scrollable no-scrollbar px-[24px] pb-[110px] relative w-full pt-1 contain-list">
          <div className="pb-[40px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card-wrap-anchor relative h-[125px]">
                <div className="card-wrap-sticky sticky pt-[10px]" style={{ top: 0, zIndex: i + 1 }}>
                   <div className="card-inner relative" style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}>
                      {i % 4 === 0 ? <CollectionCardSkeleton /> : <ListCardSkeleton />}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
     );
  }

  if (!items || items.length === 0) {
     return (
        <div className="flex-1 overflow-y-auto scrollable no-scrollbar px-[24px] pb-[110px] w-full contain-list">
           <div className="py-16 flex flex-col items-center text-center animate-in fade-in duration-500">
              <div className="w-[72px] h-[72px] bg-white rounded-full border border-[#e0ddd6] flex items-center justify-center mb-5 text-[#9b9890] shadow-sm">
                <List size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-[22px] font-serif text-[#1a1917] mb-2 tracking-[-0.02em]">Your list is empty</h3>
              <p className="text-[#9b9890] text-[14px] max-w-[240px] leading-[1.5] font-medium">Tap the plus icon below or use the search bar to add titles.</p>
           </div>
        </div>
     );
  }

  // Group items by collection first
  const groupedByName: Record<string, TitleItem[]> = {};
  items.forEach(item => {
      let cName = item.title;
      if (item.title.includes(':')) {
          cName = item.title.split(':')[0].trim();
      } else {
          const match = item.title.match(/^(.*?)(?:\s+(?:[IVX]+|\d+))?$/i);
          if (match && match[1]) {
              cName = match[1].trim();
          }
      }
      if (!groupedByName[cName]) groupedByName[cName] = [];
      groupedByName[cName].push(item);
  });

  const listItems: ListItem[] = [];
  for (const [cName, cItems] of Object.entries(groupedByName)) {
      if (cItems.length > 1) {
          listItems.push({
              isCollection: true,
              id: 'col_' + cName,
              title: cName + (cName.toLowerCase().endsWith('collection') ? '' : ''),
              items: cItems,
              genre: cItems[0].genre || 'Other',
              poster: cItems[0].poster,
              status: cItems.every(i => i.status === 'completed') ? 'completed' : 'plan'
          });
      } else {
          listItems.push(cItems[0]);
      }
  }

  // Group items by Genre
  const groupedItems = listItems.reduce((acc, item) => {
     let genre = item.genre ? item.genre.split(',')[0].trim() : 'Other';
     if (!genre) genre = 'Other';
     if (!acc[genre]) {
        acc[genre] = [];
     }
     acc[genre].push(item);
     return acc;
  }, {} as Record<string, ListItem[]>);

  // Sort genres alphabetically
  const sortedGenres = Object.keys(groupedItems).sort();

  let globalIndex = 0; // Use for staggered animations and stacking z-index

  return (
    <div ref={scrollerRef} className="flex-1 overflow-y-auto scrollable no-scrollbar px-[24px] pb-[110px] relative w-full pt-1 contain-list">
      <div className="pb-[40px] flex flex-col gap-8">
        {sortedGenres.map((genre) => (
           <div key={genre} className="flex flex-col">
              <h3 className="font-serif text-[24px] font-medium text-[#1a1917] tracking-tight mb-1">{genre}</h3>
              <div className="mt-2 text-left">
                 <AnimatePresence initial={false}>
                 {groupedItems[genre].map((item) => {
                    globalIndex++;
                    if ('isCollection' in item) {
                       const isExpanded = expandedColId === item.id;
                       return (
                          <React.Fragment key={item.id}>
                             <motion.div 
                               layout="position"
                               initial={{ height: 0, opacity: 0 }}
                               animate={{ height: 130, opacity: 1 }}
                               exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                               transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                               className="card-wrap-anchor relative"
                               style={{ contentVisibility: 'auto' }}
                             >
                                <div className="card-wrap-sticky sticky pt-[10px]" style={{ top: 0, zIndex: globalIndex }}>
                                   <div className="card-inner relative" style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}>
                                      <div className="animate-list-item" style={{ animationDelay: `${Math.min(globalIndex, 15) * 0.03 + 0.02}s` }}>
                                         <CollectionCard item={item} isExpanded={isExpanded} onClick={() => setExpandedColId(isExpanded ? null : item.id)} />
                                      </div>
                                   </div>
                                </div>
                             </motion.div>
                             
                             <AnimatePresence>
                                {isExpanded && item.items.map((subItem) => {
                                   globalIndex++;
                                   return (
                                      <motion.div 
                                        key={subItem.id}
                                        layout="position"
                                        initial={{ height: 0, opacity: 0, scale: 0.9, y: -20 }}
                                        animate={{ height: 130, opacity: 1, scale: 1, y: 0 }}
                                        exit={{ height: 0, opacity: 0, scale: 0.9, y: -20, overflow: 'hidden' }}
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                        className="card-wrap-anchor relative pl-8"
                                        style={{ contentVisibility: 'auto' }}
                                      >
                                        <div className="card-wrap-sticky sticky pt-[10px]" style={{ top: 0, zIndex: globalIndex }}>
                                           <div className="card-inner relative" style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}>
                                              <ListCard item={subItem} index={globalIndex} onClick={() => onSelect(subItem.id)} isReadOnly={isReadOnly} currentProfile={currentProfile} />
                                           </div>
                                        </div>
                                      </motion.div>
                                   )
                                })}
                             </AnimatePresence>
                          </React.Fragment>
                       );
                    }
                    
                    const isExpanded = expandedColId === item.id;
                    const hasSeasons = !('isCollection' in item) && item.seasons && item.seasons.length > 0;
                    
                    return (
                       <React.Fragment key={item.id}>
                         <motion.div 
                           layout="position"
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: 130, opacity: 1 }}
                           exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                           transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                           className="card-wrap-anchor relative"
                           style={{ contentVisibility: 'auto' }}
                         >
                           <div className="card-wrap-sticky sticky pt-[10px]" style={{ top: 0, zIndex: globalIndex }}>
                              <div className="card-inner relative" style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}>
                                 <div className="animate-list-item" style={{ animationDelay: `${Math.min(globalIndex, 15) * 0.03 + 0.02}s` }}>
                                    <ListCard 
                                       item={item as TitleItem} 
                                       index={globalIndex} 
                                       onClick={() => onSelect(item.id)} 
                                       isReadOnly={isReadOnly} 
                                       currentProfile={currentProfile}
                                       isExpanded={isExpanded}
                                       onToggleExpand={hasSeasons ? () => setExpandedColId(isExpanded ? null : item.id) : undefined}
                                    />
                                 </div>
                              </div>
                           </div>
                         </motion.div>

                         <AnimatePresence>
                            {isExpanded && hasSeasons && (item as TitleItem).seasons!.map((season, sIdx) => {
                               globalIndex++;
                               return (
                                  <motion.div 
                                    key={season.id}
                                    layout="position"
                                    initial={{ height: 0, opacity: 0, scale: 0.9, y: -20 }}
                                    animate={{ height: 80, opacity: 1, scale: 1, y: 0 }}
                                    exit={{ height: 0, opacity: 0, scale: 0.9, y: -20, overflow: 'hidden' }}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="card-wrap-anchor relative pl-8 mt-1.5"
                                    style={{ contentVisibility: 'auto' }}
                                  >
                                    <div className="card-wrap-sticky sticky pt-[0px]" style={{ top: 0, zIndex: globalIndex }}>
                                       <div className="card-inner relative" style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}>
                                          <SeasonCard season={season} series={item as TitleItem} currentProfile={currentProfile} isReadOnly={isReadOnly} />
                                       </div>
                                    </div>
                                  </motion.div>
                               )
                            })}
                         </AnimatePresence>
                       </React.Fragment>
                    );
                 })}
                 </AnimatePresence>
              </div>
           </div>
        ))}
      </div>
    </div>
  );
}

function CollectionCard({ item, isExpanded, onClick }: { item: CollectionItem, isExpanded: boolean, onClick: () => void }) {
  const completedCount = item.items.filter(i => i.status === 'completed').length;
  const leftCount = item.items.length - completedCount;
  const progressPercent = item.items.length > 0 ? Math.round((completedCount / item.items.length) * 100) : 0;

  return (
    <div 
        onClick={onClick} 
        className={`relative flex items-center gap-[12px] p-[8px_16px_8px_8px] w-full bg-white group active:scale-[0.98] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 ease-out cursor-pointer border rounded-[16px] ${isExpanded ? 'border-[#1a1917]/20 shadow-md ring-1 ring-[#1a1917]/5' : 'border-[#e0ddd6]/50 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'}`}
    >
        {/* Stack effect behind the main poster */}
        <div className="w-[70px] h-[105px] shrink-0 relative flex items-center justify-center overflow-visible pointer-events-none mx-[4px]">
            <div className={`absolute inset-0 bg-[#e0dbd4] border border-[#d0ccc6] rounded-[10px] transform ${isExpanded ? 'translate-x-1 -rotate-2' : 'translate-x-1.5 -rotate-6'} shadow-sm transition-all duration-500`} />
            <div className={`absolute inset-0 bg-[#f0ede8] border border-[#d0ccc6] rounded-[10px] transform ${isExpanded ? 'translate-x-0.5 rotate-1' : 'translate-x-[10px] rotate-3'} shadow-sm transition-all duration-500`} />
            <div className={`absolute inset-0 bg-white rounded-[10px] overflow-hidden border border-[#e0ddd6] shadow-sm transition-all duration-500 z-10 ${isExpanded ? 'scale-[1.02]' : ''}`}>
                {item.poster ? <img src={item.poster} className="w-full h-full object-cover" /> : (
                   <div className="w-full h-full bg-gradient-to-br from-[#ece9e4] to-[#dedbd5] flex items-center justify-center text-3xl">🍿</div>
                )}
            </div>
            
            <motion.div 
               animate={{ rotate: isExpanded ? -90 : 0 }}
               className={`absolute -right-3 -bottom-2 ${isExpanded ? 'bg-[#1a1917] text-white outline outline-2 outline-white' : 'bg-white text-[#1a1917] border border-[#e0ddd6]'} rounded-full p-1 shadow-md z-20 transition-colors duration-300`}
            >
               <ChevronLeft size={14} strokeWidth={3} className="-rotate-90" />
            </motion.div>
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center py-1 ml-2">
            <div className="text-[11px] uppercase tracking-widest font-bold text-[#b8b5ab] mb-0.5 flex items-center gap-1.5">
               <List size={12} /> Collection
            </div>
            
            <div className="text-[15px] leading-[1.25] font-semibold mb-2 text-[#1a1917] tracking-[-0.01em] line-clamp-2 pr-2">{item.title}</div>
            
            <div className="flex flex-col mt-auto">
                <div className="text-[12px] text-[#7a7770] font-medium flex items-center gap-x-1.5 gap-y-1 flex-wrap mb-1.5">
                    <span className="font-bold text-[#1a1917]">{item.items.length} titles</span>
                    <div className="w-[3px] h-[3px] rounded-full bg-[#d0cac3] shrink-0" />
                    <span className="flex items-center gap-1 text-[#388e3c]"><CheckCircle2 size={12} /> {completedCount} Done</span>
                    <div className="w-[3px] h-[3px] rounded-full bg-[#d0cac3] shrink-0" />
                    <span className="flex items-center gap-1 text-[#d4840a]"><PlayCircle size={12} /> {leftCount} Left</span>
                </div>
                
                <div className="flex items-center gap-2">
                   <div className="flex-1 bg-[#f0ede8] h-1.5 rounded-full overflow-hidden">
                       <div className="bg-[#1a1917] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
                   </div>
                   <span className="text-[10px] font-bold text-[#1a1917] shrink-0 w-6 text-right leading-none">{progressPercent}%</span>
                </div>
            </div>
        </div>
    </div>
  );
}

function ListCard({ item, index, onClick, isReadOnly, currentProfile, isExpanded, onToggleExpand }: { item: TitleItem, index: number, onClick: () => void, isReadOnly?: boolean, currentProfile?: string | null, key?: any, isExpanded?: boolean, onToggleExpand?: () => void }) {
  const [removedDir, setRemovedDir] = useState<'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  
  // Transform x to specific styles
  const backgroundColor = useTransform(
    x,
    [-150, -80, -30, 0, 30, 80, 150],
    [
      '#d32f2f', 
      '#ef5350', 
      '#e0ddd6', 
      '#e0ddd6', 
      '#e0ddd6', 
      item.status === 'completed' ? '#ffb74d' : '#66bb6a', 
      item.status === 'completed' ? '#f57c00' : '#388e3c'
    ]
  );
  
  const leftIconScale = useTransform(x, [30, 80, 150], [0.75, 1, 1.25], { clamp: true });
  const leftIconOpacity = useTransform(x, [30, 80, 150], [0, 0.5, 1], { clamp: true });
  
  const rightIconScale = useTransform(x, [-150, -80, -30], [1.25, 1, 0.75], { clamp: true });
  const rightIconOpacity = useTransform(x, [-150, -80, -30], [1, 0.5, 0], { clamp: true });

  useEffect(() => {
    setRemovedDir(null);
  }, [item.status, item.id]);

  const handleDragEnd = async (_: any, info: any) => {
    setIsDragging(false);
    if (isReadOnly) return;
    if (!cardRef.current) return;
    const thresh = cardRef.current.offsetWidth * 0.35;
    const velocity = info.velocity.x;
    
    // Check if we passed the threshold or flicked it hard enough
    if (info.offset.x > thresh || (info.offset.x > 50 && velocity > 600)) {
      setRemovedDir('right');
      setTimeout(async () => {
        if (item.status === 'completed') {
          await updateDoc(doc(db, 'users', currentProfile!, 'watchlist', item.id.toString()), { status: 'plan' });
        } else {
          await updateDoc(doc(db, 'users', currentProfile!, 'watchlist', item.id.toString()), { status: 'completed' });
        }
      }, 300);
    } else if (info.offset.x < -thresh || (info.offset.x < -50 && velocity < -600)) {
      setRemovedDir('left');
      setTimeout(async () => {
        await deleteDoc(doc(db, 'users', currentProfile!, 'watchlist', item.id.toString()));
      }, 300);
    }
  };

  return (
    <div ref={cardRef} className="relative w-full rounded-[16px] overflow-hidden bg-[#e0ddd6]">
      {/* Background reveals */}
      {!isReadOnly && (
        <motion.div 
           style={{ backgroundColor }} 
           className={`absolute inset-0 flex items-center justify-between px-6 ${isDragging || removedDir ? 'opacity-100' : 'opacity-0'}`}
        >
           <motion.div style={{ scale: leftIconScale, opacity: leftIconOpacity }}>
              {item.status === 'completed' ? (
                  <Bookmark color="white" size={28} />
              ) : (
                  <CheckCircle2 color="white" size={28} />
              )}
           </motion.div>
           <motion.div style={{ scale: rightIconScale, opacity: rightIconOpacity }}>
              <Trash2 color="white" size={28} />
           </motion.div>
        </motion.div>
      )}

      <motion.div 
         drag={removedDir || isReadOnly ? false : "x"}
         dragConstraints={{ left: 0, right: 0 }}
         dragElastic={0.8}
         style={{ x }}
         onDragStart={() => setIsDragging(true)}
         onDragEnd={handleDragEnd}
         animate={removedDir === 'right' ? { x: 500, opacity: 0 } : removedDir === 'left' ? { x: -500, opacity: 0 } : { x: 0, opacity: 1 }}
         transition={{ type: "spring", bounce: 0, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
         onClick={onClick} 
         className="relative flex items-center gap-[12px] p-[8px_16px_8px_8px] w-full min-h-[121px] max-h-[121px] h-[121px] bg-white group active:bg-black/5 hover:bg-black/[0.02] hover:shadow-[0_8px_16px_rgba(0,0,0,0.06)] transition-all duration-300 ease-out origin-center cursor-pointer border border-[#e0ddd6]/50 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      >
        <div className="w-[70px] h-[105px] rounded-[10px] bg-[#e0dbd4] shrink-0 flex items-center justify-center text-xl overflow-hidden border border-[#e0ddd6] group-hover:-translate-y-1 group-active:-translate-y-0.5 group-hover:shadow-md transition-all duration-400 ease-out pointer-events-none">
          {item.poster ? <img src={item.poster} className="w-full h-full object-cover" /> : (item.type === 'movie' ? '🍿' : '📺')}
       </div>
       
       <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
         <div className="text-[15px] leading-[1.25] font-semibold mb-1 text-[#1a1917] tracking-[-0.01em] truncate w-full pr-2">{item.title}</div>
         
         <div className="flex flex-col gap-1 w-full pr-2">
            <div className="text-[12px] text-[#9b9890] font-medium flex items-center gap-1.5 truncate">
               <span>{item.year || 'Unknown'}</span>
               <div className="w-[3px] h-[3px] rounded-full bg-[#d0cac3] shrink-0" />
               <span className="capitalize">{item.type}</span>
            </div>

            {item.genre && (
              <div className="text-[12px] text-[#9b9890] truncate flex items-center gap-1.5">
                 <span className="truncate">{item.genre.split(',')[0].trim()}</span>
                 {item.rating && (
                   <>
                     <div className="w-[3px] h-[3px] rounded-full bg-[#d0cac3] shrink-0" />
                     <span className="flex items-center gap-0.5 shrink-0"><Star size={10} className="fill-[#e8a020] text-[#e8a020]" /> {item.rating}</span>
                   </>
                 )}
              </div>
            )}
            {!item.genre && item.rating && (
              <div className="text-[12px] text-[#9b9890] truncate flex items-center gap-1.5">
                 <span className="flex items-center gap-0.5 shrink-0"><Star size={10} className="fill-[#e8a020] text-[#e8a020]" /> {item.rating}</span>
              </div>
            )}
            {item.seasons && item.seasons.length > 0 && (
                <div className="mt-0.5 pt-0.5 w-full">
                   <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-[#b8b5ad] mb-1">
                      <span>Season Progress</span>
                      <span>{Math.round((item.seasons.filter(s => s.status === 'completed').length / item.seasons.length) * 100)}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-[#e0ddd6] rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#388e3c] transition-all" style={{ width: `${Math.round((item.seasons.filter(s => s.status === 'completed').length / item.seasons.length) * 100)}%` }} />
                      <div className="h-full bg-[#6a1bdb] transition-all opacity-60" style={{ width: `${Math.round((item.seasons.filter(s => s.status === 'watching').length / item.seasons.length) * 100)}%` }} />
                   </div>
                </div>
            )}
         </div>
       </div>

       <div className="flex shrink-0 ml-1 transition-all flex-col items-center justify-center gap-3 w-[26px]" onClick={(e) => {
          e.stopPropagation();
       }}>
          {item.status === 'completed' ? (
             <CheckCircle2 size={18} strokeWidth={2.5} className="text-[#388e3c] opacity-80 shrink-0" />
          ) : item.status === 'watching' ? (
             <PlayCircle size={18} strokeWidth={2.5} className="text-[#6a1bdb] opacity-80 shrink-0" />
          ) : (
             <Bookmark size={18} strokeWidth={2.5} className="text-[#d4840a] opacity-80 shrink-0" />
          )}
          {item.seasons && item.seasons.length > 0 && onToggleExpand && (
             <div 
               className="h-[22px] w-[22px] shrink-0 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer flex items-center justify-center"
               onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
             >
                 <ChevronDown size={18} strokeWidth={2} className={`text-[#9b9890] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
             </div>
          )}
       </div>
     </motion.div>
    </div>
  )
}

function ItemDetailView({ item, onClose, onUpdate, onRemove, isReadOnly }: { item: TitleItem; onClose: () => void; onUpdate: (updates: Partial<TitleItem>) => void; onRemove: (id: number) => void; isReadOnly: boolean; key?: any; }) {
  const [isEditingPoster, setIsEditingPoster] = useState(false);
  const [tempPoster, setTempPoster] = useState(item.poster || '');

  return (
    <motion.div initial={{y:"100%", opacity: 0.8 }} animate={{y:0, opacity: 1 }} exit={{y:"100%", opacity: 0 }} transition={{type: "spring", damping: 28, stiffness: 200, mass: 0.8, ease: [0.16, 1, 0.3, 1]}} className="fixed inset-0 z-50 bg-[#141414] overflow-y-auto scrollable no-scrollbar w-full max-w-[430px] mx-auto overflow-x-hidden gpu-accel">
      
      {/* POSTER HERO (Fixed in background or absolute) */}
      <div className="absolute top-0 left-0 w-full h-[65vh] bg-[#1a1917]">
         {item.poster ? (
             <img src={item.poster} className="w-full h-full object-cover object-center" />
         ) : (
             <div className="w-full h-full flex flex-col items-center justify-center text-[64px]">
               {item.type === 'movie' ? '🎬' : '📺'}
               <span className="text-[#9b9890] uppercase tracking-[1px] text-[10px] font-semibold mt-2">No Poster</span>
             </div>
         )}
         {/* Subtle gradient at the top for buttons visibility */}
         <div className="absolute top-0 left-0 right-0 h-[20vh] bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
      </div>

      {/* Top Actions: Back / Edit */}
      <button onClick={onClose} className="absolute top-6 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white border border-white/10 z-20 cursor-pointer shadow-sm hover:bg-black/50 transition-all">
         <X size={20} strokeWidth={2.5} />
      </button>
      {!isReadOnly && (
         <button onClick={() => setIsEditingPoster(true)} className="absolute top-6 left-5 w-9 h-9 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white border border-white/10 z-20 cursor-pointer shadow-sm hover:bg-black/50 transition-all">
            <ImagePlus size={16} />
         </button>
      )}

      {/* CONTENT SHEET Overlapping the poster */}
      <div className="relative z-10 mt-[55vh] min-h-[45vh] bg-[#f5f3ef] rounded-t-[32px] px-6 pt-8 pb-32 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]">
         
         {/* Header row: TYPE YEAR & RATING */}
         <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
               <span className="text-[12px] font-bold tracking-[0.08em] text-[#9b9890] uppercase leading-none">{item.type}</span>
               {item.year && <span className="text-[12px] font-bold tracking-[0.05em] text-[#9b9890] leading-none">{item.year}</span>}
            </div>
            {item.rating && (
               <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#1a1917]">
                  <Star size={14} className="fill-[#e8a020] text-[#e8a020]" />
                  <span>{item.rating}</span>
               </div>
            )}
         </div>

         {/* Title */}
         <h1 className="font-serif text-[42px] leading-[1.05] text-[#1a1917] mb-5 tracking-[-0.03em]">{item.title}</h1>

         {/* Genres */}
         {item.genre && (
            <div className="flex flex-wrap gap-2 mb-6">
               {item.genre.split(',').map(g => g.trim()).map(g => (
                  <span key={g} className="text-[13px] font-semibold px-3 py-1.5 rounded-[8px] bg-white text-[#1a1917] border border-[#e0ddd6] shadow-sm">
                     {g}
                  </span>
               ))}
            </div>
         )}

         {/* Synopsis */}
         <p className="text-[16px] text-[#8a8781] font-sans leading-[1.65] mb-10">
            {item.synopsis || "No synopsis available for this title."}
         </p>

         {/* Details Card: Director & Cast */}
         <div className="bg-white border border-[#e0ddd6] rounded-[24px] p-6 shadow-sm mb-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
               <span className="text-[11px] font-bold tracking-[0.08em] text-[#b8b5ad] uppercase">Director</span>
               <span className="text-[16px] font-medium text-[#1a1917]">{item.director || 'N/A'}</span>
            </div>
            
            <div className="h-[1px] w-full bg-[#e0ddd6]/60" />
            
            <div className="flex flex-col gap-2">
               <span className="text-[11px] font-bold tracking-[0.08em] text-[#b8b5ad] uppercase">Cast</span>
               {item.cast && item.cast.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                     {item.cast.map(actor => (
                        <span key={actor} className="text-[14px] font-medium text-[#1a1917] bg-[#f5f3ef] px-4 py-2 rounded-full border border-[#e0ddd6]">
                           {actor}
                        </span>
                     ))}
                  </div>
               ) : (
                  <span className="text-[16px] font-medium text-[#1a1917]">N/A</span>
               )}
            </div>
         </div>

         {/* Status Actions */}
         {!isReadOnly && (
            <div className="flex flex-col gap-2 bg-white rounded-[20px] p-1.5 border border-[#e0ddd6] shadow-sm mb-8">
               <div className="flex gap-1 w-full">
                  <button 
                    onClick={() => onUpdate({status: 'plan'})} 
                    className={`flex-1 py-3.5 rounded-[16px] text-[13px] font-semibold transition-all duration-300 ease-out active:scale-[0.96] cursor-pointer w-full ${item.status === 'plan' || !item.status ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5 hover:text-[#1a1917]'}`}
                  >
                    Plan to Watch
                  </button>
                  <button 
                    onClick={() => onUpdate({status: 'watching'})} 
                    className={`flex-1 py-3.5 rounded-[16px] text-[13px] font-semibold transition-all duration-300 ease-out active:scale-[0.96] cursor-pointer w-full ${item.status === 'watching' ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5 hover:text-[#1a1917]'}`}
                  >
                    Watching
                  </button>
                  <button 
                    onClick={() => onUpdate({status: 'completed'})} 
                    className={`flex-1 py-3.5 rounded-[16px] text-[13px] font-semibold transition-all duration-300 ease-out active:scale-[0.96] cursor-pointer w-full ${item.status === 'completed' ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5 hover:text-[#1a1917]'}`}
                  >
                    Completed
                  </button>
               </div>
            </div>
         )}

         {!isReadOnly && (
            <button onClick={() => { onRemove(item.id); onClose(); }} className="w-full flex items-center justify-center gap-2 py-4 rounded-[16px] text-[#d32f2f] hover:bg-[#d32f2f]/10 active:scale-[0.98] transition-all duration-300 ease-out mt-auto font-medium text-[14px] cursor-pointer">
               <Trash2 size={18} /> Delete Title
            </button>
         )}
      </div>

      <AnimatePresence>
        {isEditingPoster && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-[#1a1917]/40 backdrop-blur-md flex flex-col items-center justify-center p-6 z-[60] text-center"
          >
              <div className="w-full bg-[#f0ede8] border border-[#e0ddd6] rounded-[20px] p-6 shadow-xl flex flex-col gap-4 text-left">
                 <h3 className="font-serif text-[28px] leading-none text-[#1a1917] tracking-[-0.5px]">Edit poster</h3>
                 <input value={tempPoster} onChange={e=>setTempPoster(e.target.value)} className="w-full bg-white border border-[#e0ddd6] rounded-xl p-3 text-[#1a1917] text-[14px] font-sans outline-none focus:border-[#c5c2bb] placeholder:text-[#9b9890]" placeholder="https:// images..." />
                 
                 <div className="flex gap-2">
                    <button onClick={() => { onUpdate({poster: tempPoster}); setIsEditingPoster(false); }} className="flex-1 bg-[#1a1917] text-white font-medium rounded-xl py-3 text-[14px] active:scale-95 transition-transform cursor-pointer">Save</button>
                    <button onClick={() => setIsEditingPoster(false)} className="bg-white border border-[#e0ddd6] text-[#1a1917] font-medium rounded-xl px-5 py-3 text-[14px] active:scale-95 transition-transform cursor-pointer hover:bg-black/5">Cancel</button>
                 </div>
                 
                 {item.poster && (
                   <button onClick={() => { setTempPoster(''); onUpdate({poster: ''}); setIsEditingPoster(false); }} className="mt-1 text-[13px] text-[#d32f2f] py-2 border border-[#d32f2f]/20 hover:bg-[#d32f2f]/5 rounded-[12px] font-medium cursor-pointer transition-colors w-full">Remove Image</button>
                 )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}

function ListCardSkeleton({ key }: { key?: any }) {
  return (
    <div className="flex items-center gap-[12px] p-[8px_16px_8px_8px] w-full min-h-[121px] max-h-[121px] h-[121px] animate-pulse bg-white rounded-[16px] border border-[#e0ddd6]/50 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
       <div className="w-[70px] h-[105px] rounded-[10px] bg-[#e0dbd4] shrink-0" />
       
       <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
         <div className="h-[15px] bg-[#e0dbd4] rounded-[4px] w-[85%] mb-2" />
         
         <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
               <div className="h-[12px] bg-[#e0dbd4]/80 rounded-[4px] w-[35px]" />
               <div className="w-[3px] h-[3px] rounded-full bg-[#d0cac3] shrink-0" />
               <div className="h-[12px] bg-[#e0dbd4]/80 rounded-[4px] w-[45px]" />
            </div>
            
            <div className="flex items-center gap-1.5 mt-0.5">
               <div className="h-[12px] bg-[#e0dbd4]/60 rounded-[4px] w-[55px]" />
               <div className="w-[3px] h-[3px] rounded-full bg-[#d0cac3] shrink-0" />
               <div className="h-[12px] bg-[#e0dbd4]/60 rounded-[4px] w-[30px]" />
            </div>
         </div>
       </div>
       <div className="w-[18px] h-[18px] rounded-full bg-[#e0dbd4] flex items-center shrink-0 ml-1 mx-2" />
    </div>
  )
}

function CollectionCardSkeleton() {
  return (
    <div className="relative flex items-center gap-[12px] p-[8px_16px_8px_8px] w-full animate-pulse bg-white rounded-[16px] border border-[#e0ddd6]/50 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="w-[70px] h-[105px] shrink-0 relative flex items-center justify-center overflow-hidden mx-[4px]">
            <div className={`absolute inset-0 bg-[#e0dbd4]/50 rounded-[10px] transform translate-x-1.5 -rotate-6`} />
            <div className={`absolute inset-0 bg-[#e0dbd4]/80 rounded-[10px] transform translate-x-[10px] rotate-3`} />
            <div className={`absolute inset-0 bg-[#e0dbd4] rounded-[10px] z-10`} />
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center py-1 ml-2">
            <div className="h-[11px] bg-[#e0dbd4] rounded-[3px] w-[65px] mb-1.5" />
            
            <div className="h-[16px] bg-[#e0dbd4] rounded-[4px] w-[75%] mb-2.5" />
            
            <div className="flex flex-col mt-auto">
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="h-[12px] bg-[#e0dbd4]/80 rounded-[3px] w-[45px]" />
                    <div className="w-[3px] h-[3px] rounded-full bg-[#d0cac3] shrink-0" />
                    <div className="h-[12px] bg-[#e0dbd4]/80 rounded-[3px] w-[50px]" />
                    <div className="w-[3px] h-[3px] rounded-full bg-[#d0cac3] shrink-0" />
                    <div className="h-[12px] bg-[#e0dbd4]/80 rounded-[3px] w-[40px]" />
                </div>
                
                <div className="flex items-center gap-2">
                   <div className="flex-1 bg-[#f0ede8] h-1.5 rounded-full overflow-hidden">
                       <div className="bg-[#e0dbd4] h-full rounded-full w-1/3" />
                   </div>
                   <div className="w-5 h-[10px] bg-[#e0dbd4] rounded-[3px]" />
                </div>
            </div>
        </div>
    </div>
  );
}
