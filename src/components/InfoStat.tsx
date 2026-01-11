import React from 'react';
import { cn } from '../lib/utils';
import { TYPOGRAPHY } from '../lib/constants';

interface InfoStatProps {
    label: string;
    value: string | number;
    color?: string;
    className?: string;
}

export const InfoStat: React.FC<InfoStatProps> = ({
    label,
    value,
    color,
    className
}) => (
    <div className={cn("flex flex-col gap-1", className)}>
        <span className={TYPOGRAPHY.compactLabel}>{label}</span>
        <span className={cn("text-xl font-black tracking-tight", color || "text-text-main")}>{value}</span>
    </div>
);
