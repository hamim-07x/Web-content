export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface FileItem {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  downloadLink: string;
  directLink?: string; // Optional direct link for the link icon
  categoryId: string;
  isPremium: boolean; // If true, requires ad watch
  adsRequired?: number; // Number of ads to watch before unlock (default 1)
  badgeText?: string;
  actionType?: 'download' | 'subscribe'; // Default is 'download'
}

export interface AppSettings {
  id: string; // usually 'general'
  monetagZoneId?: string; // e.g. "10174286"
  monetagScriptUrl?: string; // e.g. "//libtl.com/sdk.js"
  adminTitle: string;
  welcomeMessage: string;
  // Dynamic App Text
  appName?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  // Deprecated
  gigaPubId?: string; 
}

// Extend window interface for Dynamic Ad Functions
declare global {
  interface Window {
    [key: string]: any; // Allow dynamic access like window['show_12345']
  }
}