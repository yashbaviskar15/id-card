// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SecurityGuard } from '@/components/security/security-guard';

function dispatchKeyboard(target: Element, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}

describe('app security guard', () => {
  it.each([
    ['p', { ctrlKey: true }],
    ['c', { ctrlKey: true }],
    ['v', { ctrlKey: true }],
    ['a', { ctrlKey: true }],
    ['f', { ctrlKey: true }],
    ['u', { metaKey: true }],
    ['i', { ctrlKey: true, shiftKey: true }],
    ['j', { metaKey: true, shiftKey: true }],
    ['c', { ctrlKey: true, shiftKey: true }],
    ['F12', {}],
    ['F5', {}],
  ])('blocks %s with its requested modifier', (key, options) => {
    render(<SecurityGuard />);
    const event = dispatchKeyboard(document.body, key, options);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps normal form typing and paste usable while blocking select-all', () => {
    render(<SecurityGuard />);
    render(<input aria-label="Email" />);
    const input = screen.getByRole('textbox', { name: 'Email' });

    expect(dispatchKeyboard(input, 'v', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(dispatchKeyboard(input, 'a', { metaKey: true }).defaultPrevented).toBe(true);

    const paste = new Event('paste', { bubbles: true, cancelable: true });
    input.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(false);
    expect(fireEvent.input(input, { target: { value: 'owner@example.com' } })).toBe(true);
    expect((input as HTMLInputElement).value).toBe('owner@example.com');
  });

  it('blocks context menus, selection, dragging, dropping, and copying outside forms', async () => {
    render(<SecurityGuard />);
    const image = document.createElement('img');
    const link = document.createElement('a');
    link.href = '/';
    document.body.append(image, link);

    await waitFor(() => {
      expect(image).toHaveAttribute('draggable', 'false');
      expect(link).toHaveAttribute('draggable', 'false');
    });

    for (const type of ['contextmenu', 'selectstart', 'dragstart', 'drop', 'copy']) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented, type).toBe(true);
    }
  });

  it('blocks field context menus and removes listeners on unmount', () => {
    const view = render(<SecurityGuard />);
    const input = document.createElement('input');
    document.body.append(input);

    const fieldMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    input.dispatchEvent(fieldMenu);
    expect(fieldMenu.defaultPrevented).toBe(true);

    view.unmount();
    expect(document.documentElement).not.toHaveClass('security-guard-enabled');
    const pageMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(pageMenu);
    expect(pageMenu.defaultPrevented).toBe(false);
    input.remove();
  });
});
