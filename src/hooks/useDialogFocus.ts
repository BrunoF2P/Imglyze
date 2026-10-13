import { useEffect, useRef } from 'react';

export function useDialogFocus(open: boolean, onClose: () => void) {
    const dialog = useRef<HTMLDivElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        if (!open || !dialog.current) return;
        const root = dialog.current;
        const previous = document.activeElement as HTMLElement | null;
        const controls = () => [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
        controls()[0]?.focus();
        const keydown = (event: KeyboardEvent) => {
            const dialogs = document.querySelectorAll('[role="dialog"]');
            if (dialogs[dialogs.length - 1] !== root) return;
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopImmediatePropagation(); close.current();
            } else if (event.key === 'Tab') {
                const items = controls();
                const first = items[0], last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        };
        window.addEventListener('keydown', keydown, true);
        return () => { window.removeEventListener('keydown', keydown, true); if (previous?.isConnected) previous.focus(); };
    }, [open]);
    return dialog;
}
