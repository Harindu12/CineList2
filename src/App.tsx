import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Clapperboard, X, Plus, Home, Search as SearchIcon, Trash2, User, List, Star, ImagePlus, Download, UploadCloud, Bookmark, BarChart2, ChevronLeft, CheckCircle2, PlayCircle, RefreshCw } from 'lucide-react';

import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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
  const [items, setItems] = useState<TitleItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [posterQuery, setPosterQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [filter, setFilter] = useState('All');
  const [activeView, setActiveView] = useState<'home' | 'stats'>('home');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const sub = onSnapshot(collection(db, 'titles'), (snapshot) => {
      const fbItems: TitleItem[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        fbItems.push({
          ...data,
          id: parseInt(doc.id, 10),
        } as TitleItem);
      });
      // Sort by creation time (id) descending
      fbItems.sort((a, b) => b.id - a.id);
      setItems(fbItems);
      setIsInitializing(false);
    });
    
    return () => sub();
  }, []);

  const handleAdd = async () => {
    if (!nameQuery.trim()) return;

    setIsLoading(true);
    setStatusText('Adding...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find details for the movie or TV show: "${nameQuery}". Return a raw JSON object only. Do NOT provide a poster URL. Provide the IMDb rating (e.g., 8.5/10) rather than the age rating.`,
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
      };
      
      if (posterQuery.trim()) {
        newItem.poster = posterQuery.trim();
      }

      await setDoc(doc(db, 'titles', id.toString()), newItem);
      
      setNameQuery('');
      setPosterQuery('');
      handleCloseAdd();
      setStatusText('');
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      alert("Could not fetch details. If deployed, ensure GEMINI_API_KEY is set in your environment variables and redeploy. Adding title with basic info instead.");
      
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
      
      await setDoc(doc(db, 'titles', id.toString()), newItem);
      
      setNameQuery('');
      setPosterQuery('');
      handleCloseAdd();
      setStatusText('');
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = async (id: number, updates: Partial<TitleItem>) => {
    await updateDoc(doc(db, 'titles', id.toString()), updates);
  };

  const removeItem = async (id: number) => {
    await deleteDoc(doc(db, 'titles', id.toString()));
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
            await setDoc(doc(db, 'titles', tempId.toString()), {
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

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // We'll process in chunks to avoid overwhelming the API
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Only sync if info is missing
      const needsUpdate = !item.cast || item.cast.length === 0 || !item.rating?.includes('/') || !item.synopsis || !item.director || !item.genre;
      
      if (needsUpdate) {
        setStatusText(`Syncing [${i+1}/${items.length}] ${item.title}...`);
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Find complete details for the movie/TV show: "${item.title}" (${item.year || ''}). Return a raw JSON object only. Provide the IMDb rating (e.g., 8.5/10) rather than the age rating.`,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.STRING },
                  director: { type: Type.STRING },
                  genre: { type: Type.STRING, description: "e.g., Action" },
                  rating: { type: Type.STRING, description: "e.g., 8.5/10" },
                  cast: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of max 3 lead actors" },
                  synopsis: { type: Type.STRING, description: "Short 1-sentence synopsis" },
                },
                required: ["year", "genre", "rating", "cast", "synopsis"]
              }
            }
          });
          
          const jsonText = response.text || "{}";
          const data = JSON.parse(jsonText);
          
          if (data.rating || data.synopsis || (data.cast && data.cast.length > 0)) {
            await updateDoc(doc(db, 'titles', item.id.toString()), {
              year: data.year || item.year,
              director: data.director || item.director || '',
              genre: data.genre || item.genre || '',
              rating: data.rating || item.rating || '',
              cast: data.cast && data.cast.length > 0 ? data.cast : item.cast || [],
              synopsis: data.synopsis || item.synopsis || ''
            });
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

  return (
    <div className="relative h-[100dvh] bg-[#f0ede8] w-full max-w-[430px] mx-auto overflow-hidden font-sans flex flex-col">
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />

      {/* HEADER - FLUSH WITH BACKGROUND */}
      <div className="flex-shrink-0 pt-8 transition-all pb-0">
        
        {/* TOP ROW: TITLE & SETTINGS/ACTIONS */}
        <div className="px-[24px] flex items-center justify-between mb-4">
          <div className="font-serif text-[32px] tracking-[-0.03em] leading-none text-[#1a1917] font-bold">
             Watch<em className="italic ml-[1px]">list</em>
          </div>
          {statusText && (
            <div className="absolute left-1/2 -translate-x-1/2 top-4 bg-[#1a1917]/10 px-3 py-1 rounded-full backdrop-blur-sm transition-all animate-pulse">
               <span className="text-[10px] font-bold text-[#1a1917] whitespace-nowrap">{statusText}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 p-1">
            <button 
               onClick={syncMetadata}
               disabled={isSyncing}
               className={`w-8 h-8 rounded-full bg-transparent flex items-center justify-center cursor-pointer hover:bg-black/5 active:scale-95 transition-all text-[#9b9890] ${isSyncing ? 'opacity-50' : ''}`}
               title="Refresh Missing Info"
            >
               <RefreshCw size={18} strokeWidth={2} className={isSyncing ? 'animate-spin' : ''} />
            </button>
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center cursor-pointer hover:bg-black/5 active:scale-95 transition-all text-[#9b9890]"
               title="Import Watchlist Data"
            >
               <UploadCloud size={18} strokeWidth={2} />
            </button>
            <button 
               onClick={handleExport}
               className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center cursor-pointer hover:bg-black/5 active:scale-95 transition-all text-[#9b9890]"
               title="Export Cloud Data"
            >
               <Download size={18} strokeWidth={2} />
            </button>
          </div>
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
            <div className="flex items-center px-[24px] pb-4 hidden-scrollbar overflow-x-auto relative z-10 w-full">
               <div className="flex items-center gap-2 w-full pr-4 relative">
                {['All', 'Watching', 'Plan to Watch', 'Completed'].map((f) => (
                  <button 
                    key={f} 
                    onClick={() => setFilter(f)} 
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
           <StackingList items={isInitializing ? null : filteredItems} isInitializing={isInitializing} onSelect={handleSelectId} />
        </div>
        
        {activeView === 'stats' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col overflow-y-auto no-scrollbar pb-[110px] px-[24px] pt-8 z-20 bg-[#e8e5df] rounded-t-[24px]"
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
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
                  className="bg-white/60 backdrop-blur-md rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-white/50 flex flex-col justify-between aspect-square col-span-1 hover:bg-white transition-colors duration-500 cursor-default"
               >
                  <div className="text-[11px] text-[#9b9890] font-bold tracking-[0.08em] uppercase">Library Size</div>
                  <div className="font-serif text-[72px] leading-[0.8] tracking-[-0.05em] text-[#1a1917] mt-4">{items.length}</div>
               </motion.div>

               {/* Card 2: Split */}
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 20 }}
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
                  transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
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
              transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
              className="fixed inset-x-0 bottom-0 z-[70] p-4 pt-16 pointer-events-none w-full max-w-[430px] mx-auto"
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

      {/* SMALL FLOATING BOTTOM BAR */}
      <div className="fixed bottom-[24px] left-1/2 -translate-x-1/2 bg-[#1a1917]/95 backdrop-blur-xl rounded-[28px] px-6 py-2.5 flex items-center justify-center gap-6 z-[50] shadow-[0_16px_40px_rgba(0,0,0,0.25)] border border-[#302e2a]">
        <button onClick={() => setActiveView('home')} className={`flex flex-col items-center justify-center gap-1 outline-none transition-all cursor-pointer min-w-[44px] ${activeView === 'home' ? 'text-white' : 'text-[#858279] hover:text-[#c4c1b9]'}`}>
           <Home size={20} strokeWidth={2.5} />
           <span className="text-[10px] font-bold tracking-wide leading-none">Home</span>
        </button>
        
        <button onClick={handleOpenAdd} className="w-[42px] h-[42px] bg-white rounded-full flex items-center justify-center text-[#1a1917] outline-none hover:scale-105 active:scale-95 transition-all shadow-[0_2px_12px_rgba(255,255,255,0.15)] cursor-pointer mx-1">
           <Plus size={22} strokeWidth={3} />
        </button>
        
        <button onClick={() => setActiveView('stats')} className={`flex flex-col items-center justify-center gap-1 outline-none transition-all cursor-pointer min-w-[44px] ${activeView === 'stats' ? 'text-white' : 'text-[#858279] hover:text-[#c4c1b9]'}`}>
           <BarChart2 size={20} strokeWidth={2.5} />
           <span className="text-[10px] font-bold tracking-wide leading-none">Stats</span>
        </button>
      </div>

    </div>
  );
}

// Sub-components

function StackingList({ items, isInitializing, onSelect }: { items: TitleItem[] | null, isInitializing: boolean, onSelect: (id: number) => void }) {
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
        <div ref={scrollerRef} className="flex-1 overflow-y-auto no-scrollbar px-[24px] pb-[110px] relative w-full pt-1">
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
        <div className="flex-1 overflow-y-auto no-scrollbar px-[24px] pb-[110px] w-full">
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
    <div ref={scrollerRef} className="flex-1 overflow-y-auto no-scrollbar px-[24px] pb-[110px] relative w-full pt-1">
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
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                        className="card-wrap-anchor relative pl-8"
                                      >
                                        <div className="card-wrap-sticky sticky pt-[10px]" style={{ top: 0, zIndex: globalIndex }}>
                                           <div className="card-inner relative" style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}>
                                              <ListCard item={subItem} index={globalIndex} onClick={() => onSelect(subItem.id)} />
                                           </div>
                                        </div>
                                      </motion.div>
                                   )
                                })}
                             </AnimatePresence>
                          </React.Fragment>
                       );
                    }
                    
                    return (
                       <motion.div 
                         key={item.id} 
                         layout="position"
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 130, opacity: 1 }}
                         exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                         transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                         className="card-wrap-anchor relative"
                       >
                         <div className="card-wrap-sticky sticky pt-[10px]" style={{ top: 0, zIndex: globalIndex }}>
                            <div className="card-inner relative" style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}>
                               <div className="animate-list-item" style={{ animationDelay: `${Math.min(globalIndex, 15) * 0.03 + 0.02}s` }}>
                                  <ListCard item={item} index={globalIndex} onClick={() => onSelect(item.id)} />
                               </div>
                            </div>
                         </div>
                       </motion.div>
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

function ListCard({ item, index, onClick }: { item: TitleItem, index: number, onClick: () => void, key?: any }) {
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
    if (!cardRef.current) return;
    const thresh = cardRef.current.offsetWidth * 0.35;
    const velocity = info.velocity.x;
    
    // Check if we passed the threshold or flicked it hard enough
    if (info.offset.x > thresh || (info.offset.x > 50 && velocity > 600)) {
      setRemovedDir('right');
      setTimeout(async () => {
        if (item.status === 'completed') {
          await updateDoc(doc(db, 'titles', item.id.toString()), { status: 'plan' });
        } else {
          await updateDoc(doc(db, 'titles', item.id.toString()), { status: 'completed' });
        }
      }, 300);
    } else if (info.offset.x < -thresh || (info.offset.x < -50 && velocity < -600)) {
      setRemovedDir('left');
      setTimeout(async () => {
        await deleteDoc(doc(db, 'titles', item.id.toString()));
      }, 300);
    }
  };

  return (
    <div ref={cardRef} className="relative w-full rounded-[16px] overflow-hidden bg-[#e0ddd6]">
      {/* Background reveals */}
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

      <motion.div 
         drag={removedDir ? false : "x"}
         dragConstraints={{ left: 0, right: 0 }}
         dragElastic={0.8}
         style={{ x }}
         onDragStart={() => setIsDragging(true)}
         onDragEnd={handleDragEnd}
         animate={removedDir === 'right' ? { x: 500, opacity: 0 } : removedDir === 'left' ? { x: -500, opacity: 0 } : { x: 0, opacity: 1 }}
         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
         onClick={onClick} 
         className="relative flex items-center gap-[12px] p-[8px_16px_8px_8px] w-full bg-white group active:bg-black/5 hover:bg-black/[0.02] hover:shadow-[0_8px_16px_rgba(0,0,0,0.06)] transition-all duration-300 ease-out origin-center cursor-pointer border border-[#e0ddd6]/50 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      >
        <div className="w-[70px] h-[105px] rounded-[10px] bg-[#e0dbd4] shrink-0 flex items-center justify-center text-xl overflow-hidden border border-[#e0ddd6] group-hover:-translate-y-1 group-active:-translate-y-0.5 group-hover:shadow-md transition-all duration-400 ease-out pointer-events-none">
          {item.poster ? <img src={item.poster} className="w-full h-full object-cover" /> : (item.type === 'movie' ? '🍿' : '📺')}
       </div>
       
       <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
         <div className="text-[15px] leading-[1.25] font-semibold mb-1.5 text-[#1a1917] tracking-[-0.01em] line-clamp-2 pr-2">{item.title}</div>
         
         <div className="flex flex-col gap-1">
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
         </div>
       </div>

       <div className="flex shrink-0 ml-1 transition-all p-2 active:scale-90" onClick={(e) => {
          e.stopPropagation();
       }}>
          {item.status === 'completed' ? (
             <CheckCircle2 size={18} strokeWidth={2.5} className="text-[#388e3c] opacity-80" />
          ) : item.status === 'watching' ? (
             <PlayCircle size={18} strokeWidth={2.5} className="text-[#6a1bdb] opacity-80" />
          ) : (
             <Bookmark size={18} strokeWidth={2.5} className="text-[#d4840a] opacity-80" />
          )}
       </div>
     </motion.div>
    </div>
  )
}

function ItemDetailView({ item, onClose, onUpdate, onRemove }: { item: TitleItem; onClose: () => void; onUpdate: (updates: Partial<TitleItem>) => void; onRemove: (id: number) => void; key?: any; }) {
  const [isEditingPoster, setIsEditingPoster] = useState(false);
  const [tempPoster, setTempPoster] = useState(item.poster || '');

  return (
    <motion.div initial={{y:"100%", opacity: 0.8 }} animate={{y:0, opacity: 1 }} exit={{y:"100%", opacity: 0 }} transition={{type: "spring", damping: 28, stiffness: 200, mass: 0.8}} className="fixed inset-0 z-50 bg-brand-bg flex flex-col overflow-y-auto no-scrollbar w-full max-w-[430px] mx-auto overflow-x-hidden">
      
      {/* FULL WIDTH POSTER HERO */}
      <div className="relative w-full min-h-[60vh] shrink-0 bg-[#e0dbd4] flex flex-col justify-end">
        <div className="absolute inset-0">
          {item.poster ? (
             <img src={item.poster} className="w-full h-full object-cover object-top" />
          ) : (
             <div className="w-full h-full flex flex-col items-center justify-center border-b border-brand-border text-[64px]">
               {item.type === 'movie' ? '🎬' : '📺'}
               <span className="text-brand-sub uppercase tracking-[1px] text-[10px] font-semibold mt-2">No Poster</span>
             </div>
          )}
        </div>

        {/* Tall Gradient Overlay for legibility & seamless transition */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,#f0ede8_0%,#f0ede8_15%,rgba(240,237,232,0.85)_30%,rgba(240,237,232,0.4)_50%,transparent_85%)] pointer-events-none" />

        {/* Top Actions: Back / Edit */}
        <button onClick={onClose} className="absolute top-6 left-5 w-9 h-9 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10 z-20 cursor-pointer shadow-sm hover:bg-black/30 active:scale-95 transition-all">
           <ChevronLeft size={20} strokeWidth={2.5} className="-ml-0.5" />
        </button>
        <button onClick={() => setIsEditingPoster(true)} className="absolute top-6 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10 z-20 cursor-pointer shadow-sm hover:bg-black/30 active:scale-95 transition-all">
           <ImagePlus size={16} />
        </button>

        {/* Hero Content Overlay */}
        <div className="relative z-10 px-6 pb-6 w-full flex flex-col items-center text-center">
            
            <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
               <span className="text-[11px] font-bold tracking-[0.08em] text-[#9b9890] uppercase leading-none">{item.type}</span>
               {item.year && <span className="text-[11px] font-bold tracking-[0.08em] text-[#b8b5ad] leading-none">•</span>}
               {item.year && <span className="text-[11px] font-bold tracking-[0.08em] text-[#9b9890] uppercase leading-none">{item.year}</span>}
            </div>

            <h1 className="font-serif text-[48px] sm:text-[56px] leading-[0.95] text-[#1a1917] mb-5 tracking-[-0.03em] line-clamp-3">{item.title}</h1>
            
            <div className="flex gap-2 flex-wrap justify-center items-center">
               {item.rating && (
                  <span className="text-[11px] font-bold px-3 py-1.5 rounded-[12px] bg-white/40 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[#1a1917] border border-white/40 flex items-center gap-1">
                     <Star size={12} className="fill-[#e8a020] text-[#e8a020]" /> IMDb {item.rating}
                  </span>
               )}
               {item.genre && item.genre.split(',').map(g => g.trim()).map(g => (
                  <span key={g} className="text-[11px] font-bold px-3 py-1.5 rounded-[12px] bg-white/40 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[#1a1917] border border-white/40">
                     {g}
                  </span>
               ))}
            </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 bg-brand-bg px-6 pt-4 pb-32 flex flex-col">
        <p className="text-[14px] text-[#9b9890] font-sans leading-[1.6] mb-8">{item.synopsis || "No synopsis available for this title."}</p>

        {/* Cast & Crew Headers */}
        <div className="flex flex-col gap-5 mb-8 bg-white border border-[#e0ddd6] rounded-[20px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
           <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-[0.08em] text-[#b8b5ad] uppercase">Director</span>
              <span className="text-[14px] font-medium text-[#1a1917]">{item.director || 'N/A'}</span>
           </div>
           
           <div className="h-[1px] w-full bg-[#e0ddd6]/50" />
           
           <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.08em] text-[#b8b5ad] uppercase">Cast</span>
              {item.cast && item.cast.length > 0 ? (
                 <div className="flex flex-wrap gap-2 mt-1">
                    {item.cast.map(actor => (
                       <span key={actor} className="text-[13px] font-medium text-[#1a1917] bg-[#f0ede8] px-3 py-1.5 rounded-[8px] border border-[#d0cac3]/50">
                          {actor}
                       </span>
                    ))}
                 </div>
              ) : (
                 <span className="text-[14px] font-medium text-[#1a1917]">N/A</span>
              )}
           </div>
        </div>

        {/* Status Actions */}
        <div className="flex flex-col gap-2 bg-white rounded-[16px] p-1.5 border border-[#e0ddd6] shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-6">
           <div className="flex gap-1 w-full">
              <button 
                onClick={() => onUpdate({status: 'plan'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-semibold transition-all duration-300 ease-out active:scale-[0.96] cursor-pointer w-full ${item.status === 'plan' || !item.status ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5 hover:text-[#1a1917]'}`}
              >
                Plan to Watch
              </button>
              <button 
                onClick={() => onUpdate({status: 'watching'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-semibold transition-all duration-300 ease-out active:scale-[0.96] cursor-pointer w-full ${item.status === 'watching' ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5 hover:text-[#1a1917]'}`}
              >
                Watching
              </button>
              <button 
                onClick={() => onUpdate({status: 'completed'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-semibold transition-all duration-300 ease-out active:scale-[0.96] cursor-pointer w-full ${item.status === 'completed' ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5 hover:text-[#1a1917]'}`}
              >
                Completed
              </button>
           </div>
        </div>

        <button onClick={() => { onRemove(item.id); onClose(); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[#d32f2f] hover:bg-[#d32f2f]/10 active:scale-[0.98] transition-all duration-300 ease-out mt-auto font-medium text-[13px] cursor-pointer">
           <Trash2 size={16} /> Delete Title
        </button>
      </div>

      <AnimatePresence>
        {isEditingPoster && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
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
    <div className="flex items-center gap-[12px] p-[8px_16px_8px_8px] w-full animate-pulse bg-white rounded-[16px] border border-[#e0ddd6]/50 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
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
