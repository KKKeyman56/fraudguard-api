import { cn } from '@/lib/utils';
type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';
interface BadgeProps { children: React.ReactNode; variant?: Variant; className?: string; }
export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants: Record<Variant, string> = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-brand-100 text-brand-700',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', variants[variant], className)}>
      {children}
    </span>
  );
}
