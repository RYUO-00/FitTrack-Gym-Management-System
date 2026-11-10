import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Check, CircleAlert, X } from 'lucide-react';

type ToastItem = { id: number; message: string; kind: 'success' | 'error' };
const ToastContext = createContext<(message: string, kind?: ToastItem['kind']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items,setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string,kind: ToastItem['kind']='success') => {
    const id = Date.now()+Math.random();
    setItems((current) => [...current,{id,message,kind}]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id!==id)),3800);
  },[]);
  const value = useMemo(() => show,[show]);
  return <ToastContext.Provider value={value}>{children}<div className="fixed bottom-5 right-5 z-[100] grid gap-2" aria-live="polite">
    {items.map((item) => <div key={item.id} className="flex min-w-72 items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-lg">
      {item.kind==='success' ? <Check size={16} className="text-moss"/> : <CircleAlert size={16} className="text-rose-600"/>}
      <p className="flex-1 text-sm font-medium text-ink">{item.message}</p>
      <button onClick={() => setItems((current) => current.filter((entry) => entry.id!==item.id))} aria-label="Dismiss notification"><X size={15}/></button>
    </div>)}
  </div></ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
