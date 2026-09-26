import React from 'react';
import {
  AlertTriangle,
  Trash2,
  Cloud,
  Database,
  RotateCcw,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';

interface ResetDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGoogleSheetConnected: boolean;
  gasUrl?: string;
  patientCount: number;
  followUpCount: number;
  lang: 'ar' | 'en';
  isResetting: boolean;
  onConfirmReset: (includeCloud: boolean) => void;
}

export const ResetDatabaseModal: React.FC<ResetDatabaseModalProps> = ({
  isOpen,
  onClose,
  isGoogleSheetConnected,
  gasUrl,
  patientCount,
  followUpCount,
  lang,
  isResetting,
  onConfirmReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1c1c1c] border border-rose-900/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#171717]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'تفريغ قاعدة البيانات وحذف السجلات' : 'Reset & Empty Database'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  {lang === 'ar' ? 'إجراء لا رجعة فيه' : 'Irreversible Action'}
                </span>
              </h2>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {lang === 'ar'
                  ? `السجلات الحالية: ${patientCount} مريض • ${followUpCount} متابعة سريرية`
                  : `Current Data: ${patientCount} patients • ${followUpCount} follow-ups`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Warning Message */}
          <p className="text-neutral-300 leading-relaxed">
            {lang === 'ar'
              ? 'هل ترغب في تفريغ قاعدة البيانات والبدء بحساب نظيف تماماً بدون أية سجلات سابقة؟'
              : 'Do you want to clear all records and start with a completely empty database?'}
          </p>

          {/* Cloud Sheet Status Warning Box */}
          {isGoogleSheetConnected ? (
            <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-700/50 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <Cloud className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{lang === 'ar' ? '⚠️ تنبيه المزامنة السحابية (Google Sheet متصل)' : '⚠️ Cloud Sync Alert (Google Sheet is Linked)'}</span>
              </div>
              <p className="text-neutral-300 text-[11px] leading-relaxed">
                {lang === 'ar'
                  ? 'الموقع مربوط حالياً بشيت Google Sheet. إذا قمت بمسح الموقع فقط دون تفريغ الشيت، فستتم استعادة البيانات السابقة تلقائياً بمجرد الضغط على زر المزامنة أو أثناء الفحص الدوري.'
                  : 'The app is linked to a Google Sheet. If you only clear the website, the previous data will be restored automatically on the next sync.'}
              </p>
              <div className="p-2.5 bg-black/40 rounded-lg border border-amber-600/30 text-[11px] text-amber-200/90 font-medium">
                💡 {lang === 'ar'
                  ? 'لضمان بقاء الموقع فارغاً 100% حتى بعد المزامنة، يُنصح باختيار "تفريغ شامل (الموقع + Google Sheet)".'
                  : 'To guarantee the website stays 100% empty even after syncing, choose "Full Reset (Website + Google Sheet)".'}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40 text-[11px] text-blue-200/90 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                {lang === 'ar'
                  ? 'سيتم مسح كافة بيانات المرضى، المتابعات، وقوائم العلاج من الذاكرة المحلية للمتصفح وتفريغ الموقع تماماً.'
                  : 'All patient profiles, refills, and clinical follow-ups will be cleared from local storage.'}
              </span>
            </div>
          )}

          {/* Action Choices */}
          <div className="space-y-2.5 pt-1">
            {isGoogleSheetConnected ? (
              <>
                {/* Option 1: Full Reset (Cloud + Local) */}
                <button
                  type="button"
                  onClick={() => onConfirmReset(true)}
                  disabled={isResetting}
                  className="w-full text-right p-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-lg shadow-rose-950/40 border border-rose-500 flex items-start gap-3 group disabled:opacity-60 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-rose-700/80 text-white shrink-0 mt-0.5">
                    {isResetting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-black flex items-center justify-between">
                      <span>{lang === 'ar' ? '🔥 تفريغ شامل (الموقع + Google Sheet سحابياً)' : '🔥 Full Reset (Website + Google Sheet)'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white font-mono font-normal">
                        {lang === 'ar' ? 'موصى به' : 'Recommended'}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-100/90 font-normal mt-1 leading-relaxed">
                      {lang === 'ar'
                        ? 'يمسح بيانات الموقع ويفرغ جداول Google Sheet فوراً لتبقى قاعدة البيانات فارغة تماماً حتى مع استمرار المزامنة.'
                        : 'Wipes all local records and clears rows from Google Sheet so future syncs remain empty.'}
                    </p>
                  </div>
                </button>

                {/* Option 2: Local Reset Only */}
                <button
                  type="button"
                  onClick={() => onConfirmReset(false)}
                  disabled={isResetting}
                  className="w-full text-right p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 transition-all flex items-start gap-3 disabled:opacity-60 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-neutral-800 text-neutral-300 shrink-0 mt-0.5">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-neutral-100">
                      {lang === 'ar' ? '🧹 تفريغ الموقع فقط (محلياً)' : '🧹 Clear Website Only (Local)'}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                      {lang === 'ar'
                        ? 'يمسح ذاكرة المتصفح فقط. ستبقى سجلات Google Sheet كما هي (وستتم استعادتها للموقع عند المزامنة القادمة).'
                        : 'Clears browser memory only. Google Sheet records remain and will be restored upon next sync.'}
                    </p>
                  </div>
                </button>
              </>
            ) : (
              /* Single clear button for standalone / non-cloud users */
              <button
                type="button"
                onClick={() => onConfirmReset(false)}
                disabled={isResetting}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isResetting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{lang === 'ar' ? 'تأكيد تفريغ كافة بيانات الموقع' : 'Confirm Empty Database'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#171717] border-t border-[#383838] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء وتراجع' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
