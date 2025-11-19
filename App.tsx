import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import UserView from './components/UserView';
// AdminPanel import removed as it is now standalone
import { doc, getDoc } from 'firebase/firestore';
import { AppSettings } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Default Settings
  const [settings, setSettings] = useState<AppSettings>({
    id: 'general',
    monetagZoneId: "10174286",
    monetagScriptUrl: "//libtl.com/sdk.js",
    adminTitle: "Control Center",
    welcomeMessage: "Welcome",
    appName: "Tech By Rubel",
    heroTitle: "Premium Files",
    heroSubtitle: "Unlock exclusive content freely"
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Fetch dynamic Settings on load
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as AppSettings;
          // Merge defaults with fetched data to ensure all fields exist
          setSettings(prev => ({
            ...prev,
            ...data,
            // Ensure fallbacks if fields are empty strings in DB
            monetagZoneId: data.monetagZoneId || "10174286",
            monetagScriptUrl: data.monetagScriptUrl || "//libtl.com/sdk.js"
          }));
          
          // Inject Monetag Script Dynamically
          const zoneId = data.monetagZoneId || "10174286";
          const scriptUrl = data.monetagScriptUrl || "//libtl.com/sdk.js";
          
          // Remove existing script if any
          const oldScript = document.getElementById('monetag-script');
          if (oldScript) oldScript.remove();

          const script = document.createElement('script');
          script.id = 'monetag-script';
          script.src = scriptUrl;
          script.setAttribute('data-zone', zoneId);
          script.setAttribute('data-sdk', `show_${zoneId}`);
          document.head.appendChild(script);
        } else {
             // Fallback injection if no settings doc
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
    };
    fetchSettings();

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen bg-[#F2F2F7] dark:bg-black text-slate-900 dark:text-white">Loading...</div>;

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-black text-slate-900 dark:text-white font-sans transition-colors duration-300">
        <Routes>
          <Route path="/" element={<UserView settings={settings} />} />
          {/* Admin route removed */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;