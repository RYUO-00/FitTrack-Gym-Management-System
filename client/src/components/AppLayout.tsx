import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Banknote, CalendarCheck2, ChartNoAxesCombined, ChevronLeft, ChevronRight, Dumbbell, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings2, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../lib/api';
import { useToast } from '../lib/toast';
import { Button } from './ui/button';

const links = [
  {to:'/',label:'Dashboard',icon:LayoutDashboard},
  {to:'/members',label:'Members',icon:Users},
  {to:'/trainers',label:'Trainers',icon:Dumbbell},
  {to:'/plans',label:'Membership plans',icon:Activity},
  {to:'/subscriptions',label:'Subscriptions',icon:CalendarCheck2},
  {to:'/payments',label:'Payments',icon:Banknote},
  {to:'/attendance',label:'Attendance',icon:CalendarCheck2},
  {to:'/reports',label:'Reports',icon:ChartNoAxesCombined},
  {to:'/settings',label:'Settings',icon:Settings2},
];
const titles: Record<string,string> = Object.fromEntries(links.map(({to,label})=>[to,label]));
type User = { adminId:number;email:string;displayName:string };

export function AppLayout() {
  const [collapsed,setCollapsed]=useState(false);
  const [mobileOpen,setMobileOpen]=useState(false);
  const location=useLocation();
  const navigate=useNavigate();
  const client=useQueryClient();
  const toast=useToast();
  const {data:user}=useQuery({queryKey:['me'],queryFn:()=>request.get<{user:User}>('/auth/me').then((value)=>value.user)});
  const logout=useMutation({mutationFn:()=>request.post('/auth/logout',{}),onSuccess:()=>{client.clear();navigate('/login');},onError:()=>toast('Could not sign out. Try again.','error')});
  const currentTitle=titles[location.pathname] ?? 'FitTrack';
  const initials=(user?.displayName??'FitTrack Admin').split(' ').map((part)=>part[0]).slice(0,2).join('').toUpperCase();

  const sidebar=<aside className={`flex h-full flex-col bg-[#14251f] text-white transition-all duration-200 ${collapsed?'w-[76px]':'w-[252px]'}`}>
    <div className={`flex h-[76px] items-center gap-3 border-b border-white/10 px-5 ${collapsed?'justify-center px-0':''}`}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime text-forest"><Dumbbell size={19} strokeWidth={2.4}/></div>
      {!collapsed&&<div><div className="text-[17px] font-bold tracking-[-.04em]">FitTrack</div><div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.19em] text-white/45">Gym operations</div></div>}
    </div>
    <div className="px-3 pt-6"><p className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.15em] text-white/35 ${collapsed?'sr-only':''}`}>Workspace</p>
      <nav className="space-y-1" aria-label="Primary navigation">{links.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==='/'} onClick={()=>setMobileOpen(false)} title={collapsed?label:undefined}
        className={({isActive})=>`group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${isActive?'bg-white/10 text-white':'text-white/60 hover:bg-white/[.06] hover:text-white'} ${collapsed?'justify-center px-0':''}`}>
          {({isActive})=><><Icon size={17} strokeWidth={isActive?2.2:1.8} className={isActive?'text-lime':'text-white/55 group-hover:text-white'}/>{!collapsed&&<span>{label}</span>}{!collapsed&&isActive&&<span className="ml-auto size-1.5 rounded-full bg-lime"/>}</>}
        </NavLink>)}</nav>
    </div>
    <div className="mt-auto px-3 pb-4">
      <div className={`mb-3 rounded-xl border border-white/10 bg-white/[.04] p-3 ${collapsed?'hidden':''}`}>
        <div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[#93d5a6]"/><span className="text-[11px] font-medium text-white/70">Operations workspace</span></div>
        <p className="mt-1.5 pl-3.5 text-[10px] leading-4 text-white/40">Member and revenue records stay in sync with PostgreSQL.</p>
      </div>
      <div className={`flex items-center gap-2 rounded-xl px-2 py-2 ${collapsed?'justify-center':''}`}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dce8df] text-[11px] font-bold text-forest">{initials}</div>
        {!collapsed&&<><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white/90">{user?.displayName??'Administrator'}</p><p className="truncate text-[10px] text-white/45">{user?.email??''}</p></div><button onClick={()=>logout.mutate()} title="Sign out" className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"><LogOut size={15}/></button></>}
      </div>
      {!collapsed&&<button onClick={()=>logout.mutate()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-white/50 hover:bg-white/[.06] hover:text-white md:hidden"><LogOut size={14}/>Sign out</button>}
    </div>
    <button onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} className="hidden h-11 items-center justify-center border-t border-white/10 text-white/45 hover:text-white lg:flex">{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button>
  </aside>;

  return <div className="min-h-screen bg-canvas lg:flex">
    <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
      <button onClick={()=>setMobileOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-ink"><Menu size={20}/></button>
      <div className="flex items-center gap-2 text-sm font-bold text-ink"><span className="flex size-7 items-center justify-center rounded-lg bg-lime text-forest"><Dumbbell size={15}/></span>FitTrack</div>
      <span className="w-9"/>
    </div>
    <div className={`fixed inset-0 z-40 lg:hidden ${mobileOpen?'visible':'invisible pointer-events-none'}`}>
      <button onClick={()=>setMobileOpen(false)} aria-label="Close menu" className={`absolute inset-0 bg-ink/40 transition-opacity ${mobileOpen?'opacity-100':'opacity-0'}`}/>
      <div className={`absolute inset-y-0 left-0 transition-transform ${mobileOpen?'translate-x-0':'-translate-x-full'}`}>{sidebar}<button onClick={()=>setMobileOpen(false)} aria-label="Close menu" className="absolute right-3 top-5 rounded-md p-1 text-white/60"><X size={17}/></button></div>
    </div>
    <div className="hidden h-screen shrink-0 lg:sticky lg:top-0 lg:block">{sidebar}</div>
    <div className="min-w-0 flex-1 pt-14 lg:pt-0">
      <header className="hidden h-[76px] items-center justify-between border-b border-line bg-white px-8 lg:flex">
        <div><p className="text-[11px] font-medium text-muted">Workspace <ChevronRight size={12} className="mx-1 inline"/>{currentTitle}</p><p className="mt-1 text-sm font-semibold text-ink">{currentTitle}</p></div>
        <div className="flex items-center gap-4"><div className="text-right"><p className="text-xs font-semibold text-ink">{new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date())}</p><p className="mt-0.5 text-[10px] text-muted">FitTrack admin</p></div><span className="h-8 w-px bg-line"/><Button variant="ghost" size="icon" onClick={()=>setCollapsed(!collapsed)} aria-label="Toggle sidebar" className="hidden"><ChevronLeft size={16}/></Button></div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-7"><Outlet/></main>
    </div>
  </div>;
}
