import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download, Lock, Menu, Settings, Globe, PlayCircle, Link as LinkIcon, Clock, Sparkles, X, ChevronRight, Send, Moon, Sun, Image as ImageIcon } from 'lucide-react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Category, FileItem, AppSettings } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    settings: AppSettings;
}

const translations = {
  en: {
    searchPlaceholder: "Search files...",
    availableFiles: "Library",
    all: "All",
    download: "Download",
    subscribe: "Subscribe",
    unlock: "Unlock",
    watchAd: "Ads",
    step: "Step",
    of: "of",
    completed: "Ready",
    wait: "Wait",
    sec: "s",
    noFiles: "No content found.",
    adminPanel: "Control Center",
    changeLang: "Language",
    chooseLang: "Select Language",
    english: "English",
    bangla: "বাংলা",
    adError: "Ad connection failed. Please retry.",
    adLoading: "Loading...",
    pleaseWait: "Processing",
    nightMode: "Night Mode",
    lightMode: "Light Mode"
  },
  bn: {
    searchPlaceholder: "ফাইল খুঁজুন...",
    availableFiles: "লাইব্রেরি",
    all: "সব",
    download: "ডাউনলোড",
    subscribe: "জয়েন করুন",
    unlock: "আনলক",
    watchAd: "বিজ্ঞাপন",
    step: "ধাপ",
    of: "এর",
    completed: "প্রস্তুত",
    wait: "অপেক্ষা",
    sec: "সে",
    noFiles: "কোনো কন্টেন্ট পাওয়া যায়নি।",
    adminPanel: "কন্ট্রোল সেন্টার",
    changeLang: "ভাষা",
    chooseLang: "ভাষা নির্বাচন করুন",
    english: "English",
    bangla: "বাংলা",
    adError: "বিজ্ঞাপন সংযোগ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
    adLoading: "লোড হচ্ছে...",
    pleaseWait: "প্রসেসিং",
    nightMode: "নাইট মোড",
    lightMode: "লাইট মোড"
  }
};

const UserView: React.FC<Props> = ({ settings }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLangModal, setShowLangModal] = useState(true);
  
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [adsProgress, setAdsProgress] = useState<{[key: string]: number}>({}); 
  // New State for Persistent Unlocked Files
  const [unlockedFiles, setUnlockedFiles] = useState<string[]>([]);
  
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [lang, setLang] = useState<'en' | 'bn'>('en');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  const processingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const T = translations[lang];

  // Use settings values or fallback
  const appName = settings.appName || "Tech By Rubel";
  const heroTitle = settings.heroTitle || "Premium Files";
  const heroSubtitle = settings.heroSubtitle || "Unlock exclusive content freely";
  const zoneId = settings.monetagZoneId || "10174286";

  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage') as 'en' | 'bn' | null;
    if (savedLang) {
      setLang(savedLang);
      setShowLangModal(false);
    }

    // Load unlocked files from local storage
    const savedUnlocked = JSON.parse(localStorage.getItem('unlockedFiles') || '[]');
    setUnlockedFiles(savedUnlocked);

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        setDarkMode(true);
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    const loadData = async () => {
      try {
        const catQ = query(collection(db, "categories"), orderBy("order"));
        const catSnap = await getDocs(catQ);
        setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));

        const fileSnap = await getDocs(collection(db, "files"));
        setFiles(fileSnap.docs.map(d => ({ id: d.id, ...d.data() } as FileItem)));
      } catch (err) {
        console.error("Failed to load content", err);
      }
    };
    loadData();

    return () => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current);
    };
  }, []);

  const toggleDarkMode = () => {
      const newMode = !darkMode;
      setDarkMode(newMode);
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      if (newMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  const handleLanguageSelect = (selectedLang: 'en' | 'bn') => {
      setLang(selectedLang);
      localStorage.setItem('appLanguage', selectedLang);
      setShowLangModal(false);
      setIsMenuOpen(false);
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          file.subtitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || file.categoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const markAsUnlocked = (fileId: string) => {
      const newUnlocked = [...unlockedFiles, fileId];
      setUnlockedFiles(newUnlocked);
      localStorage.setItem('unlockedFiles', JSON.stringify(newUnlocked));
  };

  const handleUnlock = async (file: FileItem) => {
    // 1. If already unlocked (persistent), open link
    if (unlockedFiles.includes(file.id)) {
        window.open(file.downloadLink, '_blank');
        return;
    }

    // 2. If not premium (free), open link
    if (!file.isPremium) {
      window.open(file.downloadLink, '_blank');
      return;
    }

    const required = file.adsRequired || 1;
    const current = adsProgress[file.id] || 0;

    // 3. If already finished progress in this session (safety check)
    if (current >= required) {
        markAsUnlocked(file.id);
        window.open(file.downloadLink, '_blank');
        return;
    }

    setUnlockingId(file.id);

    try {
        const funcName = `show_${zoneId}`;
        if (typeof window[funcName] === 'function') {
            await window[funcName]();
        } else {
            console.warn(`Ad function ${funcName} not found. Fallback.`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setUnlockingId(null);

        const nextCount = current + 1;
        
        // CRITICAL: If this is the LAST ad, SKIP the timer and UNLOCK PERMANENTLY
        if (nextCount >= required) {
            setAdsProgress(prevProg => ({
                ...prevProg,
                [file.id]: nextCount
            }));
            markAsUnlocked(file.id);
        } else {
            // Intermediate ad: Show 10s timer
            setProcessingId(file.id);
            setProcessingTime(10);

            if (processingTimerRef.current) clearInterval(processingTimerRef.current);
            processingTimerRef.current = setInterval(() => {
                setProcessingTime((prev) => {
                    if (prev <= 1) {
                        if (processingTimerRef.current) clearInterval(processingTimerRef.current);
                        setAdsProgress(prevProg => ({
                            ...prevProg,
                            [file.id]: (prevProg[file.id] || 0) + 1
                        }));
                        setProcessingId(null);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

    } catch (e) {
        console.error("Ad error", e);
        alert(T.adError);
        setUnlockingId(null);
    }
  };

  const getButtonState = (file: FileItem) => {
      if (unlockedFiles.includes(file.id)) return 'download'; // Persistent unlock check
      if (unlockingId === file.id) return 'loading';
      if (processingId === file.id) return 'processing';
      if (!file.isPremium) return 'download'; 
      const required = file.adsRequired || 1;
      const current = adsProgress[file.id] || 0;
      if (current >= required) return 'download';
      return 'ad';
  };

  return (
    <div className="min-h-screen transition-colors duration-300 font-sans selection:bg-blue-500/30">
      {/* iOS Glass Header */}
      <motion.header 
        initial={{ y: -100 }} animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 h-16 glass z-40 flex items-center justify-between px-5"
      >
         <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                {appName}
            </h1>
         </div>
         <button 
            onClick={() => setIsMenuOpen(true)} 
            className="w-10 h-10 rounded-full bg-gray-200/50 dark:bg-white/10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 transition-colors active:scale-90"
         >
            <Menu className="w-5 h-5 text-gray-700 dark:text-white" />
         </button>
      </motion.header>
      
      {/* Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
             <>
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
                    onClick={() => setIsMenuOpen(false)}
                />
                <motion.div 
                    initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 bottom-0 w-72 bg-[#F2F2F7] dark:bg-[#1C1C1E] z-50 shadow-2xl p-6 flex flex-col gap-6 text-slate-900 dark:text-white"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Menu</h2>
                        <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-gray-200 dark:bg-white/10 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        <button onClick={toggleDarkMode} className="w-full flex items-center gap-4 p-4 bg-white dark:bg-black/50 rounded-2xl shadow-ios active:scale-95 transition-transform">
                            <div className={`p-2 rounded-lg text-white transition-colors ${darkMode ? 'bg-indigo-500' : 'bg-orange-400'}`}>
                                {darkMode ? <Moon size={20}/> : <Sun size={20}/>}
                            </div>
                            <span className="font-semibold">{darkMode ? T.lightMode : T.nightMode}</span>
                        </button>
                        <button onClick={() => setShowLangModal(true)} className="w-full flex items-center gap-4 p-4 bg-white dark:bg-black/50 rounded-2xl shadow-ios active:scale-95 transition-transform">
                            <div className="bg-green-500 p-2 rounded-lg text-white"><Globe size={20}/></div>
                            <span className="font-semibold">{T.changeLang}</span>
                            <ChevronRight className="ml-auto text-gray-400" size={18}/>
                        </button>
                    </div>
                </motion.div>
             </>
        )}
      </AnimatePresence>

      <div className="pt-24 px-5 pb-32 max-w-4xl mx-auto">
        {/* Hero Search */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
        >
            <h2 className="text-3xl font-extrabold mb-1 tracking-tight">{heroTitle}</h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-6">{heroSubtitle}</p>
            
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-300 to-purple-300 rounded-2xl opacity-30 group-hover:opacity-100 transition duration-500 blur"></div>
                <div className="relative bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-ios flex items-center p-4 gap-3">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder={T.searchPlaceholder}
                        className="flex-1 bg-transparent outline-none text-lg placeholder:text-gray-400 font-medium text-slate-900 dark:text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </motion.div>

        {/* Categories */}
        <div className="mb-8 overflow-x-auto no-scrollbar pb-2">
          <div className="flex gap-3">
            <button 
                onClick={() => setActiveCategory('All')}
                className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm ${activeCategory === 'All' ? 'bg-[#1C1C1E] dark:bg-white text-white dark:text-black scale-105' : 'bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-gray-400'}`}
            >
                {T.all}
            </button>
            {categories.map(cat => (
                <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm whitespace-nowrap ${activeCategory === cat.id ? 'bg-[#1C1C1E] dark:bg-white text-white dark:text-black scale-105' : 'bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-gray-400'}`}
                >
                    {cat.name}
                </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid gap-6 md:grid-cols-2">
            <AnimatePresence mode='popLayout'>
              {filteredFiles.map((file) => {
                  const state = getButtonState(file);
                  const required = file.adsRequired || 1;
                  const current = adsProgress[file.id] || 0;
                  const isSubscribe = file.actionType === 'subscribe';
                  
                  return (
                  <motion.div 
                      key={file.id}
                      layout
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: 'spring', damping: 20 }}
                      className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-4 shadow-ios hover:shadow-ios-hover transition-shadow relative overflow-hidden group border border-transparent dark:border-gray-800"
                  >
                      {/* Card Image */}
                      <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-4 relative flex items-center justify-center">
                          <img 
                            src={file.imageUrl} 
                            alt={file.title} 
                            className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-500" 
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement?.classList.add('bg-gray-200', 'dark:bg-gray-700');
                            }}
                          />
                          {/* Fallback Icon behind image */}
                          <ImageIcon className="absolute text-gray-300 dark:text-gray-600 w-12 h-12 -z-10" />
                          
                          {file.badgeText && (
                              <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-sm text-slate-900 dark:text-white z-20">
                                  {file.badgeText}
                              </div>
                          )}
                          {file.isPremium && !unlockedFiles.includes(file.id) && (
                              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold z-20">
                                  <Lock size={12} /> {file.adsRequired || 1}
                              </div>
                          )}
                      </div>

                      <div className="px-1">
                          <h3 className="text-lg font-bold leading-tight mb-1 text-slate-900 dark:text-white">{file.title}</h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4">{file.subtitle}</p>

                          <div className="flex gap-3">
                              <motion.button 
                                whileTap={{ scale: 0.95 }}
                                disabled={state === 'loading' || state === 'processing'}
                                onClick={() => handleUnlock(file)}
                                className={`flex-1 h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all
                                    ${state === 'download' ? (isSubscribe ? 'bg-[#229ED9] text-white shadow-blue-400/30' : 'bg-green-500 text-white shadow-green-500/30') : 
                                      state === 'ad' ? 'bg-blue-600 text-white shadow-blue-600/30' : 
                                      'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}
                                `}
                              >
                                  {state === 'loading' && <><Lock className="animate-pulse w-4 h-4"/> {T.adLoading}</>}
                                  {state === 'processing' && <><Clock className="animate-spin w-4 h-4"/> {T.pleaseWait} {processingTime}s</>}
                                  
                                  {state === 'download' && (
                                      <>
                                        {isSubscribe ? <Send className="w-4 h-4"/> : <Download className="w-4 h-4"/>} 
                                        {isSubscribe ? T.subscribe : T.download}
                                      </>
                                  )}
                                  
                                  {state === 'ad' && <><PlayCircle className="w-4 h-4"/> {T.watchAd} ({current}/{required})</>}
                              </motion.button>

                              {file.directLink && (
                                  <motion.a 
                                    whileTap={{ scale: 0.95 }}
                                    href={file.directLink}
                                    target="_blank" rel="noreferrer"
                                    className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-white/10 hover:text-blue-600 transition-colors"
                                  >
                                      <LinkIcon size={20} />
                                  </motion.a>
                              )}
                          </div>
                      </div>
                  </motion.div>
              )})}
            </AnimatePresence>
            
            {filteredFiles.length === 0 && (
                <div className="col-span-full text-center py-20 opacity-50">
                    <p className="text-lg font-medium">{T.noFiles}</p>
                </div>
            )}
        </div>
      </div>

      {/* Language Selector Modal */}
      <AnimatePresence>
      {showLangModal && (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6"
        >
            <motion.div 
                initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center border border-white/10"
            >
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400 shadow-inner">
                    <Globe size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-8 text-slate-900 dark:text-white">{T.chooseLang}</h3>
                <div className="flex flex-col gap-4">
                    <button onClick={() => handleLanguageSelect('en')} className="py-4 bg-[#F2F2F7] dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-2xl font-bold text-lg transition-colors dark:text-white">🇬🇧 {T.english}</button>
                    <button onClick={() => handleLanguageSelect('bn')} className="py-4 bg-[#F2F2F7] dark:bg-white/10 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-2xl font-bold text-lg transition-colors text-green-700 dark:text-green-400">🇧🇩 {T.bangla}</button>
                </div>
            </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default UserView;