export function PanelHeading({title,detail,action}: {title:string;detail?:string;action?:React.ReactNode}) {
  return <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-ink">{title}</h2>{detail&&<p className="mt-1 text-xs text-muted">{detail}</p>}</div>{action}</div>;
}
