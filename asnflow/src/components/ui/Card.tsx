import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CardProps { children: ReactNode; className?: string; }
export default function Card({ children, className }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('px-6 py-4 border-b border-gray-100', className)}>{children}</div>;
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn('p-6', className)}>{children}</div>;
}
