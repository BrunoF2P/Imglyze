import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDialogFocus } from '../useDialogFocus';

function Dialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const ref = useDialogFocus(open, onClose);
    return open ? <div ref={ref} role="dialog"><button>Primeiro</button><button disabled>Desativado</button><button>Último</button></div> : null;
}
afterEach(() => vi.restoreAllMocks());
describe('dialog keyboard navigation', () => {
    it('traps Tab, closes with Escape and restores the previous focus', () => {
        vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
        const trigger = document.createElement('button');
        document.body.append(trigger);
        trigger.focus();
        const onClose = vi.fn();
        const view = render(<Dialog open onClose={onClose} />);
        const first = screen.getByRole('button', { name: 'Primeiro' });
        const last = screen.getByRole('button', { name: 'Último' });
        expect(document.activeElement).toBe(first);
        fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(last);
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(document.activeElement).toBe(first);
        fireEvent.keyDown(first, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();
        view.rerender(<Dialog open={false} onClose={onClose} />);
        expect(document.activeElement).toBe(trigger);
        trigger.remove();
    });
});
