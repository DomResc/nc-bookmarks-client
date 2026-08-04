import React from 'react';

interface SpinnerProps {
  size?: number;
  className?: string;
  color?: string;
  trackClassName?: string;
  indicatorClassName?: string;
}

export default function Spinner({ size = 16, className, color, trackClassName, indicatorClassName }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${className || ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-hidden="true"
    >
      <circle
        className={`opacity-25 ${trackClassName || ''}`}
        cx="12"
        cy="12"
        r="10"
        stroke={color || 'currentColor'}
        strokeWidth="4"
      />
      <path
        className={`opacity-75 ${indicatorClassName || ''}`}
        fill={color || 'currentColor'}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
