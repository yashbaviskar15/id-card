'use client';

import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/brand/brand-mark';

export function AppLaunchSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const standaloneDisplay = window.matchMedia?.('(display-mode: standalone)').matches;
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if ((!standaloneDisplay && !iosStandalone) || reducedMotion) {
      setVisible(false);
      return;
    }

    document.documentElement.classList.add('installed-app-mode');
    const timeout = window.setTimeout(() => {
      setVisible(false);
      document.documentElement.classList.remove('installed-app-mode');
    }, 1100);

    return () => {
      window.clearTimeout(timeout);
      document.documentElement.classList.remove('installed-app-mode');
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="app-launch-splash" aria-hidden="true">
      <div className="app-launch-splash__content">
        <BrandMark className="app-launch-splash__logo" />
        <span className="app-launch-splash__title">Private Identity</span>
      </div>
    </div>
  );
}
