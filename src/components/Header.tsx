import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Globe,
  Sun,
  Moon,
  Plus,
  Stethoscope,
  Search,
  X,
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  Pill,
  Sparkles,
  Command,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Patient } from '../types/pharmacy';
import { calculatePDC } from '../utils/pharmacyCalculations';

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

  // Global Search Props
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  matchingPatients: Patient[];
  isDebouncing?: boolean;
  onSelectPatient: (patientId: string) => void;
  onViewAllResults: () => void;
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
  searchQuery,
  onSearchChange,
  onClearSearch,
  matchingPatients,
  isDebouncing = false,
  onSelectPatient,
  onViewAllResults,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts (Ctrl+K or Cmd+K or '/') to focus global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsDropdownOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsDropdownOpen(true);
      } else if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onViewAllResults();
      setIsDropdownOpen(false);
    }
  };

  const hasSearchText = searchQuery.trim().length > 0;
  const isArabic = lang === 'ar';
  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;

  return (
    <header className="h-16 bg-[#1f1f1f] light:bg-white border-b border-[#383838] light:border-neutral-200 px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 md:gap-4 sticky top-0 z-40 backdrop-blur-md shadow-md">
      {/* Brand */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-[#0f6cbd] to-[#479ef5] flex items-center justify-center text-white font-extrabold text-base sm:text-lg shadow-sm shadow-blue-900/40 shrink-0">
          Rx
        </div>
        <div className="hidden sm:block">
          <div className="font-extrabold text-sm sm:text-base tracking-tight text-white light:text-neutral-900 flex items-center gap-2">
            <span>PharmPulse</span>
            <span className="hidden md:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950/80 light:bg-blue-100 text-blue-400 light:text-blue-800 border border-blue-800/40">
              Clinical CRM
            </span>
          </div>
          <div className="text-[11px] sm:text-xs text-neutral-400 light:text-neutral-500 font-medium truncate max-w-[140px] md:max-w-none">
            {pharmacyName || (isArabic ? 'صيدلية النبض السريرية' : 'Clinical Pharmacy Engine')}
          </div>
        </div>
      </div>

      {/* Global Real-Time Search Bar */}
      <div
        ref={searchContainerRef}
        className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg relative mx-1 sm:mx-2"
      >
        <div
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs transition-all ${
            isDropdownOpen && hasSearchText
              ? 'bg-[#181818] light:bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
              : 'bg-[#141414] light:bg-neutral-100 border-[#383838] light:border-neutral-300 hover:border-neutral-500'
          }`}
        >
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 shrink-0" />
          
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => {
              onSearchChange(e.target.value);
              if (!isDropdownOpen) setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (hasSearchText) setIsDropdownOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isArabic
                ? 'بحث فوري عن مريض بالاسم أو الهاتف... (Ctrl+K)'
                : 'Search patient by name or phone... (Ctrl+K)'
            }
            className="w-full bg-transparent text-white light:text-neutral-900 placeholder-neutral-400 light:placeholder-neutral-500 outline-none text-xs"
          />

          {/* Real-time Debouncing Indicator or Shortcut Badge */}
          {isDebouncing ? (
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
          ) : hasSearchText ? (
            <button
              onClick={() => {
                onClearSearch();
                inputRef.current?.focus();
              }}
              title={isArabic ? 'مسح البحث' : 'Clear search'}
              className="p-0.5 rounded-full hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-800 light:bg-neutral-200 text-neutral-400 light:text-neutral-600 border border-neutral-700 light:border-neutral-300 shrink-0">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Real-Time Search Results Dropdown Popover */}
        {isDropdownOpen && hasSearchText && (
          <div className="absolute top-full mt-2 inset-x-0 bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-[#2a2a2a] light:divide-neutral-200 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Dropdown Header */}
            <div className="px-3.5 py-2 bg-[#252525] light:bg-neutral-50 flex items-center justify-between text-[11px]">
              <div className="font-semibold text-neutral-300 light:text-neutral-700 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>
                  {isArabic ? 'نتائج البحث السريع' : 'Real-time Search Results'}
                </span>
                <span className="px-1.5 py-0.2 rounded-full font-bold text-[10px] bg-blue-950 text-blue-400 border border-blue-800/60">
                  {matchingPatients.length} {isArabic ? 'مطابق' : 'found'}
                </span>
              </div>
              <span className="text-[10px] text-neutral-400">
                {isArabic ? 'بحث بالاسم ورقم الهاتف' : 'Matching Name & Phone'}
              </span>
            </div>

            {/* Matching Patient Results List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-[#2a2a2a] light:divide-neutral-100">
              {matchingPatients.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-neutral-800 light:bg-neutral-100 mx-auto flex items-center justify-center text-neutral-400 mb-2">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-xs text-neutral-300 light:text-neutral-700">
                    {isArabic ? 'لا توجد نتائج مطابقة' : 'No patients found'}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1 max-w-xs mx-auto">
                    {isArabic
                      ? `لم نعثر على أي مريض بالاسم أو الهاتف "${searchQuery}". تأكد من صحة الإدخال.`
                      : `No patient matching name or phone "${searchQuery}".`}
                  </div>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenNewPatient();
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0f6cbd] hover:bg-[#115ea3] text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تسجيل مريض جديد بهذا الاسم' : 'Add New Patient'}</span>
                  </button>
                </div>
              ) : (
                matchingPatients.slice(0, 8).map(patient => {
                  const pdc = calculatePDC(patient);
                  return (
                    <div
                      key={patient.id}
                      onClick={() => {
                        onSelectPatient(patient.id);
                        setIsDropdownOpen(false);
                      }}
                      className="p-3 hover:bg-neutral-800/80 light:hover:bg-blue-50/70 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-950/80 light:bg-blue-100 text-blue-400 light:text-blue-700 border border-blue-800/40 flex items-center justify-center font-bold text-xs shrink-0">
                          {patient.name.charAt(0) || <User className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-white light:text-neutral-900 group-hover:text-blue-400 transition-colors">
                              {patient.name}
                            </span>
                            <span className="font-mono text-[10px] text-neutral-400 px-1 rounded bg-neutral-800 light:bg-neutral-200">
                              {patient.id}
                            </span>
                            {patient.familyTag && (
                              <span className="text-[10px] font-semibold text-blue-300 light:text-blue-800 bg-blue-950/60 light:bg-blue-100 border border-blue-800/30 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                <span>👨‍👩‍👧‍👦</span>
                                <span>{patient.familyTag}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-neutral-400 light:text-neutral-500 mt-0.5">
                            <span className="flex items-center gap-1 font-mono text-neutral-300 light:text-neutral-700">
                              <Phone className="w-3 h-3 text-emerald-400" />
                              <span dir="ltr">{patient.phone}</span>
                            </span>
                            {patient.age && (
                              <span>
                                {patient.age} {isArabic ? 'سنة' : 'yrs'}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Pill className="w-3 h-3 text-indigo-400" />
                              <span>
                                {(patient.medications || []).length} {isArabic ? 'أدوية' : 'meds'}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* PDC Badge */}
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                            pdc >= 80
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-700/50'
                          }`}
                        >
                          {pdc}% PDC
                        </span>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-blue-400">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dropdown Footer: View All in Patients Directory */}
            {matchingPatients.length > 0 && (
              <div className="p-2 bg-[#252525] light:bg-neutral-50 flex items-center justify-between">
                <button
                  onClick={() => {
                    onViewAllResults();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-blue-400 hover:text-white hover:bg-[#0f6cbd] light:text-blue-700 light:hover:text-white transition-all flex items-center justify-center gap-2 border border-blue-800/40 hover:border-transparent"
                >
                  <span>
                    {isArabic
                      ? `عرض كافة النتائج (${matchingPatients.length} مريض) في دليل المرضى`
                      : `View all (${matchingPatients.length}) results in Patients Directory`}
                  </span>
                  <ArrowIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
        {/* Clock */}
        <div className="hidden sm:flex font-mono text-xs font-semibold px-2 py-1.5 rounded bg-[#292929] light:bg-neutral-100 text-blue-400 light:text-blue-600 border border-[#383838] light:border-neutral-300">
          {currentTime}
        </div>

        {/* Sync Status Badge */}
        <button
          onClick={onSync}
          title={isArabic ? 'انقر للمزامنة الفورية مع Google Sheet' : 'Click to sync with Google Sheet'}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
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
          <span className="hidden lg:inline">{syncMessage}</span>
        </button>

        {/* Quick Add Patient */}
        <button
          onClick={onOpenNewPatient}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0f6cbd] hover:bg-[#115ea3] text-white transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{isArabic ? 'مريض جديد' : 'New Patient'}</span>
        </button>

        {/* Quick Add Follow-up */}
        <button
          onClick={onOpenNewFollowUp}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e3a5f] hover:bg-[#284b77] text-blue-300 border border-[#0f6cbd]/40 transition-colors"
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>{isArabic ? 'متابعة سريرية' : 'New Follow-Up'}</span>
        </button>

        {/* Language Toggle */}
        <button
          onClick={onToggleLang}
          title={isArabic ? 'Switch to English' : 'التحويل للعربية'}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#292929] light:bg-neutral-100 text-neutral-200 light:text-neutral-800 border border-[#383838] light:border-neutral-300 hover:bg-[#333333] transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{isArabic ? 'EN' : 'عربي'}</span>
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
