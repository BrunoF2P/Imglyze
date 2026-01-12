import React from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '../../lib/utils';
import { TYPOGRAPHY, LAYOUT } from '../../lib/constants';

interface StatCardProps {
    label: string;
    value: string | number;
    variants?: Variants;
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    variants,
    className
}) => (
    <motion.div
        variants={variants}
        className={cn(LAYOUT.glass, LAYOUT.statCardPadding, LAYOUT.borderRadius, "hover:border-text-main/10 transition-colors group", className)}
    >
        <p className={cn(TYPOGRAPHY.label, "mb-2 group-hover:text-text-main transition-colors")}>
            {label}
        </p>
        <p className={TYPOGRAPHY.statsValue}>{value}</p>
    </motion.div>
);
