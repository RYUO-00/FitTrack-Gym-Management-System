import { CircleAlert, LoaderCircle } from 'lucide-react';
import { Button } from './ui/button';

export function LoadingState({label='Loading your data…'}:{label?:string}) {
  return <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-muted"><LoaderCircle size={18} className="animate-spin text-moss"/>{label}</div>;
}
export function ErrorState({message,onRetry}:{message:string;onRetry?:()=>void}) {
  return <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center"><CircleAlert size={22} className="text-rose-600"/><p className="max-w-md text-sm text-muted">{message}</p>{onRetry&&<Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}</div>;
}
export function EmptyState({title,description}:{title:string;description:string}) {
  return <div className="px-4 py-14 text-center"><p className="text-sm font-semibold text-ink">{title}</p><p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{description}</p></div>;
}
