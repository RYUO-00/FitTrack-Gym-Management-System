import type { ReactNode } from 'react';
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink">{label}</span>{children}{hint&&<span className="mt-1 block text-[10px] text-muted">{hint}</span>}</label>;}
