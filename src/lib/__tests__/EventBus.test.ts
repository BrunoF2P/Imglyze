import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessingEventBus } from '../EventBus';

describe('ProcessingEventBus', () => {
    let eventBus: ProcessingEventBus;

    beforeEach(() => {
        eventBus = new ProcessingEventBus();
    });

    it('should subscribe to events', () => {
        const callback = () => { };
        const unsubscribe = eventBus.subscribe('test-event', callback);

        expect(typeof unsubscribe).toBe('function');
    });

    it('should emit events to subscribers', () => {
        let received: string | undefined;

        eventBus.subscribe<string>('test-event', (data) => {
            received = data;
        });

        eventBus.emit('test-event', 'hello');

        expect(received).toBe('hello');
    });

    it('should support multiple subscribers for the same event', () => {
        const received: string[] = [];

        eventBus.subscribe<string>('test-event', (data) => {
            received.push(`subscriber1:${data}`);
        });

        eventBus.subscribe<string>('test-event', (data) => {
            received.push(`subscriber2:${data}`);
        });

        eventBus.emit('test-event', 'test');

        expect(received).toEqual(['subscriber1:test', 'subscriber2:test']);
    });

    it('should unsubscribe correctly', () => {
        let count = 0;

        const unsubscribe = eventBus.subscribe('test-event', () => {
            count++;
        });

        eventBus.emit('test-event', null);
        expect(count).toBe(1);

        unsubscribe();

        eventBus.emit('test-event', null);
        expect(count).toBe(1); // Count should not increase after unsubscribe
    });

    it('should handle unsubscribe for multiple listeners', () => {
        let count1 = 0;
        let count2 = 0;

        const unsubscribe1 = eventBus.subscribe('test-event', () => {
            count1++;
        });

        const unsubscribe2 = eventBus.subscribe('test-event', () => {
            count2++;
        });

        eventBus.emit('test-event', null);
        expect(count1).toBe(1);
        expect(count2).toBe(1);

        unsubscribe1();

        eventBus.emit('test-event', null);
        expect(count1).toBe(1); // Should not increase
        expect(count2).toBe(2); // Should still work
    });

    it('should handle emitting to non-existent events gracefully', () => {
        expect(() => {
            eventBus.emit('non-existent', 'data');
        }).not.toThrow();
    });

    it('should support different data types', () => {
        let receivedNumber: number | undefined;
        let receivedObject: { foo: string } | undefined;
        let receivedArray: number[] | undefined;

        eventBus.subscribe<number>('number-event', (data) => {
            receivedNumber = data;
        });

        eventBus.subscribe<{ foo: string }>('object-event', (data) => {
            receivedObject = data;
        });

        eventBus.subscribe<number[]>('array-event', (data) => {
            receivedArray = data;
        });

        eventBus.emit('number-event', 42);
        eventBus.emit('object-event', { foo: 'bar' });
        eventBus.emit('array-event', [1, 2, 3]);

        expect(receivedNumber).toBe(42);
        expect(receivedObject).toEqual({ foo: 'bar' });
        expect(receivedArray).toEqual([1, 2, 3]);
    });

    it('should isolate different event types', () => {
        let count1 = 0;
        let count2 = 0;

        eventBus.subscribe('event1', () => count1++);
        eventBus.subscribe('event2', () => count2++);

        eventBus.emit('event1', null);

        expect(count1).toBe(1);
        expect(count2).toBe(0);

        eventBus.emit('event2', null);

        expect(count1).toBe(1);
        expect(count2).toBe(1);
    });
});
