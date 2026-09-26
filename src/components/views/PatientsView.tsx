import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  FileText,
  Archive,
  Star,
  Filter,
  Download,
  Phone,
  LineChart,
  X,
} from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculatePDC } from '../../utils/pharmacyCalculations';
import { useDebounce } from '../../utils/useDebounce';

interface PatientsViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onOpenPatientModal: (patientId?: string, tab?: string) => void;
  onOpenHouseholdModal: (familyTag: string) => void;
  onArchivePatient: (patientId: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  // Global search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onClearSearch?: () => void;
  debouncedSearchQuery?: string;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  patients,
  lang,
  onOpenPatientModal,
  onOpenHouseholdModal,
  onArchivePatient,
  onShowToast,
  searchQuery,
  onSearchChange,
  onClearSearch,
  debouncedSearchQuery: externalDebouncedQuery,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const debouncedLocal = useDebounce(localSearch, 250);

  const effectiveSearch = searchQuery !== undefined ? searchQuery : localSearch;
  const effectiveDebouncedSearch =
    externalDebouncedQuery !== undefined ? externalDebouncedQuery : debouncedLocal;

  const handleSearchInput = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setLocalSearch(val);
    }
  };

  const handleClear = () => {
    if (onClearSearch) {
      onClearSearch();
    } else {
      setLocalSearch('');
    }
  };

  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [adherenceFilter, setAdherenceFilter] = useState('ALL');

  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  const uniqueFamilies = useMemo(() => {
    const set = new Set<string>();
    activePatients.forEach(p => {
      if (p.familyTag && p.familyTag.trim()) set.add(p.familyTag.trim());
    });
    return Array.from(set);
  }, [activePatients]);

  const filteredPatients = useMemo(() => {
    return activePatients.filter(p => {
      const q = effectiveDebouncedSearch.toLowerCase().trim();
      const digitsOnly = q.replace(/\D/g, '');

      const phoneRaw = p.phone || '';
      const phoneDigits = phoneRaw.replace(/\D/g, '');
      const matchPhone =
        phoneRaw.toLowerCase().includes(q) ||
        (digitsOnly.length >= 2 && phoneDigits.includes(digitsOnly));

      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        matchPhone ||
        p.id.toLowerCase().includes(q) ||
        (p.familyTag && p.familyTag.toLowerCase().includes(q)) ||
        (p.medications || []).some(m => m.name.toLowerCase().includes(q));

      const matchFamily =
        familyFilter === 'ALL' ||
        (familyFilter === 'NO_FAMILY' && !p.familyTag) ||
        p.familyTag === familyFilter;

      const pdc = calculatePDC(p);
      const matchAdherence =
        adherenceFilter === 'ALL' ||
        (adherenceFilter === 'HIGH' && pdc >= 80) ||
        (adherenceFilter === 'LOW' && pdc < 80);

      return matchSearch && matchFamily && matchAdherence;
    });
  }, [activePatients, effectiveDebouncedSearch, familyFilter, adherenceFilter]);

  const handleExportCSV = () => {
    const headers = ['ID,Name,Phone,FamilyTag,Age,LoyaltyPoints,PDC,MedicationsCount'];
    const rows = filteredPatients.map(p =>
      `"${p.id}","${p.name}","${p.phone}","${p.familyTag || ''}","${p.age || ''}","${p.loyaltyPoints || 0}","${calculatePDC(p)}%","${(p.medications || []).length}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PharmPulse_Patients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    onShowToast(lang === 'ar' ? 'تم تصدير سجل المرضى إلى ملف CSV' : 'Exported patients CSV', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-extrabold text-lg text-white light:text-neutral-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span>{lang === 'ar' ? 'دليل المرضى وسجلات العوائل المشتركة' : 'Patients Directory & Family Registry'}</span>
            </div>
            <div className="text-xs text-neutral-400 light:text-neutral-500 mt-1">
              {lang === 'ar'
                ? `إجمالي ${activePatients.length} ملف نشط، مقسمين على ${uniqueFamilies.length} عائلة مسجلة`
                : `${activePatients.length} active chronic patients across ${uniqueFamilies.length} families`}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
            </button>
            <button
              onClick={() => onOpenPatientModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0f6cbd] hover:bg-[#115ea3] text-white shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تسجيل مريض جديد' : 'New Patient'}</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث بالاسم، الهاتف، الدواء...' : 'Search name, phone, drug...'}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg px-8 py-2.5 outline-none focus:border-blue-500 pr-9"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute left-3 top-3 text-neutral-400 hover:text-white transition-colors"
                title={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Family Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400 shrink-0" />
            <select
              value={familyFilter}
              onChange={e => setFamilyFilter(e.target.value)}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
            >
              <option value="ALL">{lang === 'ar' ? 'كل العوائل والأفراد' : 'All Families'}</option>
              <option value="NO_FAMILY">{lang === 'ar' ? 'المرضى بدون عائلة مسجلة' : 'Individual (No family)'}</option>
              {uniqueFamilies.map(f => (
                <option key={f} value={f}>
                  👨‍👩‍👧‍👦 {f}
                </option>
              ))}
            </select>
          </div>

          {/* Adherence Filter */}
          <select
            value={adherenceFilter}
            onChange={e => setAdherenceFilter(e.target.value)}
            className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
          >
            <option value="ALL">{lang === 'ar' ? 'جميع مستويات الالتزام' : 'All Adherence Levels'}</option>
            <option value="HIGH">{lang === 'ar' ? 'ملتزمون ممتازون (PDC ≥ 80%)' : 'High Adherence (≥80%)'}</option>
            <option value="LOW">{lang === 'ar' ? 'معرضون للخطر (PDC < 80%)' : 'Low Adherence (<80%)'}</option>
          </select>
        </div>
      </div>

      {/* Active Search Filter Banner */}
      {effectiveDebouncedSearch.trim() && (
        <div className="bg-blue-950/40 light:bg-blue-50 border border-blue-800/60 light:border-blue-300 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-blue-300 light:text-blue-900 font-medium">
            <Search className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              {lang === 'ar'
                ? `تصفية نشطة للبحث عن: «${effectiveDebouncedSearch}» (${filteredPatients.length} مريض مطابق)`
                : `Active filter for: "${effectiveDebouncedSearch}" (${filteredPatients.length} matching)`}
            </span>
          </div>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-900/60 light:bg-blue-200 hover:bg-blue-900 light:hover:bg-blue-300 text-blue-200 light:text-blue-900 border border-blue-700/50 light:border-blue-400 text-[11px] font-bold transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>{lang === 'ar' ? 'إلغاء التصفية' : 'Clear Filter'}</span>
          </button>
        </div>
      )}


      {/* Patients Table */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs">
            <thead className="bg-[#292929] light:bg-neutral-100 text-neutral-300 light:text-neutral-700 font-bold border-b border-[#383838]">
              <tr>
                <th className="py-3 px-4">{lang === 'ar' ? 'المعرف' : 'ID'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'اسم المريض' : 'Patient Name'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'العمر / الجنس' : 'Age / Sex'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'رمز العائلة' : 'Family Tag'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'الأدوية النشطة' : 'Active Meds'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الالتزام (PDC)' : 'Adherence'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'نقاط الولاء' : 'Loyalty'}</th>
                <th className="py-3 px-4 text-center">{lang === 'ar' ? 'إدارة الملف' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e2e2e] light:divide-neutral-200 text-neutral-200 light:text-neutral-800">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-neutral-400">
                    {lang === 'ar' ? 'لا يوجد مرضى مطابقين لشروط البحث.' : 'No matching patients found.'}
                  </td>
                </tr>
              ) : (
                filteredPatients.map(p => {
                  const pdc = calculatePDC(p);
                  return (
                    <tr key={p.id} className="hover:bg-neutral-800/40 light:hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-400 text-[11px]">{p.id}</td>
                      <td className="py-3 px-4 font-bold text-white light:text-neutral-900">
                        <button
                          onClick={() => onOpenPatientModal(p.id)}
                          className="hover:text-blue-400 text-right hover:underline transition-colors"
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-neutral-300 light:text-neutral-700">
                        {p.age ? `${p.age} سنة` : '—'} / {p.gender || '—'}
                      </td>
                      <td className="py-3 px-3">
                        {p.familyTag ? (
                          <button
                            onClick={() => onOpenHouseholdModal(p.familyTag!)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/60 text-blue-300 border border-blue-700/50 hover:bg-blue-900 transition-colors cursor-pointer"
                          >
                            <span>👨‍👩‍👧‍👦</span>
                            <span>{p.familyTag}</span>
                          </button>
                        ) : (
                          <span className="text-neutral-500 text-[11px]">فردي</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-neutral-300 light:text-neutral-700">
                        {p.phone}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white light:text-neutral-900">
                          {(p.medications || []).length} {lang === 'ar' ? 'أدوية' : 'meds'}
                        </span>
                        <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                          {(p.medications || []).map(m => m.name).join(', ')}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block font-extrabold px-2 py-0.5 rounded text-[11px] ${
                            pdc >= 80
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-700/50'
                          }`}
                        >
                          {pdc}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-950/50 border border-amber-800/40 px-2 py-0.5 rounded text-[11px]">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{p.loyaltyPoints || 0}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenPatientModal(p.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors font-semibold"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'الملف' : 'Dossier'}</span>
                          </button>
                          <button
                            onClick={() => onOpenPatientModal(p.id, 'analytics')}
                            title={lang === 'ar' ? 'عرض مخطط الالتزام والمؤشرات الحيوية' : 'View Adherence & Vitals Chart'}
                            className="p-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 transition-colors"
                          >
                            <LineChart className="w-3.5 h-3.5 text-indigo-400" />
                          </button>
                          {p.familyTag && (
                            <button
                              onClick={() => onOpenHouseholdModal(p.familyTag!)}
                              title={lang === 'ar' ? 'توحيد صرف العائلة' : 'Household Sync'}
                              className="p-1.5 rounded-lg bg-blue-950 text-blue-300 border border-blue-800 hover:bg-blue-900 transition-colors"
                            >
                              👨‍👩‍👧‍👦
                            </button>
                          )}
                          <button
                            onClick={() => onArchivePatient(p.id)}
                            title={lang === 'ar' ? 'تحويل للأرشيف' : 'Archive'}
                            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-rose-400 border border-neutral-700 transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
