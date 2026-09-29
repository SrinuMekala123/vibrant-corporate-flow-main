import React from 'react';
import { Smartphone, Laptop, Download, Share2, PlusSquare, Monitor, CheckCircle2, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PWAInstallButtonProps {
  variant?: 'nav' | 'sidebar' | 'inline' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'nav',
  className = '',
}) => {
  const {
    isInstalled,
    isIOS,
    isDesktop,
    showGuide,
    setShowGuide,
    installApp,
    markAsInstalled,
  } = usePWAInstall();

  // If already installed on this device, hide completely
  if (isInstalled) {
    return null;
  }

  const labelText = isDesktop ? 'Install on Laptop' : 'Install App';

  return (
    <>
      {variant === 'nav' && (
        <button
          type="button"
          onClick={installApp}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#0083a2] to-cyan-600 text-white text-xs font-semibold shadow-xs hover:shadow-md hover:brightness-105 active:scale-95 transition-all duration-200 border border-white/20 ${className}`}
          title={isDesktop ? 'Install Brihaspathi App on your Laptop / PC' : 'Install Brihaspathi App on your Phone'}
        >
          {isDesktop ? <Laptop className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5 animate-pulse" />}
          <span className="hidden sm:inline">{labelText}</span>
          <span className="sm:hidden">Install</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          type="button"
          onClick={installApp}
          className={`p-2 rounded-xl bg-[#0083a2]/10 text-[#0083a2] hover:bg-[#0083a2]/20 active:scale-95 transition-colors relative ${className}`}
          title={labelText}
        >
          {isDesktop ? <Laptop className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </button>
      )}

      {variant === 'sidebar' && (
        <div className={`px-1 py-1.5 ${className}`}>
          <button
            type="button"
            onClick={installApp}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#0083a2]/10 to-cyan-50 border border-[#0083a2]/30 text-[#0083a2] hover:bg-[#0083a2]/20 transition-all text-xs font-bold shadow-xs group"
          >
            <div className="w-7 h-7 rounded-lg bg-[#0083a2] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              {isDesktop ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-bold text-xs truncate">{isDesktop ? 'Install Desktop App' : 'Install Mobile App'}</p>
              <p className="text-[10px] text-slate-500 font-normal truncate">{isDesktop ? 'Pin to Taskbar & Desktop' : 'Add to Home Screen'}</p>
            </div>
            <Download className="w-3.5 h-3.5 text-[#0083a2] opacity-70 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      )}

      {variant === 'inline' && (
        <Button
          type="button"
          onClick={installApp}
          className={`bg-[#0083a2] hover:bg-[#00708b] text-white font-bold gap-2 text-xs rounded-xl shadow-md ${className}`}
        >
          {isDesktop ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
          {labelText}
        </Button>
      )}

      {/* Installation Guide Dialog */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 border border-slate-200">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-[#0083a2] mx-auto mb-3 shadow-xs">
              {isDesktop ? <Monitor className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">
              {isDesktop ? 'Install Brihaspathi App on Laptop' : 'Install Brihaspathi FSM App'}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600">
              {isDesktop
                ? 'Launch directly from your Windows Taskbar or Mac Dock with full desktop performance.'
                : 'Install directly onto your home screen for fast 1-tap full-screen access.'}
            </DialogDescription>
          </DialogHeader>

          {isDesktop ? (
            /* 💻 LAPTOP / DESKTOP INSTRUCTIONS */
            <div className="space-y-3.5 my-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0083a2] text-white flex items-center justify-center font-bold shrink-0 text-[11px] mt-0.5">
                  1
                </div>
                <p className="leading-relaxed">
                  Look at the <strong>right side of your browser URL address bar</strong> (top right of screen).
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0083a2] text-white flex items-center justify-center font-bold shrink-0 text-[11px] mt-0.5">
                  2
                </div>
                <p className="leading-relaxed">
                  Click the <strong>Install Icon (⊞ or 🖥️)</strong> in the address bar, OR click the <strong>3 dots (⋮)</strong> menu ➔ <strong>"Install Brihaspathi Field Service"</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0083a2] text-white flex items-center justify-center font-bold shrink-0 text-[11px] mt-0.5">
                  3
                </div>
                <p className="leading-relaxed">
                  Click <strong>"Install"</strong> in the browser prompt. The Brihaspathi app will open as a desktop window and add a shortcut to your desktop!
                </p>
              </div>
            </div>
          ) : (
            /* 📱 MOBILE / iOS INSTRUCTIONS */
            <div className="space-y-3.5 my-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0083a2] text-white flex items-center justify-center font-bold shrink-0 text-[11px] mt-0.5">
                  1
                </div>
                <p className="leading-relaxed">
                  {isIOS ? (
                    <>
                      Tap the <strong className="inline-flex items-center gap-0.5 font-bold text-slate-900"><Share2 className="w-3.5 h-3.5 inline text-[#0083a2]" /> Share</strong> icon at the bottom of Safari.
                    </>
                  ) : (
                    <>
                      Tap the <strong>browser menu (3 dots)</strong> in the top corner.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0083a2] text-white flex items-center justify-center font-bold shrink-0 text-[11px] mt-0.5">
                  2
                </div>
                <p className="leading-relaxed">
                  Scroll down and tap <strong className="inline-flex items-center gap-0.5 font-bold text-slate-900"><PlusSquare className="w-3.5 h-3.5 inline text-[#0083a2]" /> Add to Home Screen</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0083a2] text-white flex items-center justify-center font-bold shrink-0 text-[11px] mt-0.5">
                  3
                </div>
                <p className="leading-relaxed">
                  Tap <strong>Add</strong> in the top right. The Brihaspathi icon will appear on your phone!
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              onClick={markAsInstalled}
              className="w-full bg-[#0083a2] hover:bg-[#00708b] text-white rounded-xl font-bold text-xs py-2 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              I've Installed It (Hide This Button)
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowGuide(false)}
              className="w-full text-slate-500 text-xs py-1.5"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
