import React, { useState, useEffect } from 'react';
import { User, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db, ADMIN_UID, storage } from '../firebase';
import { collection, addDoc, deleteDoc, updateDoc, doc, getDocs, setDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Category, FileItem, AppSettings } from '../types';
import { Trash2, Plus, LogOut, Settings, Folder, FileText, Edit2, UploadCloud, Check, AlertTriangle, Download, Send, Image as ImageIcon, AlertCircle, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: User | null;
}

const AdminPanel: React.FC<Props> = ({ user }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'files' | 'categories' | 'settings'>('files');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ 
      id: 'general', 
      monetagZoneId: '10174286', 
      monetagScriptUrl: '//libtl.com/sdk.js',
      adminTitle: 'Control Center', 
      welcomeMessage: 'Welcome',
      appName: "File Share",
      heroTitle: "Premium Files",
      heroSubtitle: "Unlock exclusive content freely"
  });

  // UI States
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resolvingLink, setResolvingLink] = useState(false); // New state for auto-fix
  const [thumbMode, setThumbMode] = useState<'upload' | 'link'>('upload');
  const [newCatName, setNewCatName] = useState('');
  const [previewError, setPreviewError] = useState(false);
  
  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'file'|'cat', id: string} | null>(null);

  const [fileForm, setFileForm] = useState<Partial<FileItem>>({
      title: '', subtitle: '', imageUrl: '', downloadLink: '', directLink: '', categoryId: '', isPremium: true, badgeText: 'Prompt', adsRequired: 1, actionType: 'download'
  });

  const isAdmin = user && user.uid === ADMIN_UID;

  useEffect(() => {
    if (isAdmin) fetchData();
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  }, [isAdmin]);

  // Reset preview error when URL changes
  useEffect(() => {
    setPreviewError(false);
  }, [fileForm.imageUrl]);

  // AUTO-RESOLVE LINKS (ImgBB Viewer & HTML Snippets)
  useEffect(() => {
      const url = fileForm.imageUrl;
      if (!url) return;

      // 1. Check if user pasted an HTML tag (e.g. <img src="...">)
      // This regex looks for src="VALUE" or src='VALUE'
      const srcMatch = url.match(/src=["'](.*?)["']/);
      if (srcMatch && srcMatch[1]) {
          // Found a source URL inside tags, extract it immediately
          setFileForm(prev => ({ ...prev, imageUrl: srcMatch[1] }));
          return;
      }

      // 2. Check for ImgBB Viewer Links (not direct image links)
      // We skip this if the url contains '<' which implies it might be HTML that we haven't parsed yet or malformed
      if (url.includes('ibb.co') && !url.includes('i.ibb.co') && !url.includes('<')) {
          const resolveImgBB = async () => {
              setResolvingLink(true);
              try {
                  // Use AllOrigins proxy to bypass CORS and fetch the HTML
                  const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
                  const data = await response.json();
                  if (data.contents) {
                      // Parse the HTML to find the meta og:image tag which contains the direct link
                      const match = data.contents.match(/<meta property="og:image" content="(.*?)"/);
                      if (match && match[1]) {
                          // Found it! Update the state
                          setFileForm(prev => ({ ...prev, imageUrl: match[1] }));
                      }
                  }
              } catch (e) {
                  console.error("Could not auto-resolve ImgBB link", e);
              } finally {
                  setResolvingLink(false);
              }
          };

          // Debounce slightly to avoid spamming while typing
          const timer = setTimeout(resolveImgBB, 800);
          return () => clearTimeout(timer);
      }
  }, [fileForm.imageUrl]);

  const fetchData = async () => {
    try {
        const catSnap = await getDocs(query(collection(db, "categories"), orderBy("order")));
        setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));

        const fileSnap = await getDocs(collection(db, "files"));
        setFiles(fileSnap.docs.map(d => ({ id: d.id, ...d.data() } as FileItem)));

        const settingsSnap = await getDocs(collection(db, "settings"));
        if(!settingsSnap.empty) {
            setSettings({ ...settings, ...settingsSnap.docs[0].data() as AppSettings });
        }
    } catch (e) { console.error(e); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { alert("Access Denied"); } 
    finally { setLoadingAuth(false); }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!fileForm.title || !fileForm.downloadLink) return;

      try {
          if (isEditing && editingId) {
              await updateDoc(doc(db, "files", editingId), fileForm);
          } else {
              await addDoc(collection(db, "files"), fileForm);
          }
          resetFileForm();
          fetchData();
      } catch (e) { alert("Save failed"); }
  };

  const executeDelete = async () => {
      if (!deleteConfirm) return;
      try {
          if (deleteConfirm.type === 'file') await deleteDoc(doc(db, "files", deleteConfirm.id));
          else await deleteDoc(doc(db, "categories", deleteConfirm.id));
          fetchData();
          setDeleteConfirm(null);
      } catch (e) { alert("Delete failed"); }
  };

  const addCategory = async () => {
    if (!newCatName) return;
    await addDoc(collection(db, "categories"), { name: newCatName, order: categories.length + 1 });
    setNewCatName('');
    fetchData();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setUploading(true);
        try {
            const file = e.target.files[0];
            const storageRef = ref(storage, `thumbnails/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setFileForm(prev => ({ ...prev, imageUrl: url }));
        } catch (e) { alert("Upload failed"); } 
        finally { setUploading(false); }
    }
  };

  const handleEditFile = (file: FileItem) => {
      setFileForm(file);
      setEditingId(file.id);
      setIsEditing(true);
      setThumbMode(file.imageUrl.includes('firebasestorage') ? 'upload' : 'link');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetFileForm = () => {
      setFileForm({ title: '', subtitle: '', imageUrl: '', downloadLink: '', directLink: '', categoryId: '', isPremium: true, badgeText: 'Prompt', adsRequired: 1, actionType: 'download' });
      setIsEditing(false);
      setEditingId(null);
      setUploading(false);
      setPreviewError(false);
      setResolvingLink(false);
  };

  const saveSettings = async () => {
      await setDoc(doc(db, "settings", "general"), settings);
      alert("Configuration Saved");
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] dark:bg-black p-6 transition-colors duration-300">
        <div className="bg-white dark:bg-[#1C1C1E] p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/10">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-black dark:bg-white text-white dark:text-black rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-glow">
                    <Settings size={40} />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Admin</h2>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-100 dark:bg-black/50 p-4 rounded-2xl font-medium outline-none focus:ring-2 ring-blue-500 dark:text-white placeholder:text-gray-400" placeholder="Email" required />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-100 dark:bg-black/50 p-4 rounded-2xl font-medium outline-none focus:ring-2 ring-blue-500 dark:text-white placeholder:text-gray-400" placeholder="Password" required />
                <button type="submit" disabled={loadingAuth} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-transform">
                    {loadingAuth ? 'Verifying...' : 'Unlock Dashboard'}
                </button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black pb-20 font-sans text-slate-900 dark:text-white transition-colors duration-300">
      <header className="sticky top-0 z-30 glass px-6 py-4 flex justify-between items-center shadow-sm bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-3">
            <div className="bg-black dark:bg-white p-2 rounded-xl text-white dark:text-black"><Settings size={20}/></div>
            <h1 className="font-bold text-xl tracking-tight">Control Center</h1>
        </div>
        <button onClick={() => signOut(auth)} className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
            <LogOut size={18} />
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
          <div className="flex p-1.5 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur rounded-2xl mb-8 shadow-sm border border-gray-200/50 dark:border-white/10">
              {['files', 'categories', 'settings'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                    className={`flex-1 py-3 rounded-xl font-bold text-sm capitalize transition-all relative ${activeTab === tab ? 'text-white dark:text-black shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  >
                      {activeTab === tab && (
                          <motion.div layoutId="activeTab" className="absolute inset-0 bg-black dark:bg-white rounded-xl" />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-2">
                          {tab === 'files' && <FileText size={16} />}
                          {tab === 'categories' && <Folder size={16} />}
                          {tab === 'settings' && <Settings size={16} />}
                          {tab}
                      </span>
                  </button>
              ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'files' && (
                <motion.div 
                    key="files" 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="grid lg:grid-cols-12 gap-6"
                >
                    <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                        <div className={`bg-white dark:bg-[#1C1C1E] p-6 rounded-3xl shadow-ios border-2 transition-all ${isEditing ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-transparent dark:border-white/5'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-xl flex items-center gap-2">
                                    {isEditing ? <Edit2 size={20} className="text-blue-500"/> : <Plus size={20} className="text-green-500"/>}
                                    {isEditing ? 'Edit File' : 'New File'}
                                </h3>
                                {isEditing && <button onClick={resetFileForm} className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-md">CANCEL</button>}
                            </div>
                            
                            <form onSubmit={handleFileSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <input className="w-full bg-gray-50 dark:bg-black/50 p-4 rounded-2xl font-semibold outline-none focus:bg-white dark:focus:bg-black focus:ring-2 ring-blue-500 transition-all dark:text-white placeholder:text-gray-400" placeholder="Title" value={fileForm.title} onChange={e => setFileForm({...fileForm, title: e.target.value})} required />
                                    <input className="w-full bg-gray-50 dark:bg-black/50 p-4 rounded-2xl text-sm outline-none focus:bg-white dark:focus:bg-black focus:ring-2 ring-blue-500 transition-all dark:text-white placeholder:text-gray-400" placeholder="Subtitle" value={fileForm.subtitle} onChange={e => setFileForm({...fileForm, subtitle: e.target.value})} />
                                </div>

                                <div className="bg-gray-50 dark:bg-black/50 p-4 rounded-2xl">
                                    <div className="flex gap-1 bg-gray-200 dark:bg-white/10 p-1 rounded-xl mb-3">
                                        <button type="button" onClick={() => setThumbMode('upload')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${thumbMode === 'upload' ? 'bg-white dark:bg-[#1C1C1E] shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Upload</button>
                                        <button type="button" onClick={() => setThumbMode('link')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${thumbMode === 'link' ? 'bg-white dark:bg-[#1C1C1E] shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Link</button>
                                    </div>
                                    
                                    {thumbMode === 'upload' ? (
                                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors overflow-hidden relative ${uploading ? 'bg-gray-100 border-gray-400' : 'border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:border-blue-800'}`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                                            {uploading ? (
                                                <span className="text-xs font-bold animate-pulse">Uploading...</span>
                                            ) : (
                                                <div className="text-center text-gray-500 dark:text-gray-400">
                                                    <UploadCloud className="mx-auto mb-1 text-blue-400"/> 
                                                    <span className="text-xs">Tap to Upload</span>
                                                </div>
                                            )}
                                        </label>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <input 
                                                    className="w-full bg-white dark:bg-[#1C1C1E] p-3 pr-8 rounded-xl text-sm outline-none border border-gray-200 dark:border-white/10 dark:text-white" 
                                                    placeholder="Paste Link or HTML (e.g. <img src=...>)" 
                                                    value={fileForm.imageUrl} 
                                                    onChange={e => setFileForm({...fileForm, imageUrl: e.target.value})} 
                                                />
                                                {resolvingLink && (
                                                    <div className="absolute right-3 top-3 text-blue-500 animate-spin">
                                                        <Wand2 size={16} />
                                                    </div>
                                                )}
                                            </div>
                                            {resolvingLink && (
                                                <p className="text-[10px] text-blue-500 font-bold animate-pulse ml-1">Auto-fixing ImgBB link...</p>
                                            )}
                                        </div>
                                    )}
                                    
                                    {fileForm.imageUrl && !previewError && !resolvingLink && (
                                        <div className="mt-3 flex items-center gap-2 p-2 bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-white/10">
                                            <img 
                                                src={fileForm.imageUrl} 
                                                alt="Preview" 
                                                className="w-10 h-10 rounded-lg object-cover object-center bg-gray-100 dark:bg-gray-800" 
                                                onError={() => setPreviewError(true)}
                                            />
                                            <span className="text-[10px] text-green-600 font-bold flex items-center gap-1"><Check size={10}/> Image Set</span>
                                        </div>
                                    )}
                                    {previewError && !resolvingLink && (
                                        <div className="mt-3 flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                            <AlertCircle size={16} className="text-red-500"/>
                                            <span className="text-[10px] text-red-500 font-bold">Preview Failed. Use direct link.</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <input className="w-full bg-gray-50 dark:bg-black/50 p-4 rounded-2xl font-mono text-sm outline-none focus:bg-white dark:focus:bg-black focus:ring-2 ring-blue-500 dark:text-white placeholder:text-gray-400" placeholder="Download Link" value={fileForm.downloadLink} onChange={e => setFileForm({...fileForm, downloadLink: e.target.value})} required />
                                    <div className="flex gap-2">
                                        <input className="w-full bg-gray-50 dark:bg-black/50 p-4 rounded-2xl text-sm outline-none focus:bg-white dark:focus:bg-black focus:ring-2 ring-blue-500 dark:text-white placeholder:text-gray-400" placeholder="Direct Link (Optional)" value={fileForm.directLink || ''} onChange={e => setFileForm({...fileForm, directLink: e.target.value})} />
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-black/50 p-4 rounded-2xl">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Action Button</label>
                                    <div className="flex gap-2">
                                        <button 
                                          type="button"
                                          onClick={() => setFileForm({...fileForm, actionType: 'download'})}
                                          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${fileForm.actionType === 'download' || !fileForm.actionType ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' : 'bg-white dark:bg-[#1C1C1E] text-gray-500'}`}
                                        >
                                            <Download size={14}/> Download
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setFileForm({...fileForm, actionType: 'subscribe'})}
                                          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${fileForm.actionType === 'subscribe' ? 'bg-[#229ED9] text-white shadow-lg' : 'bg-white dark:bg-[#1C1C1E] text-gray-500'}`}
                                        >
                                            <Send size={14}/> Telegram
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <select className="flex-1 bg-gray-50 dark:bg-black/50 p-4 rounded-2xl text-sm outline-none dark:text-white" value={fileForm.categoryId} onChange={e => setFileForm({...fileForm, categoryId: e.target.value})}>
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <input className="w-1/3 bg-gray-50 dark:bg-black/50 p-4 rounded-2xl text-sm outline-none dark:text-white placeholder:text-gray-400" placeholder="Badge" value={fileForm.badgeText} onChange={e => setFileForm({...fileForm, badgeText: e.target.value})} />
                                </div>

                                <div className="bg-gray-50 dark:bg-black/50 p-4 rounded-2xl">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-bold text-sm text-gray-700 dark:text-gray-300">Premium (Ads)</span>
                                        <input type="checkbox" className="w-6 h-6 accent-black rounded-md" checked={fileForm.isPremium} onChange={e => setFileForm({...fileForm, isPremium: e.target.checked})} />
                                    </div>
                                    {fileForm.isPremium && (
                                        <div>
                                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                                                <span>Ads Required</span>
                                                <span className="text-black dark:text-white text-lg">{fileForm.adsRequired || 1}</span>
                                            </div>
                                            <input type="range" min="1" max="50" value={fileForm.adsRequired || 1} onChange={e => setFileForm({...fileForm, adsRequired: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none accent-black dark:accent-white" />
                                        </div>
                                    )}
                                </div>

                                <button type="submit" className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-transform">
                                    {isEditing ? 'Update File' : 'Publish File'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="lg:col-span-7 xl:col-span-8">
                        <div className="grid md:grid-cols-2 gap-4">
                            {files.map(file => (
                                <motion.div 
                                    layout
                                    key={file.id} 
                                    className="bg-white dark:bg-[#1C1C1E] p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 flex flex-col justify-between group hover:shadow-ios-hover transition-all"
                                >
                                    <div className="flex gap-4 mb-4">
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-black rounded-2xl overflow-hidden shrink-0 relative flex items-center justify-center">
                                            <img 
                                                src={file.imageUrl} 
                                                className="w-full h-full object-cover object-center" 
                                                alt="" 
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement?.classList.add('bg-gray-200', 'dark:bg-gray-800');
                                                }}
                                            />
                                            <ImageIcon size={24} className="text-gray-400 absolute z-0" />
                                            {file.actionType === 'subscribe' && (
                                                <div className="absolute bottom-1 right-1 bg-[#229ED9] text-white p-1 rounded-full shadow-sm z-10"><Send size={10}/></div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-900 dark:text-white truncate">{file.title}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">{file.subtitle}</p>
                                            {file.isPremium && <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold rounded-full">Ads: {file.adsRequired}</span>}
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 mt-auto">
                                        <button onClick={() => handleEditFile(file)} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">Edit</button>
                                        <button onClick={() => setDeleteConfirm({type: 'file', id: file.id})} className="w-10 h-10 flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            {activeTab === 'categories' && (
                 <motion.div key="cat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto bg-white dark:bg-[#1C1C1E] p-8 rounded-3xl shadow-ios border border-white/5">
                      <h3 className="font-bold text-2xl mb-6 dark:text-white">Manage Categories</h3>
                      <div className="flex gap-3 mb-8">
                          <input className="flex-1 bg-gray-50 dark:bg-black/50 p-4 rounded-2xl outline-none dark:text-white" placeholder="Category Name" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                          <button onClick={addCategory} className="bg-black dark:bg-white text-white dark:text-black px-6 rounded-2xl font-bold"><Plus/></button>
                      </div>
                      <div className="space-y-2">
                          {categories.map(cat => (
                              <div key={cat.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-black/30 rounded-2xl">
                                  <span className="font-medium dark:text-white">{cat.name}</span>
                                  <button onClick={() => setDeleteConfirm({type: 'cat', id: cat.id})} className="text-red-500 bg-white dark:bg-[#1C1C1E] p-2 rounded-xl shadow-sm hover:bg-red-50 transition-colors"><Trash2 size={16}/></button>
                              </div>
                          ))}
                      </div>
                 </motion.div>
            )}

            {activeTab === 'settings' && (
                <motion.div key="set" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto bg-white dark:bg-[#1C1C1E] p-8 rounded-3xl shadow-ios border border-white/5">
                    <h3 className="font-bold text-2xl mb-6 dark:text-white">Config</h3>
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-black/50 p-4 rounded-2xl space-y-4">
                            <h4 className="font-bold text-gray-500 text-sm">Interface</h4>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">App Name</label>
                                <input className="w-full bg-white dark:bg-[#1C1C1E] p-3 rounded-xl text-sm font-medium outline-none dark:text-white" value={settings.appName} onChange={e => setSettings({...settings, appName: e.target.value})} placeholder="File Share Pro" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">Hero Title</label>
                                <input className="w-full bg-white dark:bg-[#1C1C1E] p-3 rounded-xl text-sm font-medium outline-none dark:text-white" value={settings.heroTitle} onChange={e => setSettings({...settings, heroTitle: e.target.value})} placeholder="Premium Files" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">Hero Subtitle</label>
                                <input className="w-full bg-white dark:bg-[#1C1C1E] p-3 rounded-xl text-sm font-medium outline-none dark:text-white" value={settings.heroSubtitle} onChange={e => setSettings({...settings, heroSubtitle: e.target.value})} placeholder="Unlock exclusive content..." />
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-black/50 p-4 rounded-2xl space-y-4">
                            <h4 className="font-bold text-gray-500 text-sm">Monetag Integration</h4>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">Zone ID</label>
                                <input className="w-full bg-white dark:bg-[#1C1C1E] p-3 rounded-xl font-mono text-sm outline-none dark:text-white" value={settings.monetagZoneId} onChange={e => setSettings({...settings, monetagZoneId: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">Script URL</label>
                                <input className="w-full bg-white dark:bg-[#1C1C1E] p-3 rounded-xl font-mono text-sm outline-none dark:text-white" value={settings.monetagScriptUrl} onChange={e => setSettings({...settings, monetagScriptUrl: e.target.value})} />
                            </div>
                        </div>

                        <button onClick={saveSettings} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-transform">Save Changes</button>
                    </div>
                </motion.div>
            )}
          </AnimatePresence>
      </main>
      
      <AnimatePresence>
          {deleteConfirm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-white dark:bg-[#1C1C1E] p-6 rounded-3xl w-full max-w-sm text-center shadow-2xl border border-white/10">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertTriangle size={32} />
                      </div>
                      <h3 className="font-bold text-xl mb-2 dark:text-white">Confirm Deletion</h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-6">Are you sure you want to delete this item? This action cannot be undone.</p>
                      <div className="flex gap-3">
                          <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-gray-100 dark:bg-white/10 rounded-xl font-bold dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">Cancel</button>
                          <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/30 hover:bg-red-700 transition-colors">Delete</button>
                      </div>
                  </motion.div>
              </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;