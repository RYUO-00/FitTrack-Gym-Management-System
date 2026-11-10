import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Table({children,className}: {children:ReactNode;className?:string}) { return <div className="w-full overflow-x-auto"><table className={cn('w-full border-collapse text-left text-sm',className)}>{children}</table></div>; }
export function THead({children}: {children:ReactNode}) { return <thead className="border-b border-line bg-[#fafbf9] text-[11px] font-semibold uppercase tracking-[.08em] text-muted">{children}</thead>; }
export function TBody({children}: {children:ReactNode}) { return <tbody className="divide-y divide-line/80">{children}</tbody>; }
export function TR({children,className}: {children:ReactNode;className?:string}) { return <tr className={cn('transition-colors hover:bg-[#fafbf9]',className)}>{children}</tr>; }
export function TH({children,className}: HTMLAttributes<HTMLTableCellElement>) { return <th className={cn('whitespace-nowrap px-4 py-3 font-semibold',className)}>{children}</th>; }
export function TD({children,className}: HTMLAttributes<HTMLTableCellElement>) { return <td className={cn('px-4 py-3.5 align-middle text-ink',className)}>{children}</td>; }
