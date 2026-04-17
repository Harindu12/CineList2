import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { Clapperboard, X, Edit3, Plus, Home, Search, Trash2, User } from 'lucide-react';

const STORAGE_KEY = 'cinelist_v1';

type TitleType = 'movie' | 'tv';

interface TitleItem {
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
}

function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0c] flex flex-col justify-end p-8 pb-16">
      <div className="absolute inset-0 bg-[#0a0a0c]">
         <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center" />
         <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/10 via-[#0a0a0c]/50 to-[#0a0a0c]" />
      </div>
      <div className="relative z-10 flex flex-col items-center text-center">
         <h1 className="font-bebas text-6xl text-white mb-4">Welcome<br/>to CineList</h1>
         <p className="text-white/60 mb-10 max-w-xs text-sm">Design your future watchlist and immerse yourself in the world of cinema.</p>
         <button onClick={onGetStarted} className="bg-white text-black px-12 py-4 rounded-full font-medium text-sm w-full max-w-sm hover:scale-105 transition-transform">
            Get Started
         </button>
      </div>
    </div>
  );
}

function TitleCard({ item, onClick }: { item: TitleItem; onClick: () => void }) {
  return (
    <motion.div
      className="w-full bg-[#16161a] rounded-[16px] sm:rounded-[24px] overflow-hidden shadow-2xl cursor-pointer border border-white/5 flex flex-col group transition-transform duration-300 hover:-translate-y-2 h-[260px] sm:h-[420px] md:h-[520px]"
      onClick={onClick}
    >
      {/* Top Image Section */}
      <div className="relative flex-1 w-full shrink-0">
        <div className="absolute top-3 sm:top-6 left-3 sm:left-6 z-10 text-white/90 text-[9px] sm:text-[13px] font-sans font-light tracking-wide drop-shadow-md">
           {item.rating ? `★ ${item.rating}` : 'Unrated'}
        </div>
        
        {item.poster ? (
          <img src={item.poster} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={item.title} />
        ) : (
          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#1e1e24] p-2 text-center">
              <Clapperboard className="w-5 h-5 sm:w-8 sm:h-8 text-white/10 mb-1 sm:mb-2" />
              <span className="text-white/30 text-[8px] sm:text-[10px] font-medium uppercase tracking-widest hidden sm:inline-block">Tap to Add Poster</span>
          </div>
        )}
        
        {/* Seamless Soft Fade Blend - tighter and lower */}
        <div className="absolute bottom-0 inset-x-0 h-16 sm:h-24 bg-gradient-to-t from-[#16161a] via-[#16161a]/80 to-transparent pointer-events-none" />
      </div>

      {/* Bottom Content Section */}
      <div className="flex flex-col px-4 sm:px-8 pb-4 sm:pb-8 pt-0 bg-[#16161a] relative z-10 shrink-0">
        <h2 className="text-[14px] sm:text-[26px] font-serif text-[#f2f2f2] mb-0.5 sm:mb-1 leading-tight sm:leading-snug line-clamp-2">
          {item.title}
        </h2>
        
        {item.year && (
          <p className="text-[#a0a0a5] text-[9px] sm:text-[13px] font-light mt-0.5 sm:mt-1 mb-2 sm:mb-4 line-clamp-1 sm:line-clamp-none">
            {item.year} <span className="hidden sm:inline-block">{item.genre && `• Let's explore your ${item.genre.toLowerCase()} reality.`}</span>
          </p>
        )}
        
        <div className="mt-auto flex justify-between items-center w-full text-[#a0a0a5] text-[8px] sm:text-[11px] tracking-wide pt-2 sm:pt-4 border-t border-white/5">
          <span className="lowercase opacity-80">cinelist</span>
          <span className="opacity-80 lowercase hidden sm:inline-block">{item.type === 'tv' ? 'tv + series' : 'web + film'}</span>
          <span className="opacity-80 lowercase sm:hidden">{item.type === 'tv' ? 'tv' : 'film'}</span>
        </div>
      </div>
    </motion.div>
  );
}

function DetailView({ item, onClose, onRemove, onUpdatePoster }: { item: TitleItem; onClose: () => void; onRemove: (id: number) => void; onUpdatePoster: (id: number, url: string) => void }) {
  const [isEditingPoster, setIsEditingPoster] = useState(false);
  const [tempPoster, setTempPoster] = useState(item.poster || '');

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
      className="fixed inset-0 z-[100] bg-[#0a0a0c] flex flex-col overflow-y-auto overflow-x-hidden p-0 m-0 w-full h-[100dvh] no-scrollbar"
    >
      <div className="absolute inset-0 w-full min-h-[100dvh]">
          {item.poster ? (
             <img src={item.poster} className="w-full h-full object-cover" alt={item.title} />
          ) : (
             <div className="w-full h-full bg-brand-dim flex flex-col items-center justify-center">
                 <Clapperboard size={64} className="text-white/10 mb-4" />
                 <span className="text-white/30 font-medium uppercase tracking-widest text-sm">No Poster Added</span>
             </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent" />
      </div>

      <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center z-10 hover:bg-white/20">
         <X size={20} />
      </button>

      <div className="relative z-10 mt-auto p-6 flex flex-col gap-4 pb-24">
         <div className="w-fit text-xs px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white tracking-widest uppercase">
            {item.type === 'tv' ? 'TV Series' : 'Movie'}
         </div>

         <h1 className="font-bebas text-5xl sm:text-7xl leading-none text-white drop-shadow-xl mt-2 mb-2 uppercase">
            {item.title}
         </h1>

         <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/70">
            {item.year && <span>{item.year}</span>}
            {item.rating && <span className="text-brand-accent">★ {item.rating}</span>}
            {item.genre && <span>{item.genre}</span>}
         </div>

         <p className="text-white/80 font-light text-sm sm:text-base leading-relaxed max-w-2xl mt-2">
            {item.synopsis || "No synopsis available."}
         </p>
         
         <div className="flex gap-3 mt-6 border-t border-white/10 pt-6">
            <button onClick={() => { onRemove(item.id); onClose(); }} className="flex gap-2 items-center bg-white/10 hover:bg-[#e05050]/20 hover:text-[#e05050] text-white/90 px-4 py-3 rounded-full text-xs font-medium tracking-wider uppercase transition-colors">
               <Trash2 size={16} /> Remove
            </button>
            <button onClick={() => setIsEditingPoster(true)} className="flex gap-2 items-center bg-white/10 hover:bg-white/20 text-white/90 px-4 py-3 rounded-full text-xs font-medium tracking-wider uppercase transition-colors">
               <Edit3 size={16} /> {item.poster ? 'Edit Poster' : 'Add Poster'}
            </button>
         </div>
      </div>
      
      <AnimatePresence>
        {isEditingPoster && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center p-6 z-20"
          >
              <div className="w-full max-w-sm bg-brand-surface border border-white/10 rounded-[24px] p-6 shadow-2xl flex flex-col gap-4">
                 <h3 className="font-bebas text-2xl text-white">Update Poster</h3>
                 <input value={tempPoster} onChange={e=>setTempPoster(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-brand-accent" placeholder="https://" />
                 
                 <div className="flex gap-2 mt-1">
                    <button onClick={() => setTempPoster('')} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg text-xs uppercase tracking-widest w-full">Remove Image</button>
                 </div>

                 <div className="flex gap-3 mt-2">
                    <button onClick={() => { onUpdatePoster(item.id, tempPoster); setIsEditingPoster(false); }} className="flex-1 bg-brand-accent text-black font-semibold rounded-lg py-3 text-sm">Save</button>
                    <button onClick={() => setIsEditingPoster(false)} className="flex-1 bg-white/10 text-white font-semibold rounded-lg py-3 text-sm hover:bg-white/20">Cancel</button>
                 </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function App() {
  const [items, setItems] = useState<TitleItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  const [manualData, setManualData] = useState<Partial<TitleItem>>({ type: 'movie' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addTitleAI = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setStatusText(`Searching for "${query}"…`);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find details for the movie or TV show: "${query}". Use the googleSearch tool to fetch accurate metadata. Return a raw JSON object only. Do NOT provide a poster URL.`,
        tools: [{ googleSearch: {} }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING, description: "'movie' or 'tv'" },
              year: { type: Type.STRING },
              director: { type: Type.STRING },
              genre: { type: Type.STRING, description: "e.g., Action" },
              rating: { type: Type.STRING, description: "e.g., 8.5/10" },
              cast: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of max 3 lead actors" },
              synopsis: { type: Type.STRING, description: "Short 1-sentence synopsis" },
            },
            required: ["title", "type", "year", "genre", "rating", "cast", "synopsis"]
          }
        }
      });

      const text = response.text || "{}";
      const info = JSON.parse(text);
      if (!info.title) throw new Error('Could not find that title.');

      if (items.find((i) => i.title.toLowerCase() === info.title.toLowerCase() && i.type === info.type)) {
        setStatusText(`"${info.title}" is already in your list.`);
        setTimeout(() => setStatusText(''), 3000);
        return;
      }

      const newItem: TitleItem = {
        id: Date.now(),
        title: info.title,
        type: info.type === 'tv' ? 'tv' : 'movie',
        year: info.year,
        director: info.director,
        genre: info.genre,
        rating: info.rating,
        cast: info.cast,
        synopsis: info.synopsis,
        poster: info.poster
      };

      setItems(prev => [newItem, ...prev]);
      setSearchQuery('');
      setShowSearch(false);
      setStatusText('');
    } catch (err: any) {
      setStatusText(err.message || 'Something went wrong. Try again.');
      setTimeout(() => setStatusText(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualData.title) return;
    
    if (items.find((i) => i.title.toLowerCase() === manualData.title!.toLowerCase() && i.type === manualData.type)) {
       return; // Already exists
    }

    const newItem: TitleItem = {
      id: Date.now(),
      title: manualData.title,
      type: (manualData.type as TitleType) || 'movie',
      year: manualData.year,
      poster: manualData.poster,
      genre: manualData.genre
    };

    setItems(prev => [newItem, ...prev]);
    setShowManual(false);
    setManualData({ type: 'movie' });
  };

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updatePoster = (id: number, url: string) => {
    setItems(items.map(i => i.id === id ? { ...i, poster: url } : i));
  };

  const selectedItem = items.find(i => i.id === selectedId);

  if (items.length === 0 && !showSearch && !showManual) {
    return <WelcomeScreen onGetStarted={() => setShowSearch(true)} />;
  }

  return (
    <div className="relative min-h-screen">
      <div className="bg-noise fixed inset-0"></div>

      {/* Top Header */}
      <div className="fixed top-0 inset-x-0 h-28 bg-gradient-to-b from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent z-40 pointer-events-none px-6 pt-10 flex justify-between items-start">
         <div className="w-10 h-10 rounded-full bg-brand-surface border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md pointer-events-auto">
            <User size={18} className="text-white/70" />
         </div>
         <div className="pointer-events-auto font-bebas text-lg tracking-widest text-brand-muted uppercase mt-2">
            Your CineList
         </div>
         <div className="w-10 h-10" />
      </div>

      {/* Main Content Area */}
      <main className="px-3 sm:px-6 pb-48 pt-24 sm:pt-32 min-h-screen relative w-full max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 lg:gap-8 no-scrollbar z-10 items-start">
         {items.map((item) => (
            <TitleCard key={item.id} item={item} onClick={() => setSelectedId(item.id)} />
         ))}
      </main>

      {/* Bottom Main Navigation Bar */}
      <div className="fixed bottom-8 inset-x-0 w-full flex justify-center z-40 pointer-events-none px-6">
         <div className="bg-brand-surface/90 backdrop-blur-xl border border-white/10 rounded-full p-2 flex gap-2 pointer-events-auto shadow-2xl">
            <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
               <Home size={20} />
            </button>
            <button onClick={() => setShowSearch(true)} className="p-4 rounded-full text-white hover:bg-white/10 transition-colors">
               <Search size={20} />
            </button>
            <button onClick={() => setShowManual(true)} className="p-4 rounded-full text-white hover:bg-white/10 transition-colors">
               <Plus size={20} />
            </button>
         </div>
      </div>

      {/* Detail View */}
      <AnimatePresence>
        {selectedItem && (
          <DetailView 
            key="detail-view"
            item={selectedItem} 
            onClose={() => setSelectedId(null)} 
            onRemove={removeItem}
            onUpdatePoster={updatePoster}
          />
        )}
      </AnimatePresence>

      {/* Search Sheet */}
      <AnimatePresence>
        {showSearch && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setShowSearch(false)} className="fixed inset-0 bg-[#0a0a0c]/80 backdrop-blur-sm z-[60]" />
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-[70] p-4 pt-24 pointer-events-none"
            >
               <div className="w-full max-w-lg mx-auto bg-brand-surface/95 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 pb-8 shadow-2xl pointer-events-auto flex flex-col gap-4">
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="font-bebas text-2xl text-white tracking-widest">Find a Title</h3>
                     <button onClick={() => setShowSearch(false)} className="text-white/50 hover:text-white bg-white/5 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <div className="flex flex-col gap-2 relative">
                     <input 
                        autoFocus
                        placeholder="Ask AI for a movie or TV show..." 
                        value={searchQuery}
                        onChange={e=>setSearchQuery(e.target.value)}
                        onKeyDown={e=>e.key==='Enter' && !isLoading && searchQuery && addTitleAI(searchQuery)}
                        className="w-full bg-[#0a0a0c]/80 border border-white/10 rounded-2xl py-4 px-5 text-white outline-none focus:border-brand-accent placeholder:text-white/30"
                     />
                     <button 
                        disabled={!searchQuery || isLoading}
                        onClick={() => addTitleAI(searchQuery)}
                        className="absolute right-2 top-2 bottom-2 bg-brand-accent text-black font-bebas px-6 rounded-xl hover:bg-[#f0d47e] disabled:opacity-50 tracking-wider text-xl flex items-center justify-center transition-colors"
                     >
                        {isLoading ? '...' : 'ADD'}
                     </button>
                  </div>
                  
                  {statusText && <div className="text-brand-accent text-xs pl-2">{statusText}</div>}
                  
                  <div className="flex items-center gap-4 my-2">
                     <div className="h-px bg-white/5 flex-1"></div>
                     <span className="text-white/20 text-[10px] font-medium uppercase tracking-widest">OR</span>
                     <div className="h-px bg-white/5 flex-1"></div>
                  </div>
                  
                  <button 
                     onClick={() => { setShowSearch(false); setShowManual(true); }}
                     className="w-full py-4 rounded-2xl border flex items-center justify-center gap-2 border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium uppercase tracking-widest"
                  >
                     <Plus size={16} /> Enter Details Manually
                  </button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Manual Entry Sheet */}
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[80] bg-[#0a0a0c] flex flex-col no-scrollbar border-t-[1px] border-white/10 overflow-y-auto"
          >
            <div className="flex justify-between items-center p-6 border-b border-white/10 mt-6 sm:mt-0">
              <h2 className="font-bebas text-3xl text-white tracking-widest">Manual Entry</h2>
              <button onClick={() => setShowManual(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleManualAdd} className="p-6 flex flex-col gap-8 max-w-lg mx-auto w-full mb-12">
               <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-widest text-white/50">Title</label>
                  <input required value={manualData.title || ''} onChange={e => setManualData({...manualData, title: e.target.value})} className="bg-transparent border-b border-white/20 pb-2 text-3xl font-bebas tracking-wide text-white outline-none focus:border-brand-accent transition-colors" placeholder="Enter title" autoFocus />
               </div>
               
               <div className="flex gap-6">
                 <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50">Type</label>
                    <select value={manualData.type} onChange={e => setManualData({...manualData, type: e.target.value as TitleType})} className="bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none appearance-none cursor-pointer">
                       <option value="movie" className="text-black">Movie</option>
                       <option value="tv" className="text-black">TV Series</option>
                    </select>
                 </div>
                 <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50">Year</label>
                    <input value={manualData.year || ''} onChange={e => setManualData({...manualData, year: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-accent transition-colors" placeholder="2024" />
                 </div>
               </div>

               <div className="flex flex-col gap-2">
                  <label className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50">Poster Image URL (Optional)</label>
                  <input value={manualData.poster || ''} onChange={e => setManualData({...manualData, poster: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-accent transition-colors text-sm" placeholder="https://" />
               </div>
               
               <div className="flex flex-col gap-2">
                  <label className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50">Genre (Optional)</label>
                  <input value={manualData.genre || ''} onChange={e => setManualData({...manualData, genre: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-accent transition-colors text-sm" placeholder="Action, Sci-Fi" />
               </div>

               <button type="submit" disabled={!manualData.title} className="mt-4 bg-brand-accent text-black py-5 rounded-2xl font-bebas text-2xl tracking-widest disabled:opacity-50 hover:bg-[#f0d47e] transition-colors">
                  SAVE TO WATCHLIST
               </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


