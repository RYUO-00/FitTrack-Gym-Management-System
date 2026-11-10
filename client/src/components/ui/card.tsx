import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Card({className,...props}: HTMLAttributes<HTMLDivElement>) { return <section className={cn('rounded-xl border border-line bg-white shadow-soft',className)} {...props}/>; }
export function CardHeader({className,...props}: HTMLAttributes<HTMLDivElement>) { return <div className={cn('flex items-start justify-between gap-3 px-5 pb-3 pt-5',className)} {...props}/>; }
export function CardTitle({className,...props}: HTMLAttributes<HTMLHeadingElement>) { return <h2 className={cn('text-sm font-semibold text-ink',className)} {...props}/>; }
export function CardContent({className,...props}: HTMLAttributes<HTMLDivElement>) { return <div className={cn('px-5 pb-5',className)} {...props}/>; }
