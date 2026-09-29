import React, { useState, useEffect } from 'react';
import { Smartphone, Laptop, Download, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';

export const PWAInstallBanner: React.FC = () => {
  const { isInstalled, isDesktop, installApp } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    // If already installed, never show the banner
    if (isInstalled) {
      setDismissed(true);
      return;
    }

    const dismissedTimestamp = localStorage.getItem('pwa_banner_dismissed_at');
    if (dismissedTimestamp) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTimestamp, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 14) {
        setDismissed(true);
        return;
      }
    }

    // Delay 1.5 seconds after page load before displaying smoothly
    const timer = setTimeout(() => {
      setDismissed(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isInstalled]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa_banner_dismissed_at', Date.now().toString());
  };

  // Do not render if installed or dismissed
  if (dismissed || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0083a2] to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-md">
          {isDesktop ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-white truncate">
            {isDesktop ? 'Install on Laptop' : 'Install Brihaspathi FSM'}
          </h4>
          <p className="text-[11px] text-slate-300 leading-tight truncate">
            {isDesktop ? 'Pin to Taskbar & Desktop' : '1-tap home screen access'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={installApp}
            className="bg-[#0083a2] hover:bg-[#00708b] text-white font-bold text-xs h-8 px-3 rounded-lg shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Install
          </Button>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Dismiss"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
