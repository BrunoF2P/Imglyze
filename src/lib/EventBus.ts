type Callback<T = any> = (data: T) => void;

/**
 * Observer Pattern: Event Bus for processing events.
 * Decouples the UI listeners from the specific transport (Tauri events).
 */
export class ProcessingEventBus {
    private listeners: Map<string, Callback[]> = new Map();

    subscribe<T>(event: string, callback: Callback<T>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);

        // Return unsubscribe function
        return () => {
            const subs = this.listeners.get(event);
            if (subs) {
                this.listeners.set(event, subs.filter(cb => cb !== callback));
            }
        };
    }

    emit<T>(event: string, data: T): void {
        const subs = this.listeners.get(event);
        if (subs) {
            subs.forEach(callback => callback(data));
        }
    }
}

export const processingEventBus = new ProcessingEventBus();
