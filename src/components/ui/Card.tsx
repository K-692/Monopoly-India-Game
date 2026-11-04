import React from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  ornate?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, ornate = false, ...props }) => {
  return (
    <div
      className={cn(
        'bg-white/90 dark:bg-indian-navy-800/90 backdrop-blur-sm border border-indian-parchment-300 dark:border-indian-navy-700 rounded-xl shadow-card-warm p-4 transition-all',
        ornate && 'ornate-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

