import React from 'react';
import { cn } from '@/lib/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'terracotta' | 'navy' | 'gold' | 'emerald' | 'crimson' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'terracotta', className }) => {
  const variants = {
    terracotta: 'bg-indian-terracotta-100 text-indian-terracotta-800 border-indian-terracotta-300',
    navy: 'bg-indian-navy-100 text-indian-navy-800 border-indian-navy-300',
    gold: 'bg-indian-gold-100 text-indian-gold-900 border-indian-gold-300',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    crimson: 'bg-red-100 text-red-800 border-red-300',
    neutral: 'bg-indian-parchment-200 text-indian-navy-800 border-indian-parchment-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
