import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 touch-target focus:outline-none focus-visible:ring-2 focus-visible:ring-indian-terracotta-500 select-none';

    const variants = {
      primary:
        'bg-indian-terracotta-500 text-white hover:bg-indian-terracotta-600 active:bg-indian-terracotta-700 shadow-sm border border-indian-terracotta-600 rounded-lg',
      secondary:
        'bg-indian-navy-700 text-white hover:bg-indian-navy-800 active:bg-indian-navy-900 shadow-sm rounded-lg',
      outline:
        'border border-indian-parchment-400 bg-white/80 dark:bg-indian-navy-800/80 text-indian-navy-900 dark:text-indian-parchment-100 hover:bg-indian-parchment-200 active:bg-indian-parchment-300 rounded-lg',
      danger:
        'bg-indian-crimson-500 text-white hover:bg-indian-crimson-600 active:bg-indian-crimson-700 rounded-lg',
      ghost:
        'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200/60 active:bg-indian-parchment-300/60 rounded-lg',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 min-h-[36px]',
      md: 'text-sm px-4 py-2.5 min-h-[44px]',
      lg: 'text-base px-6 py-3 min-h-[48px] font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
