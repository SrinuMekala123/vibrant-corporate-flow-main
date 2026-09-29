import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    const wasInstalled = localStorage.getItem('pwa_installed_on_device') === 'true';
    return isStandalone || wasInstalled;
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode or previous install
    const checkInstalled = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (window.navigator as any).standalone === true;
      const wasInstalled = localStorage.getItem('pwa_installed_on_device') === 'true';
      if (standalone || wasInstalled) {
        setIsInstalled(true);
        return;
      }

      if ('getInstalledRelatedApps' in window.navigator) {
        try {
          (window.navigator as any).getInstalledRelatedApps().then((relatedApps: any[]) => {
            if (relatedApps && relatedApps.length > 0) {
              setIsInstalled(true);
              localStorage.setItem('pwa_installed_on_device', 'true');
            }
          }).catch(() => {});
        } catch {
          // ignore
        }
      }
    };

    checkInstalled();

    // Detect device type
    const userAgent = window.navigator.userAgent || '';
    const isAppleDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    setIsIOS(isAppleDevice);
    setIsDesktop(!isMobileDevice && !isAppleDevice);

    // Listen for beforeinstallprompt (Chrome, Edge, Android, Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('💡 [PWA] beforeinstallprompt event captured');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      console.log('🎉 [PWA] appinstalled event fired');
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowGuide(false);
      localStorage.setItem('pwa_installed_on_device', 'true');
      toast.success('🎉 Brihaspathi FSM installed successfully on this device!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (isInstalled) {
      toast.info('App is already installed on this device!');
      return { outcome: 'already-installed' as const };
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          console.log('[PWA] User accepted installation prompt');
          setDeferredPrompt(null);
          setIsInstalled(true);
          localStorage.setItem('pwa_installed_on_device', 'true');
          toast.success('🎉 Brihaspathi FSM installed to your system!');
        } else {
          console.log('[PWA] User dismissed installation prompt');
        }
        return { outcome: choice.outcome };
      } catch (err) {
        console.error('[PWA] Installation prompt error:', err);
        return { outcome: 'error' as const };
      }
    }

    // Fallback: If browser hasn't fired beforeinstallprompt or requires manual install
    setShowGuide(true);
    return { outcome: 'manual-guide' as const };
  }, [deferredPrompt, isInstalled]);

  const markAsInstalled = useCallback(() => {
    setIsInstalled(true);
    localStorage.setItem('pwa_installed_on_device', 'true');
    setShowGuide(false);
    toast.success('Brihaspathi FSM marked as installed!');
  }, []);

  const resetInstallState = useCallback(() => {
    localStorage.removeItem('pwa_installed_on_device');
    setIsInstalled(false);
    toast.info('Installation state reset.');
  }, []);

  return {
    canInstall: !isInstalled,
    isInstalled,
    isIOS,
    isDesktop,
    hasNativePrompt: !!deferredPrompt,
    showGuide,
    setShowGuide,
    installApp,
    markAsInstalled,
    resetInstallState,
  };
}
