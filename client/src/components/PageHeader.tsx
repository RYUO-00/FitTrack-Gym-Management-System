import type { ReactNode } from 'react';
export function PageHeader({title,description,action}: {title:string;description:string;action?:ReactNode}) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><h1 className="text-[26px] font-semibold tracking-[-.035em] text-ink">{title}</h1><p className="mt-1.5 text-sm text-muted">{description}</p></div>
    {action}
  </div>;
}
