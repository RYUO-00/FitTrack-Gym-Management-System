import { cn } from './ui/cn';

const tones: Record<string,string> = {
  active:'bg-[#e6f4e9] text-[#287148]', paid:'bg-[#e6f4e9] text-[#287148]',
  pending:'bg-[#fff4dc] text-[#9a6700]', upcoming:'bg-[#eaf0ff] text-[#4566a7]',
  expired:'bg-[#f0f1ef] text-[#6b746e]', cancelled:'bg-[#ffebeb] text-[#b43e3e]',
  failed:'bg-[#ffebeb] text-[#b43e3e]', refunded:'bg-[#f2eaff] text-[#784db0]', inactive:'bg-[#f0f1ef] text-[#6b746e]',
};

export function StatusBadge({status}: {status:string}) {
  const tone = tones[status.toLowerCase()] ?? 'bg-canvas text-muted';
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize',tone)}>{status.toLowerCase().replaceAll('_',' ')}</span>;
}
