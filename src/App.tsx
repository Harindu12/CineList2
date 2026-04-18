import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { Clapperboard, X, Plus, Home, Search as SearchIcon, Trash2, User, List, Star, ImagePlus } from 'lucide-react';

const STORAGE_KEY = 'cinelist_v1';

type TitleType = 'movie' | 'tv';
type TitleStatus = 'watching' | 'plan' | 'completed';

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
  status?: TitleStatus;
  progress?: number;
}

export default function App() {
  const [items, setItems] = useState<TitleItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [posterQuery, setPosterQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [filter, setFilter] = useState('All');
  const [activeNav, setActiveNav] = useState('Home');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const handleAdd = async () => {
    if (!nameQuery.trim()) return;

    setIsLoading(true);
    setStatusText('Adding...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find details for the movie or TV show: "${nameQuery}". Use the googleSearch tool to fetch accurate metadata. Return a raw JSON object only. Do NOT provide a poster URL.`,
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
      const title = info.title || nameQuery;

      if (items.some((i) => i.title.toLowerCase() === title.toLowerCase())) {
        setStatusText('Already in list.');
        setIsLoading(false);
        setTimeout(() => setStatusText(''), 3000);
        return;
      }

      const newItem: TitleItem = {
        id: Date.now(),
        title: title,
        type: info.type === 'tv' ? 'tv' : 'movie',
        year: info.year,
        director: info.director,
        genre: info.genre,
        rating: info.rating,
        cast: info.cast,
        synopsis: info.synopsis,
        status: 'plan',
        progress: 0,
        poster: posterQuery.trim() || undefined
      };

      setItems(prev => [newItem, ...prev]);
      setNameQuery('');
      setPosterQuery('');
      setShowAdd(false);
      setStatusText('');
    } catch (err: any) {
      if (items.some((i) => i.title.toLowerCase() === nameQuery.trim().toLowerCase())) {
        setStatusText('Already in list.');
        setIsLoading(false);
        setTimeout(() => setStatusText(''), 3000);
        return;
      }

      const newItem: TitleItem = {
        id: Date.now(),
        title: nameQuery,
        type: 'movie',
        status: 'plan',
        progress: 0,
        poster: posterQuery.trim() || undefined
      };
      setItems(prev => [newItem, ...prev]);
      setNameQuery('');
      setPosterQuery('');
      setShowAdd(false);
      setStatusText('');
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = (id: number, updates: Partial<TitleItem>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  // Filtering
  const filteredItems = useMemo(() => {
     let filtered = items;
     if (filter === 'Watching') filtered = items.filter(i => i.status === 'watching');
     else if (filter === 'Plan to Watch') filtered = items.filter(i => i.status === 'plan' || !i.status);
     else if (filter === 'Completed') filtered = items.filter(i => i.status === 'completed');
     else if (filter === 'Movies') filtered = items.filter(i => i.type === 'movie');
     else if (filter === 'Series') filtered = items.filter(i => i.type === 'tv');
     return filtered;
  }, [items, filter]);

  const recentlyAdded = [...items].sort((a, b) => b.id - a.id).slice(0, 5);
  const watchingItems = items.filter(i => i.status === 'watching');
  const planItems = items.filter(i => i.status === 'plan' || !i.status);
  const completedItems = items.filter(i => i.status === 'completed');

  const selectedItem = items.find(i => i.id === selectedId);

  return (
    <div className="relative min-h-screen bg-brand-bg w-full max-w-[430px] mx-auto pb-24 overflow-x-hidden font-sans no-scrollbar">
      
      {/* HEADER */}
      <div className="pt-[58px] px-6 flex items-start justify-between">
        <div className="font-serif text-[28px] tracking-[-0.5px] leading-none text-brand-text">
           Watch<em className="italic text-brand-sub ml-0.5">list</em>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="pt-[18px] px-6 text-[13px] text-brand-sub tracking-[0.1px]">
        {items.length} titles &nbsp;·&nbsp; {watchingItems.length} watching &nbsp;·&nbsp; {completedItems.length} completed
      </div>

      {/* SEARCH OR ADD PREVIEW */}
      <div className="pt-[20px] px-6">
        <div 
          className="bg-brand-white border border-brand-border rounded-xl flex items-center gap-2.5 px-3.5 py-[11px] cursor-text focus-within:border-[#c5c2bb] transition-colors" 
          onClick={() => setShowAdd(true)}
        >
          <SearchIcon size={14} className="text-brand-sub shrink-0" strokeWidth={2} />
          <span className="text-brand-sub text-[14px] w-full text-left">Search or Add titles…</span>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-0 pt-[22px] px-6 border-b border-brand-border overflow-x-auto no-scrollbar m-0">
        {['All', 'Watching', 'Plan to Watch', 'Completed', 'Movies', 'Series'].map((f) => (
          <div 
            key={f} 
            onClick={() => setFilter(f)} 
            className={`text-[13px] font-medium pb-3 mr-6 cursor-pointer border-b-[1.5px] whitespace-nowrap shrink-0 transition-colors ${filter === f ? 'text-brand-text border-brand-text' : 'text-brand-sub border-transparent'}`}
          >
            {f}
          </div>
        ))}
      </div>

      {/* LIST CONTENT */}
      {filter !== 'All' ? (
         // Filtered View
         <div className="animate-in fade-in duration-300 pb-10">
            <div className="pt-6 px-6 pb-2.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#b0a89e]">{filter}</div>
            <div className="px-6 flex flex-col gap-2">
              {filteredItems.map((item, i) => (
                 <ListCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />
              ))}
              {filteredItems.length === 0 && <div className="text-center py-10 text-brand-sub text-sm">No titles found.</div>}
            </div>
         </div>
      ) : (
         // Main All View
         <div className="animate-in fade-in duration-300 pb-10">
            {recentlyAdded.length > 0 && (
              <>
                <div className="pt-6 px-6 pb-2.5 text-[11px] font-medium tracking-[1px] uppercase text-brand-sub">Recently added</div>
                <div className="flex gap-3 px-6 overflow-x-auto no-scrollbar">
                  {recentlyAdded.map((item, i) => (
                    <PosterCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />
                  ))}
                </div>
                <div className="h-px bg-brand-border mx-6 mt-5" />
              </>
            )}

            {watchingItems.length > 0 && (
               <>
                 <div className="pt-5 px-6 pb-2.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#b0a89e]">Watching now</div>
                 <div className="px-6 flex flex-col gap-2">
                   {watchingItems.map((item, i) => <ListCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />)}
                 </div>
                 <div className="h-4" />
               </>
            )}

            {planItems.length > 0 && (
               <>
                 <div className="pt-5 px-6 pb-2.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#b0a89e]">Plan to watch</div>
                 <div className="px-6 flex flex-col gap-2">
                   {planItems.map((item, i) => <ListCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />)}
                 </div>
                 <div className="h-4" />
               </>
            )}

            {completedItems.length > 0 && (
               <>
                 <div className="pt-5 px-6 pb-2.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#b0a89e]">Completed</div>
                 <div className="px-6 flex flex-col gap-2">
                   {completedItems.map((item, i) => <ListCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />)}
                 </div>
                 <div className="h-4" />
               </>
            )}

            {items.length === 0 && (
               <div className="px-8 py-16 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-brand-white rounded-full border border-brand-border flex items-center justify-center mb-4 text-brand-sub">
                    <List size={24} />
                  </div>
                  <h3 className="text-xl font-serif text-brand-text mb-2 tracking-[-0.5px]">Your list is empty</h3>
                  <p className="text-brand-sub text-[13px] max-w-[240px]">Tap the plus icon above or use the search bar to add titles.</p>
               </div>
            )}
         </div>
      )}

      <div className="h-[110px]" />

      {/* FLOATING BOTTOM BAR */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand-nav-bg rounded-[22px] flex items-center justify-center p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.22),_0_2px_8px_rgba(0,0,0,0.12)] z-40 backdrop-blur-[20px] animate-[fadeUp_0.5s_cubic-bezier(0.22,1,0.36,1)_0.1s_both]">
        
        <div className="flex items-center gap-1">
           <div 
             onClick={() => setActiveNav('Home')} 
             className={`w-[56px] h-[52px] flex flex-col items-center justify-center gap-1 rounded-[16px] cursor-pointer transition-colors active:bg-white/5 ${activeNav === 'Home' ? 'text-brand-nav-text' : 'text-brand-nav-muted hover:bg-white/5'}`}
           >
             <Home className="w-[22px] h-[22px] transition-all" strokeWidth={activeNav === 'Home' ? 2.1 : 1.7} />
             <span className="text-[10px] font-medium tracking-[0.2px] leading-none">Home</span>
           </div>
           
           <div 
             className="w-[56px] h-[52px] flex items-center justify-center cursor-pointer active:opacity-70 active:scale-95 transition-all" 
             onClick={() => setShowAdd(true)}
           >
             <div className="w-[46px] h-[46px] rounded-[14px] bg-brand-nav-text flex items-center justify-center">
               <Plus className="w-5 h-5 text-brand-nav-bg" strokeWidth={2.2} />
             </div>
           </div>
        </div>
      </div>

      {/* ITEM DETAIL VIEW */}
      <AnimatePresence>
        {selectedItem && (
           <ItemDetailView 
              key="detail-view"
              item={selectedItem} 
              onClose={() => setSelectedId(null)}
              onUpdate={(updates) => updateItem(selectedItem.id, updates)}
              onRemove={removeItem}
           />
        )}
      </AnimatePresence>

      {/* ADD OVERLAY */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => !isLoading && setShowAdd(false)} className="fixed inset-0 bg-brand-bg/80 backdrop-blur-sm z-[60] w-full max-w-[430px] mx-auto" />
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-[70] p-4 pt-16 pointer-events-none w-full max-w-[430px] mx-auto"
            >
               <div className="w-full bg-brand-white border border-brand-border rounded-[24px] p-6 pb-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] pointer-events-auto flex flex-col gap-4">
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="font-serif text-3xl text-brand-text tracking-[-0.5px]">Add title</h3>
                     <button onClick={() => !isLoading && setShowAdd(false)} className="text-brand-sub hover:bg-brand-surface active:bg-brand-surface cursor-pointer p-2 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="flex flex-col gap-3 relative">
                     <input 
                        autoFocus
                        placeholder="Movie or series name..." 
                        value={nameQuery}
                        onChange={e=>setNameQuery(e.target.value)}
                        onKeyDown={e=>e.key==='Enter' && !isLoading && nameQuery && handleAdd()}
                        className="w-full bg-brand-bg border border-brand-border rounded-xl py-3.5 px-4 text-brand-text outline-none focus:border-[#c5c2bb] placeholder:text-brand-sub text-[14px]"
                     />
                     <input 
                        placeholder="Image URL (optional)" 
                        value={posterQuery}
                        onChange={e=>setPosterQuery(e.target.value)}
                        onKeyDown={e=>e.key==='Enter' && !isLoading && nameQuery && handleAdd()}
                        className="w-full bg-brand-bg border border-brand-border rounded-xl py-3.5 px-4 text-brand-text outline-none focus:border-[#c5c2bb] placeholder:text-brand-sub text-[14px]"
                     />
                     
                     {statusText && <div className="text-brand-sub text-[13px]">{statusText}</div>}

                     <button 
                        disabled={!nameQuery || isLoading}
                        onClick={handleAdd}
                        className="w-full mt-2 bg-brand-accent text-brand-white font-medium py-3.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-[14px] flex items-center justify-center cursor-pointer transition-opacity"
                     >
                        {isLoading ? 'Adding...' : 'Add to watchlist'}
                     </button>
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components

function PosterCard({ item, index, onClick }: { item: TitleItem, index: number, onClick: () => void }) {
  return (
     <div 
       onClick={onClick} 
       className="shrink-0 w-[110px] cursor-pointer active:opacity-70 transition-opacity animate-[fadeUp_0.35s_ease_both]"
       style={{ animationDelay: `${index * 0.05 + 0.05}s` }}
     >
        <div className="w-[110px] h-[155px] rounded-[10px] bg-brand-surface border border-brand-border flex items-center justify-center text-[36px] mb-2 overflow-hidden shadow-sm">
          {item.poster ? <img src={item.poster} className="w-full h-full object-cover" /> : (item.type === 'movie' ? '🎬' : '📺')}
        </div>
        <div className="text-[12px] font-medium text-brand-text break-words line-clamp-1 whitespace-nowrap overflow-hidden text-ellipsis mb-0.5">{item.title}</div>
        <div className="text-[11px] text-brand-sub">{item.year || 'Unknown'} · {item.type === 'movie' ? 'Movie' : 'Series'}</div>
     </div>
  );
}

function ListCard({ item, index, onClick }: { item: TitleItem, index: number, onClick: () => void }) {
  const isWatching = item.status === 'watching';
  const isCompleted = item.status === 'completed';
  
  return (
    <div 
       onClick={onClick} 
       className="bg-white rounded-[14px] flex items-center gap-3 p-[10px_14px_10px_10px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] hover:-translate-y-[1px] cursor-pointer transition-all animate-[fadeUp_0.3s_ease_both]"
       style={{ animationDelay: `${index * 0.04 + 0.04}s` }}
    >
       <div className="w-[48px] h-[64px] rounded-[8px] bg-[#e0dbd4] shrink-0 flex items-center justify-center text-xl overflow-hidden">
          {item.poster ? <img src={item.poster} className="w-full h-full object-cover" /> : (item.type === 'movie' ? '🍿' : '📺')}
       </div>
       
       <div className="flex-1 min-w-0 flex flex-col justify-center">
         <div className="text-[14px] font-semibold mb-[3px] truncate text-[#1a1714] tracking-[-0.01em]">{item.title}</div>
         <div className="text-[11px] text-[#a09890] flex items-center gap-[5px] truncate mt-0.5">
            <span className="text-[10px] font-medium text-[#7a7068] bg-[#f0ede8] rounded-[4px] px-[6px] py-[1px]">{item.type === 'movie' ? 'Movie' : 'Series'}</span>
            <div className="w-[3px] h-[3px] rounded-full bg-[#c8c0b8] shrink-0" />
            <span className="truncate">{item.year || 'Unknown'}</span>
            {item.genre && (
              <>
                 <div className="w-[3px] h-[3px] rounded-full bg-[#c8c0b8] shrink-0" />
                 <span className="truncate">{item.genre.split(',')[0].trim()}</span>
              </>
            )}
         </div>
       </div>

       <div className="flex shrink-0">
         {isWatching ? (
            <button className="text-[11px] font-semibold tracking-[0.01em] px-3 py-[5px] rounded-[20px] bg-[#e6f4ea] text-[#2e7d32] border-none cursor-pointer">Watching</button>
         ) : isCompleted ? (
            <button className="text-[11px] font-semibold tracking-[0.01em] px-3 py-[5px] rounded-[20px] bg-[#ede7f6] text-[#6a1bdb] border-none cursor-pointer">Done</button>
         ) : (
            <button className="text-[11px] font-semibold tracking-[0.01em] px-3 py-[5px] rounded-[20px] bg-[#fef3e2] text-[#d4840a] hover:bg-[#fde6b8] transition-colors border-none cursor-pointer">Plan</button>
         )}
       </div>
    </div>
  )
}

function ItemDetailView({ item, onClose, onUpdate, onRemove }: { item: TitleItem; onClose: () => void; onUpdate: (updates: Partial<TitleItem>) => void; onRemove: (id: number) => void; }) {
  const [isEditingPoster, setIsEditingPoster] = useState(false);
  const [tempPoster, setTempPoster] = useState(item.poster || '');

  return (
    <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type: "spring", damping: 25, stiffness: 220}} className="fixed inset-0 z-50 bg-brand-bg flex flex-col overflow-y-auto no-scrollbar w-full max-w-[430px] mx-auto overflow-x-hidden">
      
      <div className="relative w-full aspect-[3/4] max-h-[45vh] shrink-0 bg-brand-surface shadow-sm">
        {item.poster ? (
           <img src={item.poster} className="w-full h-full object-cover" />
        ) : (
           <div className="w-full h-full flex flex-col items-center justify-center border-b border-brand-border text-[64px]">
             {item.type === 'movie' ? '🎬' : '📺'}
             <span className="text-brand-sub uppercase tracking-[1px] text-[10px] font-semibold mt-2">No Poster</span>
           </div>
        )}

        <button onClick={onClose} className="absolute top-6 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white border border-white/10 z-10 cursor-pointer shadow-sm hover:bg-black/50 active:scale-95 transition-all">
           <X size={18} />
        </button>
        <button onClick={() => setIsEditingPoster(true)} className="absolute top-6 left-5 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white border border-white/10 z-10 cursor-pointer shadow-sm hover:bg-black/50 active:scale-95 transition-all">
           <ImagePlus size={16} />
        </button>
      </div>

      <div className="relative z-10 flex-1 bg-brand-bg rounded-t-[20px] -mt-5 px-6 pt-8 pb-32 flex flex-col shadow-[0_-4px_16px_rgba(0,0,0,0.05)] border-t border-brand-border">
        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
           <span className="text-[11px] font-medium text-brand-sub border border-brand-border px-2 py-0.5 rounded-md bg-brand-white">{item.type === 'movie' ? 'Movie' : 'Series'}</span>
           {item.year && <span className="text-[12px] text-brand-sub">{item.year}</span>}
           {item.rating && <span className="text-[12px] font-medium text-brand-text flex items-center gap-1 ml-auto"><Star size={12} className="fill-[#f57f17] stroke-none" /> {item.rating}</span>}
        </div>

        <h1 className="font-serif text-[42px] leading-[0.95] text-brand-text mb-4 tracking-[-0.5px]">{item.title}</h1>
        
        {item.genre && (
          <div className="flex gap-1.5 flex-wrap mb-5">
             {item.genre.split(',').map(g => g.trim()).map(g => (
                <span key={g} className="text-[11px] font-medium px-2 py-1 rounded-[6px] bg-brand-surface text-brand-sub border border-brand-border/50">{g}</span>
             ))}
          </div>
        )}

        <p className="text-[14px] text-brand-sub font-sans leading-[1.6] mb-8">{item.synopsis || "No synopsis available for this title."}</p>

        {/* Status Actions */}
        <div className="flex flex-col gap-2 bg-brand-white rounded-[16px] p-1.5 border border-brand-border shadow-sm mb-6">
           <div className="flex gap-1 w-full">
              <button 
                onClick={() => onUpdate({status: 'plan'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-medium transition-colors cursor-pointer w-full ${item.status === 'plan' || !item.status ? 'bg-[#fff8e1] text-[#f57f17] shadow-sm' : 'text-brand-sub hover:bg-brand-surface'}`}
              >
                Plan
              </button>
              <button 
                onClick={() => onUpdate({status: 'watching'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-medium transition-colors cursor-pointer w-full ${item.status === 'watching' ? 'bg-[#e8f5e9] text-[#2e7d32] shadow-sm' : 'text-brand-sub hover:bg-brand-surface'}`}
              >
                Watching
              </button>
              <button 
                onClick={() => onUpdate({status: 'completed'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-medium transition-colors cursor-pointer w-full ${item.status === 'completed' ? 'bg-brand-surface text-brand-text shadow-sm' : 'text-brand-sub hover:bg-brand-surface'}`}
              >
                Done
              </button>
           </div>
           
           {item.status === 'watching' && (
             <motion.div initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} className="px-3 pt-2 pb-1.5 flex items-center gap-4">
               <span className="text-[11px] font-medium text-brand-sub w-14">Progress</span>
               <input type="range" min="0" max="100" value={item.progress || 0} onChange={e => onUpdate({progress: parseInt(e.target.value)})} className="flex-1 accent-[#1a1917] h-[3px] bg-brand-surface rounded-full outline-none cursor-pointer" />
               <span className="text-[12px] font-medium text-brand-text w-8 text-right font-sans">{item.progress || 0}%</span>
             </motion.div>
           )}
        </div>

        <button onClick={() => { onRemove(item.id); onClose(); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[#d32f2f] hover:bg-[#d32f2f]/10 transition-colors mt-auto font-medium text-[13px] cursor-pointer">
           <Trash2 size={16} /> Delete Title
        </button>
      </div>

      <AnimatePresence>
        {isEditingPoster && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#1a1917]/40 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 text-center"
          >
              <div className="w-full bg-brand-white border border-brand-border rounded-[20px] p-6 shadow-xl flex flex-col gap-4 text-left">
                 <h3 className="font-serif text-[28px] leading-none text-brand-text tracking-[-0.5px]">Edit poster</h3>
                 <input value={tempPoster} onChange={e=>setTempPoster(e.target.value)} className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-brand-text text-[14px] font-sans outline-none focus:border-[#c5c2bb] placeholder:text-brand-sub" placeholder="https:// images..." />
                 
                 <div className="flex gap-2">
                    <button onClick={() => { onUpdate({poster: tempPoster}); setIsEditingPoster(false); }} className="flex-1 bg-brand-accent text-brand-white font-medium rounded-xl py-3 text-[14px] active:scale-95 transition-transform cursor-pointer">Save changes</button>
                    <button onClick={() => setIsEditingPoster(false)} className="bg-brand-surface text-brand-text font-medium rounded-xl px-5 py-3 text-[14px] active:scale-95 transition-transform cursor-pointer">Cancel</button>
                 </div>
                 
                 {item.poster && (
                   <button onClick={() => { setTempPoster(''); onUpdate({poster: ''}); setIsEditingPoster(false); }} className="mt-1 text-[13px] text-[#d32f2f] py-2 border border-[#d32f2f]/20 hover:bg-[#d32f2f]/5 rounded-lg font-medium cursor-pointer transition-colors w-full">Remove Poster image</button>
                 )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
