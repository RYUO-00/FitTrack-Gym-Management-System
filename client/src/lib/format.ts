export const currency = (value: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
export const number = (value: number | string) => new Intl.NumberFormat('en-IN').format(Number(value) || 0);
const parseDateForDisplay = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  const parsed = new Date(0);
  parsed.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};
const formatCalendarDate = (value: string | null | undefined, options: Intl.DateTimeFormatOptions) => {
  if (!value) return '—';
  const parsed = parseDateForDisplay(value);
  return Number.isNaN(parsed.valueOf()) ? '—' : new Intl.DateTimeFormat('en-IN', options).format(parsed);
};
export const date = (value?: string | null) => formatCalendarDate(value, { day: '2-digit', month: 'short', year: 'numeric' });
export const monthShort = (value: string) => formatCalendarDate(value, { month: 'short' });
export const monthShortYear = (value: string) => formatCalendarDate(value, { month: 'short', year: '2-digit' });
export const monthLongYear = (value: string) => formatCalendarDate(value, { month: 'long', year: 'numeric' });
export const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';
export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
};
