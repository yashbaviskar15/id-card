'use client';

import { useEffect } from 'react';

/** Flip this single flag to disable the client-side interaction deterrent. */
export const SECURITY_GUARD_ENABLED = true;

const FORM_TARGET = 'input, textarea, select, [contenteditable="true"]';
const CLIPBOARD_TARGET = 'input, textarea, [contenteditable="true"]';

function matchesTarget(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

function markAsNotDraggable(node: Node) {
  if (!(node instanceof Element)) return;
  if (node.matches('a, img')) node.setAttribute('draggable', 'false');
  node.querySelectorAll('a, img').forEach((element) => element.setAttribute('draggable', 'false'));
}

export function useSecurityGuard(enabled = SECURITY_GUARD_ENABLED) {
  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    root.classList.add('security-guard-enabled');

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;
      const isFormTarget = matchesTarget(event.target, FORM_TARGET);
      const isAllowedFormShortcut = isFormTarget && hasModifier && key === 'v';

      if (isAllowedFormShortcut) return;

      const blockedShortcut = event.key === 'F12'
        || event.key === 'F5'
        || (hasModifier && ['p', 'c', 'v', 'a', 'f', 'u'].includes(key))
        || (hasModifier && event.shiftKey && ['i', 'j', 'c'].includes(key));

      if (blockedShortcut) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onSelectStart = (event: Event) => {
      if (!matchesTarget(event.target, FORM_TARGET)) event.preventDefault();
    };
    const preventDragOrDrop = (event: Event) => event.preventDefault();
    const preventClipboardCopy = (event: ClipboardEvent) => event.preventDefault();
    const onPaste = (event: ClipboardEvent) => {
      if (!matchesTarget(event.target, CLIPBOARD_TARGET)) event.preventDefault();
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('selectstart', onSelectStart, true);
    document.addEventListener('dragstart', preventDragOrDrop, true);
    document.addEventListener('drop', preventDragOrDrop, true);
    document.addEventListener('copy', preventClipboardCopy, true);
    document.addEventListener('cut', preventClipboardCopy, true);
    document.addEventListener('paste', onPaste, true);

    markAsNotDraggable(document.body);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(markAsNotDraggable));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      root.classList.remove('security-guard-enabled');
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('selectstart', onSelectStart, true);
      document.removeEventListener('dragstart', preventDragOrDrop, true);
      document.removeEventListener('drop', preventDragOrDrop, true);
      document.removeEventListener('copy', preventClipboardCopy, true);
      document.removeEventListener('cut', preventClipboardCopy, true);
      document.removeEventListener('paste', onPaste, true);
    };
  }, [enabled]);
}

export function SecurityGuard() {
  useSecurityGuard();
  return null;
}
