import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Dialog({open,onOpenChange,children}: {open:boolean;onOpenChange:(value:boolean)=>void;children:ReactNode}) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>{children}</DialogPrimitive.Root>;
}
export const DialogTrigger = DialogPrimitive.Trigger;
export function DialogContent({children,className=''}: {children:ReactNode;className?:string}) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#101c19]/45 backdrop-blur-[2px] data-[state=open]:animate-in"/>
    <DialogPrimitive.Content className={`fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-2xl outline-none ${className}`}>
      {children}<DialogPrimitive.Close className="absolute right-5 top-5 rounded-md p-1 text-muted hover:bg-canvas hover:text-ink" aria-label="Close"><X size={17}/></DialogPrimitive.Close>
    </DialogPrimitive.Content></DialogPrimitive.Portal>;
}
export function DialogHeader({children}: {children:ReactNode}) { return <div className="mb-5 pr-7">{children}</div>; }
export const DialogTitle = DialogPrimitive.Title;
export function DialogDescription({children}: {children:ReactNode}) { return <p className="mt-1.5 text-sm leading-5 text-muted">{children}</p>; }
