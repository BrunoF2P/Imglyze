export const ANIMATION_DELAYS = {
    base: 0.1,
    itemStagger: 0.05,
    viewTransition: 0.2,
} as const;

export const TYPOGRAPHY = {
    label: "text-xs font-medium text-text-muted",
    compactLabel: "text-xs font-medium leading-none text-text-muted",
    heading: "text-2xl font-bold tracking-tight",
    subHeading: "text-lg font-bold tracking-tight",
    statsValue: "text-2xl font-bold tracking-tight",
    monoStats: "text-sm font-mono font-bold text-text-main",
} as const;

export const LAYOUT = {
    glass: "glass border border-text-main/5",
    surface: "bg-surface",
    cardPadding: "p-6",
    statCardPadding: "p-5",
    borderRadius: "rounded-xl",
    largeBorderRadius: "rounded-2xl",
} as const;
