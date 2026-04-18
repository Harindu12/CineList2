import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { Clapperboard, X, Plus, Home, Search as SearchIcon, Trash2, User, List, Star, ImagePlus, Download, UploadCloud, Bookmark, BarChart2 } from 'lucide-react';

import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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
  const [items, setItems] = useState<TitleItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [posterQuery, setPosterQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [filter, setFilter] = useState('All');
  const [activeView, setActiveView] = useState<'home' | 'stats'>('home');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setShowAdd(false);
      setStatusText('');
    } catch (err: any) {
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
      setShowAdd(false);
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
     return filtered;
  }, [items, filter]);

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

  const recentlyAdded = [...items].sort((a, b) => b.id - a.id).slice(0, 5);
  const watchingItems = items.filter(i => i.status === 'watching');
  const planItems = items.filter(i => i.status === 'plan' || !i.status);
  const completedItems = items.filter(i => i.status === 'completed');

  const selectedItem = items.find(i => i.id === selectedId);

  return (
    <div className="relative min-h-screen bg-brand-bg w-full max-w-[430px] mx-auto pb-24 overflow-clip font-sans no-scrollbar">
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />

      {/* HEADER - FLUSH WITH BACKGROUND */}
      <div className="sticky top-0 z-40 bg-[#f0ede8]/95 backdrop-blur-xl pt-[52px] transition-all pb-0">
        
        {/* TOP ROW: TITLE & SETTINGS/ACTIONS */}
        <div className="px-[24px] flex items-center justify-between mb-4">
          <div className="font-serif text-[32px] tracking-[-0.03em] leading-none text-[#1a1917] font-bold">
             Watch<em className="italic ml-[1px]">list</em>
          </div>
          <div className="flex items-center gap-1.5 p-1">
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

        {/* SEARCH BAR */}
        <div className="px-[24px] mb-4">
          <div 
            className="bg-transparent rounded-[24px] flex items-center gap-2 px-4 py-3 cursor-text transition-all active:scale-[0.98] border border-[#e0ddd6] hover:bg-black/5" 
            onClick={() => setShowAdd(true)}
          >
            <SearchIcon size={16} className="text-[#9b9890] shrink-0" strokeWidth={2.5} />
            <span className="text-[#9b9890] text-[15px] font-medium w-full text-left tracking-[-0.01em]">Search your list…</span>
          </div>
        </div>

        {/* CAPSULE TABS */}
        <div className="flex items-center px-[24px] pb-4 hidden-scrollbar overflow-x-auto relative z-10 w-full">
           <div className="flex items-center gap-2 w-full pr-4">
            {['All', 'Watching', 'Plan to Watch', 'Completed'].map((f) => (
              <div 
                key={f} 
                onClick={() => setFilter(f)} 
                className={`text-[13px] font-medium px-4 py-2 cursor-pointer whitespace-nowrap shrink-0 transition-all rounded-full ${filter === f ? 'bg-[#1a1917] text-white font-bold' : 'text-[#9b9890] bg-transparent hover:bg-black/5'}`}
              >
                {f}
              </div>
            ))}
           </div>
        </div>
      </div>

      <div className="relative z-10 pt-2">
      {activeView === 'home' ? (
      <>
      {isInitializing ? (
         <div className="animate-in fade-in duration-300 pb-10">
            {filter === 'All' ? (
              <>
                <div className="px-[24px] pb-4 flex items-center"><div className="h-[10px] w-24 bg-brand-border/60 rounded-full animate-pulse" /></div>
                <div className="flex gap-3 px-[24px] overflow-x-hidden pb-4 flex-nowrap -ml-2 pl-[32px]">
                  {[1, 2, 3, 4].map(i => <PosterCardSkeleton key={i} />)}
                </div>
                
                <div className="pt-6 px-[24px] pb-2 flex items-center"><div className="h-[10px] w-20 bg-brand-border/60 rounded-full animate-pulse" /></div>
                <div className="px-[24px] flex flex-col gap-[10px]">
                  {[1, 2, 3].map(i => <ListCardSkeleton key={i} />)}
                </div>
              </>
            ) : (
              <>
                <div className="pt-2 px-[24px] pb-2 flex items-center"><div className="h-[10px] w-24 bg-brand-border/60 rounded-full animate-pulse" /></div>
                <div className="px-[24px] flex flex-col gap-[10px]">
                  {[1, 2, 3, 4, 5].map(i => <ListCardSkeleton key={i} />)}
                </div>
              </>
            )}
         </div>
      ) : filter !== 'All' ? (
         // Filtered View
         <div className="animate-in fade-in duration-300 pb-10">
            <div className="px-[24px] pb-[12px] pt-[24px] text-[11px] font-bold tracking-[0.08em] uppercase text-[#9b9890]">{filter}</div>
            <div className="px-[24px] flex flex-col gap-[10px]">
              {filteredItems.map((item, i) => (
                 <ListCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />
              ))}
              {filteredItems.length === 0 && <div className="text-center py-10 text-[#9b9890] text-sm font-medium">No titles found.</div>}
            </div>
         </div>
      ) : (
         // Main All View
         <div className="animate-in fade-in duration-300 pb-10 mt-2">
            {recentlyAdded.length > 0 && (
              <div className="mb-[24px]">
                <div className="flex gap-3 px-[24px] overflow-x-auto no-scrollbar pb-2 snap-x -ml-2 pl-[32px]">
                  {recentlyAdded.map((item, i) => (
                    <PosterCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />
                  ))}
                  <div className="w-[12px] shrink-0" />
                </div>
                <div className="h-px bg-[#e0ddd6] mx-[24px] mt-6" />
              </div>
            )}

            {watchingItems.length > 0 && (
               <div className="mb-[24px]">
                 <div className="px-[24px] pb-[12px] text-[11px] font-bold tracking-[0.08em] uppercase text-[#9b9890]">Watching now</div>
                 <div className="px-[24px] flex flex-col gap-[10px]">
                   {watchingItems.map((item, i) => <ListCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />)}
                 </div>
               </div>
            )}

            {planItems.length > 0 && (
               <div className="mb-[24px]">
                 <div className="px-[24px] pb-[12px] text-[11px] font-bold tracking-[0.08em] uppercase text-[#9b9890]">Plan to watch</div>
                 <div className="px-[24px] flex flex-col gap-[10px]">
                   {planItems.map((item, i) => <ListCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />)}
                 </div>
               </div>
            )}

            {completedItems.length > 0 && (
               <div className="mb-[24px]">
                 <div className="px-[24px] pb-[12px] text-[11px] font-bold tracking-[0.08em] uppercase text-[#9b9890]">Completed</div>
                 <div className="px-[24px] flex flex-col gap-[10px]">
                   {completedItems.map((item, i) => <ListCard key={item.id} item={item} index={i} onClick={() => setSelectedId(item.id)} />)}
                 </div>
               </div>
            )}

            {items.length === 0 && (
               <div className="px-8 py-16 flex flex-col items-center text-center animate-in fade-in duration-500">
                  <div className="w-[72px] h-[72px] bg-white rounded-full border border-[#e0ddd6] flex items-center justify-center mb-5 text-[#9b9890] shadow-sm">
                    <List size={28} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-[22px] font-serif text-[#1a1917] mb-2 tracking-[-0.02em]">Your list is empty</h3>
                  <p className="text-[#9b9890] text-[14px] max-w-[240px] leading-[1.5] font-medium">Tap the plus icon below or use the search bar to add titles.</p>
               </div>
            )}
         </div>
      )}
      </>
      ) : (
        <div className="animate-in fade-in duration-300 pb-10 px-[24px]">
            <h2 className="font-serif text-[32px] tracking-[-0.03em] leading-none text-[#1a1917] mb-6 mt-4">Statistics</h2>
            
            <div className="grid grid-cols-2 gap-[10px]">
               <div className="bg-white rounded-[16px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-brand-border/40">
                  <div className="text-[32px] font-semibold text-[#1a1917] mb-0.5 leading-none">{items.length}</div>
                  <div className="text-[12px] text-[#9b9890] font-medium">Total Titles</div>
               </div>
               <div className="bg-white rounded-[16px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-brand-border/40 flex flex-col justify-center">
                  <div className="flex w-full h-[6px] rounded-full overflow-hidden mb-2 bg-[#f0ede8]">
                    <div className="h-full bg-[#1a1917]" style={{ width: `${items.length ? (items.filter(i=>i.type==='movie').length / items.length) * 100 : 0}%` }} />
                  </div>
                  <div className="flex justify-between text-[12px] font-medium">
                     <span className="text-[#1a1917]">{items.filter(i=>i.type==='movie').length} <span className="text-[#9b9890]">Movies</span></span>
                     <span className="text-[#1a1917]">{items.filter(i=>i.type==='tv').length} <span className="text-[#9b9890]">Series</span></span>
                  </div>
               </div>
               
               <div className="bg-white rounded-[16px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-brand-border/40 col-span-2">
                  <div className="flex justify-between items-end mb-4 border-b border-[#f0ede8] pb-4">
                     <div>
                        <div className="text-[24px] font-semibold text-[#1a1917] leading-none mb-1">{items.filter(i=>i.status==='watching').length}</div>
                        <div className="text-[12px] text-[#2e7d32] font-semibold bg-[#e6f4ea] px-2 py-0.5 rounded uppercase tracking-[0.04em]">Watching</div>
                     </div>
                     <div>
                        <div className="text-[24px] font-semibold text-[#1a1917] leading-none mb-1 text-center">{items.filter(i=>i.status==='plan' || !i.status).length}</div>
                        <div className="text-[12px] text-[#d4840a] font-semibold bg-[#fef3e2] px-2 py-0.5 rounded uppercase tracking-[0.04em]">Plan</div>
                     </div>
                     <div className="text-right">
                        <div className="text-[24px] font-semibold text-[#1a1917] leading-none mb-1">{items.filter(i=>i.status==='completed').length}</div>
                        <div className="text-[12px] text-[#6a1bdb] font-semibold bg-[#ede7f6] px-2 py-0.5 rounded uppercase tracking-[0.04em]">Completed</div>
                     </div>
                  </div>
               </div>
            </div>
        </div>
      )}
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
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => !isLoading && setShowAdd(false)} className="fixed inset-0 bg-[#1a1917]/30 backdrop-blur-sm z-[60] w-full max-w-[430px] mx-auto" />
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
              className="fixed inset-x-0 bottom-0 z-[70] p-4 pt-16 pointer-events-none w-full max-w-[430px] mx-auto"
            >
               <div className="w-full bg-[#f0ede8] border border-[#e0ddd6] rounded-[24px] p-6 pb-8 shadow-[0_20px_40px_rgba(0,0,0,0.2)] pointer-events-auto flex flex-col gap-4">
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="font-serif text-[30px] leading-none text-[#1a1714] tracking-[-0.02em]">Add title</h3>
                     <button onClick={() => !isLoading && setShowAdd(false)} className="text-[#a09890] hover:bg-black/5 active:bg-black/10 cursor-pointer p-2 -mr-2 rounded-full transition-colors"><X size={20}/></button>
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

      {/* FLOATING BOTTOM BAR */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1a1917]/90 backdrop-blur-xl rounded-[24px] px-6 py-3 flex items-center justify-between z-[50] shadow-[0_12px_40px_rgba(0,0,0,0.2)] border border-[#333] w-[calc(100%-48px)] max-w-[320px]">
        <button onClick={() => setActiveView('home')} className={`flex flex-col items-center gap-1 ${activeView === 'home' ? 'text-white' : 'text-[#b8b5ad] hover:text-white'} transition-colors cursor-pointer w-16`}>
           <Home size={22} strokeWidth={2.2} />
           <span className="text-[10px] font-bold tracking-wide">Home</span>
        </button>
        <button onClick={() => setShowAdd(true)} className="w-[46px] h-[46px] bg-white rounded-[16px] flex items-center justify-center text-[#1a1917] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all shadow-[0_4px_14px_rgba(255,255,255,0.25)] cursor-pointer border border-[#f0ede8]">
           <Plus size={24} strokeWidth={3} />
        </button>
        <button onClick={() => setActiveView('stats')} className={`flex flex-col items-center gap-1 ${activeView === 'stats' ? 'text-white' : 'text-[#b8b5ad] hover:text-white'} transition-colors cursor-pointer w-16`}>
           <BarChart2 size={22} strokeWidth={2.2} />
           <span className="text-[10px] font-bold tracking-wide">Stats</span>
        </button>
      </div>

    </div>
  );
}

// Sub-components

function PosterCard({ item, index, onClick }: { item: TitleItem, index: number, onClick: () => void }) {
  return (
     <div 
       onClick={onClick} 
       className="shrink-0 w-[96px] cursor-pointer active:opacity-70 hover:-translate-y-1 transition-all animate-list-item"
       style={{ animationDelay: `${index * 0.05 + 0.05}s` }}
     >
        <div className="w-[96px] h-[144px] rounded-[10px] bg-[#e0dbd4] border border-[#e0ddd6] flex items-center justify-center text-[36px] mb-2 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          {item.poster ? <img src={item.poster} className="w-full h-full object-cover" /> : (item.type === 'movie' ? '🎬' : '📺')}
        </div>
        <div className="text-[13px] font-semibold text-[#1a1917] break-words line-clamp-1 whitespace-nowrap overflow-hidden text-ellipsis mb-0.5 tracking-tight">{item.title}</div>
        <div className="text-[11px] text-[#9b9890] capitalize">{item.year || 'Unknown'} · {item.type}</div>
     </div>
  );
}

function ListCard({ item, index, onClick }: { item: TitleItem, index: number, onClick: () => void }) {
  return (
    <div 
       onClick={onClick} 
       className="bg-white rounded-[16px] flex items-center gap-[12px] p-[8px_16px_8px_8px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] cursor-pointer transition-all animate-list-item group"
       style={{ animationDelay: `${index * 0.03 + 0.02}s` }}
    >
       <div className="w-[70px] h-[105px] rounded-[10px] bg-[#e0dbd4] shrink-0 flex items-center justify-center text-xl overflow-hidden border border-[#e0ddd6] group-hover:-translate-y-0.5 transition-transform">
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

       <div className="flex shrink-0 ml-1 text-[#9b9890] hover:text-[#1a1917] transition-colors p-2 active:scale-90" onClick={(e) => {
          e.stopPropagation();
          // Ideally open a quick status change, but for now just prevent opening detail view
       }}>
          <Bookmark size={18} strokeWidth={2.5} />
       </div>
    </div>
  )
}

function ItemDetailView({ item, onClose, onUpdate, onRemove }: { item: TitleItem; onClose: () => void; onUpdate: (updates: Partial<TitleItem>) => void; onRemove: (id: number) => void; }) {
  const [isEditingPoster, setIsEditingPoster] = useState(false);
  const [tempPoster, setTempPoster] = useState(item.poster || '');

  return (
    <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type: "spring", damping: 25, stiffness: 220}} className="fixed inset-0 z-50 bg-brand-bg flex flex-col overflow-y-auto no-scrollbar w-full max-w-[430px] mx-auto overflow-x-hidden">
      
      <div className="relative w-full aspect-[3/4] max-h-[45vh] shrink-0 bg-[#e0dbd4] shadow-sm">
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
           <span className="text-[11px] font-bold tracking-[0.08em] text-[#9b9890] uppercase">{item.type}</span>
           {item.year && <span className="text-[12px] font-medium text-[#9b9890]">{item.year}</span>}
           {item.rating && <span className="text-[12px] font-semibold text-[#1a1917] flex items-center gap-1 ml-auto"><Star size={12} className="fill-[#e8a020] text-[#e8a020]" /> {item.rating}</span>}
        </div>

        <h1 className="font-serif text-[42px] leading-[0.95] text-[#1a1917] mb-4 tracking-[-0.5px]">{item.title}</h1>
        
        {item.genre && (
          <div className="flex gap-1.5 flex-wrap mb-5">
             {item.genre.split(',').map(g => g.trim()).map(g => (
                <span key={g} className="text-[11px] font-semibold px-2 py-1 rounded-[6px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-[#1a1917] border border-[#e0ddd6]">{g}</span>
             ))}
          </div>
        )}

        <p className="text-[14px] text-[#9b9890] font-sans leading-[1.6] mb-8">{item.synopsis || "No synopsis available for this title."}</p>

        {/* Status Actions */}
        <div className="flex flex-col gap-2 bg-white rounded-[16px] p-1.5 border border-[#e0ddd6] shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-6 mt-4">
           <div className="flex gap-1 w-full">
              <button 
                onClick={() => onUpdate({status: 'plan'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-semibold transition-colors cursor-pointer w-full ${item.status === 'plan' || !item.status ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5'}`}
              >
                Plan to Watch
              </button>
              <button 
                onClick={() => onUpdate({status: 'watching'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-semibold transition-colors cursor-pointer w-full ${item.status === 'watching' ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5'}`}
              >
                Watching
              </button>
              <button 
                onClick={() => onUpdate({status: 'completed'})} 
                className={`flex-1 py-3 rounded-[12px] text-[12px] font-semibold transition-colors cursor-pointer w-full ${item.status === 'completed' ? 'bg-[#1a1917] text-white shadow-sm tracking-[0.01em]' : 'text-[#9b9890] hover:bg-black/5'}`}
              >
                Completed
              </button>
           </div>
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

function ListCardSkeleton() {
  return (
    <div className="bg-white rounded-[16px] flex items-center gap-[12px] p-[8px_16px_8px_8px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] animate-pulse">
       <div className="w-[70px] h-[105px] rounded-[10px] bg-[#e0dbd4] shrink-0" />
       <div className="flex-1 flex flex-col justify-center gap-1.5 py-1">
         <div className="h-[14px] bg-[#e0dbd4] rounded-[4px] w-[85%] mb-1" />
         <div className="h-[10px] bg-[#e0dbd4]/70 rounded-[4px] w-[45%]" />
         <div className="h-[10px] bg-[#e0dbd4]/50 rounded-[4px] w-[60%]" />
       </div>
       <div className="w-[20px] h-[20px] rounded-full bg-[#e0dbd4]/60 flex items-center shrink-0 ml-1" />
    </div>
  )
}

function PosterCardSkeleton() {
  return (
     <div className="shrink-0 w-[96px] animate-pulse">
        <div className="w-[96px] h-[144px] rounded-[10px] bg-[#e0dbd4] mb-2" />
        <div className="h-[10px] bg-[#e0dbd4] rounded-full w-5/6 mb-1.5" />
        <div className="h-[8px] bg-[#e0dbd4]/70 rounded-full w-2/3" />
     </div>
  )
}
