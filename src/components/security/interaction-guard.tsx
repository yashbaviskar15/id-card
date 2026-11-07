'use client';

import { useEffect } from 'react';

function stopEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

export function InteractionGuard() {
  useEffect(() => {
    const block = (event: Event) => stopEvent(event);
    const blockSelectionOutsideFields = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return;
      stopEvent(event);
    };
    const blockShortcuts = (event: KeyboardEvent) => {
      const hasModifier = event.ctrlKey || event.metaKey;
      const isDevToolsShortcut =
        event.key === 'F12'
        || (hasModifier && event.shiftKey && ['i', 'j', 'c', 'k'].includes(event.key.toLowerCase()))
        || (event.altKey && event.metaKey && ['i', 'j', 'c'].includes(event.key.toLowerCase()));
      const isPrintScreen = event.key === 'PrintScreen';

      // Keyboard shortcuts are only a UI deterrent; browser and OS capture tools remain outside page control.
      if (hasModifier || isDevToolsShortcut || isPrintScreen) stopEvent(event);
    };

    document.documentElement.classList.add('interaction-locked');
    document.addEventListener('contextmenu', block, true);
    document.addEventListener('copy', block, true);
    document.addEventListener('cut', block, true);
    document.addEventListener('paste', block, true);
    document.addEventListener('dragstart', block, true);
    document.addEventListener('dragover', block, true);
    document.addEventListener('drop', block, true);
    document.addEventListener('selectstart', blockSelectionOutsideFields, true);
    window.addEventListener('keydown', blockShortcuts, true);

    return () => {
      document.documentElement.classList.remove('interaction-locked');
      document.removeEventListener('contextmenu', block, true);
      document.removeEventListener('copy', block, true);
      document.removeEventListener('cut', block, true);
      document.removeEventListener('paste', block, true);
      document.removeEventListener('dragstart', block, true);
      document.removeEventListener('dragover', block, true);
      document.removeEventListener('drop', block, true);
      document.removeEventListener('selectstart', blockSelectionOutsideFields, true);
      window.removeEventListener('keydown', blockShortcuts, true);
    };
  }, []);

  return null;
}
