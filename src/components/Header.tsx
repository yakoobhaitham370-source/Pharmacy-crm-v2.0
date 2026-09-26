import React from 'react';
import { RefreshCw, Globe, Sun, Moon, Plus, Stethoscope, CloudCheck, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  pharmacyName: string;
  currentTime: string;
  syncStatus: 'synced' | 'syncing' | 'error' | 'idle';
  syncMessage: string;
  onSync: () => void;
  lang: 'ar' | 'en';
  onToggleLang: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenNewPatient: () => void;
  onOpenNewFollowUp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pharmacyName,
  currentTime,
  syncStatus,
  syncMessage,
  onSync,
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  onOpenNewPatient,
  onOpenNewFollowUp,
}) => {
  return (
    <header className="h-16 bg-[#1f1f1f] light:bg-white border-b border-[#383838] light:border-neutral-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md shadow-md">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0f6cbd] to-[#479ef5] flex items-center justify-center text-white font-extrabold text-lg shadow-sm shadow-blue-900/40">
          Rx
        </div>
        <div>
          <div className="font-extrabold text-base tracking-tight text-white light:text-neutral-900 flex items-center gap-2">
            <span>PharmPulse Enterprise</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950/80 light:bg-blue-100 text-blue-400 light:text-blue-800 border border-blue-800/40">
              Clinical CRM
            </span>
          </div>
          <div className="text-xs text-neutral-400 light:text-neutral-500 font-medium">
            {pharmacyName || (lang === 'ar' ? 'صيدلية النبض السريرية' : 'Clinical Pharmacy Engine')}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Clock */}
        <div className="hidden sm:flex font-mono text-xs font-semibold px-2.5 py-1.5 rounded bg-[#292929] light:bg-neutral-100 text-blue-400 light:text-blue-600 border border-[#383838] light:border-neutral-300">
          {currentTime}
        </div>

        {/* Sync Status Badge */}
        <button
          onClick={onSync}
          title={lang === 'ar' ? 'انقر للمزامنة الفورية مع Google Sheet' : 'Click to sync with Google Sheet'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            syncStatus === 'syncing'
              ? 'bg-blue-950/40 border-blue-500 text-blue-400'
              : syncStatus === 'synced'
              ? 'bg-emerald-950/30 border-emerald-600 text-emerald-400'
              : 'bg-neutral-800 light:bg-neutral-100 border-[#383838] text-neutral-300 light:text-neutral-700 hover:border-blue-500'
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-blue-400' : ''}`}
          />
          <span className="hidden md:inline">{syncMessage}</span>
        </button>

        {/* Quick Add Patient */}
        <button
          onClick={onOpenNewPatient}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0f6cbd] hover:bg-[#115ea3] text-white transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{lang === 'ar' ? 'مريض جديد' : 'New Patient'}</span>
        </button>

        {/* Quick Add Follow-up */}
        <button
          onClick={onOpenNewFollowUp}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e3a5f] hover:bg-[#284b77] text-blue-300 border border-[#0f6cbd]/40 transition-colors"
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'متابعة سريرية' : 'New Follow-Up'}</span>
        </button>

        {/* Language Toggle */}
        <button
          onClick={onToggleLang}
          title={lang === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#292929] light:bg-neutral-100 text-neutral-200 light:text-neutral-800 border border-[#383838] light:border-neutral-300 hover:bg-[#333333] transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="p-1.5 rounded-lg text-neutral-300 light:text-neutral-700 bg-[#292929] light:bg-neutral-100 border border-[#383838] light:border-neutral-300 hover:bg-[#333333] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
        </button>
      </div>
    </header>
  );
};
