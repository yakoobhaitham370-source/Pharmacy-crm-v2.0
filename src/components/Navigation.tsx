import React from 'react';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  BellRing,
  ShieldAlert,
  Boxes,
  LineChart,
  Archive,
  Settings as SettingsIcon,
} from 'lucide-react';

export type ViewType =
  | 'dashboard'
  | 'patients'
  | 'followup'
  | 'timeline'
  | 'safety'
  | 'inventory'
  | 'reports'
  | 'archive'
  | 'settings';

interface NavigationProps {
  activeView: ViewType;
  onSelectView: (view: ViewType) => void;
  dueRefillsCount: number;
  activeFollowUpsCount: number;
  criticalSafetyCount: number;
  lang: 'ar' | 'en';
}

export const Navigation: React.FC<NavigationProps> = ({
  activeView,
  onSelectView,
  dueRefillsCount,
  activeFollowUpsCount,
  criticalSafetyCount,
  lang,
}) => {
  const navItems: {
    id: ViewType;
    labelAr: string;
    labelEn: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'dashboard',
      labelAr: 'لوحة التحكم',
      labelEn: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'patients',
      labelAr: 'المرضى والعائلات',
      labelEn: 'Patients & Families',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'followup',
      labelAr: 'المتابعة السريرية والمضادات',
      labelEn: 'Clinical Follow-Up',
      icon: <Stethoscope className="w-4 h-4" />,
      badge: activeFollowUpsCount,
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    },
    {
      id: 'timeline',
      labelAr: 'جدول المواعيد والمراجعات',
      labelEn: 'Refill Timeline',
      icon: <BellRing className="w-4 h-4" />,
      badge: dueRefillsCount,
      badgeColor: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    },
    {
      id: 'safety',
      labelAr: 'رادار السلامة والـ AI',
      labelEn: 'Safety Radar & AI',
      icon: <ShieldAlert className="w-4 h-4" />,
      badge: criticalSafetyCount > 0 ? criticalSafetyCount : undefined,
      badgeColor: 'bg-red-600/20 text-red-400 border border-red-500/40',
    },
    {
      id: 'inventory',
      labelAr: 'توقع الطلب والمخزون',
      labelEn: 'Demand Forecast',
      icon: <Boxes className="w-4 h-4" />,
    },
    {
      id: 'reports',
      labelAr: 'التقارير ومؤشرات السريرية',
      labelEn: 'Reports & Vitals',
      icon: <LineChart className="w-4 h-4" />,
    },
    {
      id: 'archive',
      labelAr: 'الأرشيف',
      labelEn: 'Archive',
      icon: <Archive className="w-4 h-4" />,
    },
    {
      id: 'settings',
      labelAr: 'الإعدادات والربط',
      labelEn: 'Settings & Sync',
      icon: <SettingsIcon className="w-4 h-4" />,
    },
  ];

  return (
    <nav className="bg-[#1f1f1f] light:bg-white border-b border-[#383838] light:border-neutral-200 px-4 md:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none sticky top-16 z-30 shadow-sm">
      {navItems.map(item => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              isActive
                ? 'border-[#479ef5] text-[#479ef5] bg-[#292929]/50 light:bg-blue-50/50'
                : 'border-transparent text-neutral-400 light:text-neutral-600 hover:text-white light:hover:text-black hover:bg-neutral-800/40'
            }`}
          >
            {item.icon}
            <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  item.badgeColor || 'bg-neutral-700 text-neutral-200'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
