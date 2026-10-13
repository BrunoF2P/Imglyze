import { describe, expect, it } from 'vitest';
import { statsCalculationService } from '../services/StatsCalculationService';
import { FileItem } from '../../../types';
const file = (optimizedSize: number, selected = true): FileItem => ({ id: String(optimizedSize), name: 'photo.png', path: 'photo.png', size: 100, optimizedSize, format: 'PNG', status: 'Done', selected });
describe('batch totals', () => {
    it('includes outputs that grow when calculating net savings', () => {
        expect(statsCalculationService.calculateSavings([file(50), file(130)])).toEqual({ totalSavedBytes: 20, savedPercent: 10, originalSizeProcessed: 200 });
        expect(statsCalculationService.calculateSavings([file(130)]).savedPercent).toBe(-30);
    });
    it('counts and tracks progress only for selected files', () => {
        expect(statsCalculationService.calculateBatchStats([file(50), file(80, false)]).totalFiles).toBe(1);
        expect(statsCalculationService.calculateProgress([file(50), { ...file(80, false), status: 'Pending' }])).toBe(100);
        expect(statsCalculationService.calculateSavings([file(50), file(80, false)]).totalSavedBytes).toBe(50);
    });
});
