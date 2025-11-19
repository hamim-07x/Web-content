import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import UserView from './components/UserView';
import { doc, getDoc } from 'firebase/firestore';
import { AppSettings } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Default Settings (Generic)
  const [settings, setSettings] = useState<AppSettings>({
    id: 'general',
    monetagZoneId: "10174286",
    monetagScriptUrl: "//libtl.com/sdk.js",
    adminTitle: "Control Center",
    welcomeMessage: "Welcome",
    appName: "File Share",
    heroTitle: "Premium Files",
    heroSubtitle: "Unlock exclusive content freely"
  });

  useEffect(() => {
    const initApp = async () => {
      // 1. Fetch Settings
      try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as AppSettings;
          setSettings(prev => ({
            ...prev,
            ...data,
            appName: data.appName || "File Share", // Fallback to generic
            monetagZoneId: data.monetagZoneId || "10174286",
            monetagScriptUrl: data.monetagScriptUrl || "//libtl.com/sdk.js"
          }));
          
          // Inject Monetag Script Dynamically
          const zoneId = data.monetagZoneId || "10174286";
          const scriptUrl = data.monetagScriptUrl || "//libtl.com/sdk.js";
          
          const oldScript = document.getElementById('monetag-script');
          if (oldScript) oldScript.remove();

          const script = document.createElement('script');
          script.id = 'monetag-script';
          script.src = scriptUrl;
          script.setAttribute('data-zone', zoneId);
          script.setAttribute('data-sdk', `show_${zoneId}`);
          document.head.appendChild(script);
        } else {
            // Fallback
            const script = document.createElement('script');
            script.id = 'monetag-script';
            script.src = "//libtl.com/sdk.js";
            script.setAttribute('data-zone', "10174286");
            script.setAttribute('data-sdk', "show_10174286");
            document.head.appendChild(script);
        }
      } catch (e) {
        console.error("Error loading settings", e);
      }

      // 2. Check Auth
      onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        // Add a cinematic delay for the splash screen
        setTimeout(() => setLoading(false), 2000);
      });
    };

    initApp();
  }, []);

  return (
    <div className="bg-[#F2F2F7] dark:bg-black min-h-screen text-slate-900 dark:text-white font-sans transition-colors duration-300">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(15px)', scale: 1.05 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F2F2F7] dark:bg-black overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl opacity-50 animate-pulse"></div>

            <motion.div 
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 100, duration: 1 }}
              className="relative mb-10 z-10"
            >
              <div className="w-28 h-28 bg-black dark:bg-white rounded-[2rem] flex items-center justify-center shadow-2xl relative">
                 <Sparkles className="w-12 h-12 text-white dark:text-black" />
              </div>
            </motion.div>
            
            <motion.h1 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="text-3xl font-black mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-gray-400 relative z-10"
            >
              {settings.appName || "File Share"}
            </motion.h1>
            
            <motion.div 
              className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full w-48 overflow-hidden relative z-10"
            >
                <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.5, duration: 1.5, ease: "easeInOut" }}
                    className="h-full bg-blue-500 rounded-full"
                />
            </motion.div>
          </motion.div>
        ) : (
          <HashRouter>
             <Routes>
                <Route path="/" element={<UserView settings={settings} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
             </Routes>
          </HashRouter>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;