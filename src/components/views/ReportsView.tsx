import React, { useMemo } from 'react';
import { LineChart, Award, Heart, Activity, CheckCircle2, TrendingUp } from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculatePDC } from '../../utils/pharmacyCalculations';

interface ReportsViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
}

export const ReportsView: React.FC<ReportsViewProps> = ({ patients, lang }) => {
  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  const { avgPdc, totalPoints, highPdcCount, lowPdcCount, fullBoxesCount } = useMemo(() => {
    let totalPdcSum = 0;
    let pointsSum = 0;
    let high = 0;
    let low = 0;
    let fullBoxes = 0;

    activePatients.forEach(p => {
      const pdc = calculatePDC(p);
      totalPdcSum += pdc;
      pointsSum += Number(p.loyaltyPoints) || 0;
      if (pdc >= 80) high++;
      else low++;

      (p.medications || []).forEach(m => {
        if (Number(m.daysSupply) >= 30) fullBoxes++;
      });
    });

    const avg = activePatients.length > 0 ? Math.round(totalPdcSum / activePatients.length) : 100;
    return {
      avgPdc: avg,
      totalPoints: pointsSum,
      highPdcCount: high,
      lowPdcCount: low,
      fullBoxesCount: fullBoxes,
    };
  }, [activePatients]);

  // Extract recent BP and Sugar readings across patients for interactive visual graphs
  const clinicalVitalsPoints = useMemo(() => {
    const list: { name: string; bp: string; sys: number; dia: number; sugar: number; date: string }[] = [];
    activePatients.forEach(p => {
      (p.vitals || []).forEach(v => {
        const parts = (v.bp || '').split('/');
        const sys = parseInt(parts[0], 10);
        const dia = parseInt(parts[1], 10);
        const sugarVal = parseInt(v.sugar || '', 10);
        if (!isNaN(sys) && !isNaN(dia)) {
          list.push({
            name: p.name,
            bp: v.bp,
            sys,
            dia,
            sugar: isNaN(sugarVal) ? 110 : sugarVal,
            date: v.date,
          });
        }
      });
    });
    return list.slice(0, 10);
  }, [activePatients]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 light:text-neutral-500 uppercase tracking-wider">
              {lang === 'ar' ? 'متوسط الالتزام الدوائي العام (PDC)' : 'Average Proportion of Days Covered'}
            </span>
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">{avgPdc}%</div>
          <div className="text-xs text-neutral-400 mt-1">
            {lang === 'ar' ? `${highPdcCount} مريض ملتزم (≥80%) مقابل ${lowPdcCount} بحاجة لدعم` : `${highPdcCount} adherent vs ${lowPdcCount} at-risk`}
          </div>
        </div>

        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 light:text-neutral-500 uppercase tracking-wider">
              {lang === 'ar' ? 'نقاط الولاء الممنوحة' : 'Total Loyalty Stars Awarded'}
            </span>
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">⭐ {totalPoints}</div>
          <div className="text-xs text-neutral-400 mt-1">
            {lang === 'ar' ? 'مكافآت التكرار المنتظم والصرف الفصلي' : 'Rewarded for timely adherence'}
          </div>
        </div>

        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 left-0 h-1 bg-blue-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 light:text-neutral-500 uppercase tracking-wider">
              {lang === 'ar' ? 'صرف شهري كامل (Full Boxes)' : '30+ Day Dispensing Events'}
            </span>
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-blue-400 mt-2">{fullBoxesCount}</div>
          <div className="text-xs text-neutral-400 mt-1">
            {lang === 'ar' ? 'وصفات تم تغطيتها لشهر كامل فأكثر' : 'Sustained full-pack supply'}
          </div>
        </div>
      </div>

      {/* Interactive Clinical Vitals Trajectory Chart (SVG) */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-bold text-base text-white light:text-neutral-900 flex items-center gap-2">
            <LineChart className="w-5 h-5 text-blue-400" />
            <span>{lang === 'ar' ? 'منحنى مؤشرات ضغط الدم وسكر الدم لعينات المرضى' : 'Clinical Blood Pressure & Glycemic Trajectory'}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span>Systolic (الانقباضي)</span>
            </span>
            <span className="flex items-center gap-1.5 text-teal-400">
              <span className="w-3 h-3 rounded-full bg-teal-400 inline-block" />
              <span>Diastolic (الانبساطي)</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span>Sugar (السكر)</span>
            </span>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full bg-[#141414] light:bg-neutral-50 p-4 rounded-lg border border-[#2e2e2e] light:border-neutral-200 overflow-x-auto">
          {clinicalVitalsPoints.length === 0 ? (
            <div className="text-center py-10 text-neutral-400 text-xs">
              {lang === 'ar' ? 'سجل قراءات العلامات الحيوية في الملفات السريرية لعرض المنحنى البياني هنا.' : 'No recorded vitals yet.'}
            </div>
          ) : (
            <div className="min-w-[600px] h-64 flex flex-col justify-between relative">
              {/* Target threshold reference lines */}
              <div className="absolute top-[35%] left-0 right-0 border-b border-rose-500/30 border-dashed flex justify-end">
                <span className="text-[10px] text-rose-400 bg-[#141414] px-1">Goal BP: 130/80</span>
              </div>

              {/* Data points visualization */}
              <div className="h-48 flex items-end justify-between px-6 gap-4">
                {clinicalVitalsPoints.map((pt, i) => {
                  const sysHeight = Math.min(100, Math.max(10, ((pt.sys - 80) / 100) * 100));
                  const diaHeight = Math.min(100, Math.max(10, ((pt.dia - 40) / 80) * 100));
                  const sugarHeight = Math.min(100, Math.max(10, ((pt.sugar - 70) / 150) * 100));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="text-[10px] text-neutral-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        {pt.bp}
                      </div>
                      <div className="w-full flex items-end justify-center gap-1.5 h-36">
                        {/* Systolic Bar */}
                        <div
                          style={{ height: `${sysHeight}%` }}
                          className="w-2.5 bg-blue-500 rounded-t transition-all group-hover:brightness-125"
                          title={`Systolic: ${pt.sys} mmHg`}
                        />
                        {/* Diastolic Bar */}
                        <div
                          style={{ height: `${diaHeight}%` }}
                          className="w-2.5 bg-teal-400 rounded-t transition-all group-hover:brightness-125"
                          title={`Diastolic: ${pt.dia} mmHg`}
                        />
                        {/* Sugar Bar */}
                        <div
                          style={{ height: `${sugarHeight}%` }}
                          className="w-2.5 bg-amber-400 rounded-t transition-all group-hover:brightness-125"
                          title={`Sugar: ${pt.sugar} mg/dL`}
                        />
                      </div>
                      <div className="text-[11px] font-bold text-neutral-300 truncate max-w-[80px] text-center">
                        {pt.name.split(' ')[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
