import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export const Input = forwardRef<HTMLInputElement,InputHTMLAttributes<HTMLInputElement>>(({className,...props},ref) =>
  <input ref={ref} className={cn('h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-[#a3aaa5] focus:border-moss focus:ring-2 focus:ring-moss/10',className)} {...props}/>);
Input.displayName='Input';

export const Select = forwardRef<HTMLSelectElement,React.SelectHTMLAttributes<HTMLSelectElement>>(({className,...props},ref) =>
  <select ref={ref} className={cn('h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/10',className)} {...props}/>);
Select.displayName='Select';
