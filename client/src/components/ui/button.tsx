import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const styles = cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      primary: 'bg-forest text-white hover:bg-moss', secondary: 'border border-line bg-white text-ink hover:bg-canvas',
      ghost: 'text-muted hover:bg-canvas hover:text-ink', danger: 'bg-rose-600 text-white hover:bg-rose-700',
      soft: 'bg-[#edf4e9] text-forest hover:bg-[#e3efdc]',
    },
    size: { sm: 'h-8 px-3', md: 'h-10 px-4', icon: 'size-9' },
  }, defaultVariants: { variant: 'primary', size: 'md' },
});

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof styles> {}
export const Button = forwardRef<HTMLButtonElement,ButtonProps>(({className,variant,size,...props},ref) =>
  <button ref={ref} className={cn(styles({variant,size}),className)} {...props}/>);
Button.displayName='Button';
