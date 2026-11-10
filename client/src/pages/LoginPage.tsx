import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { request } from '../lib/api';
import { useToast } from '../lib/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LoadingState } from '../components/QueryState';

type User={adminId:number;email:string;displayName:string};

export function LoginPage() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const navigate=useNavigate();
  const toast=useToast();
  const client=useQueryClient();
  const session=useQuery({queryKey:['me'],queryFn:()=>request.get<{user:User}>('/auth/me'),retry:false,staleTime:15_000});
  const login=useMutation({mutationFn:()=>request.post<{user:User}>('/auth/login',{email,password}),onSuccess:(data)=>{client.setQueryData(['me'],data);navigate('/');},onError:(error:Error)=>toast(error.message,'error')});

  if (session.isLoading) return <LoadingState label="Checking your session…"/>;
  if (session.data) return <Navigate to="/" replace/>;
  const submit=(event:FormEvent)=>{event.preventDefault();login.mutate();};

  return <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1fr_1fr]">
    <div className="relative hidden overflow-hidden bg-[#14251f] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
      <div className="absolute -right-28 -top-20 size-[520px] rounded-full border border-white/[.07]"/><div className="absolute -right-4 top-4 size-[360px] rounded-full border border-white/[.06]"/>
      <div className="relative flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-lime text-forest"><Dumbbell size={21}/></span><span className="text-lg font-bold tracking-[-.04em]">FitTrack</span></div>
      <div className="relative max-w-lg"><p className="mb-5 text-[10px] font-semibold uppercase tracking-[.2em] text-lime">Gym operations, organized</p><h1 className="text-4xl font-semibold leading-[1.15] tracking-[-.04em] xl:text-[46px]">A clearer view of every member journey.</h1><p className="mt-5 max-w-md text-sm leading-6 text-white/55">Keep memberships, payments and daily attendance in one calm, reliable workspace.</p>
        <div className="mt-10 flex items-center gap-5 border-t border-white/10 pt-6"><div><p className="text-xl font-semibold">One place</p><p className="mt-1 text-xs text-white/45">for day-to-day operations</p></div><span className="h-9 w-px bg-white/10"/><div><p className="text-xl font-semibold">Live records</p><p className="mt-1 text-xs text-white/45">from your PostgreSQL database</p></div></div>
      </div>
      <p className="relative text-[11px] text-white/35">FITTRACK · ADMIN WORKSPACE</p>
    </div>
    <div className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
      <div className="w-full max-w-[390px]">
        <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="flex size-10 items-center justify-center rounded-xl bg-lime text-forest"><Dumbbell size={20}/></span><span className="text-lg font-bold tracking-[-.04em] text-ink">FitTrack</span></div>
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-moss">Administrator access</p>
        <h2 className="mt-3 text-[30px] font-semibold tracking-[-.04em] text-ink">Welcome back</h2>
        <p className="mt-2 text-sm text-muted">Sign in to manage your gym operations.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block"><span className="mb-2 block text-xs font-semibold text-ink">Work email</span><span className="relative block"><Mail size={16} className="absolute left-3 top-3 text-[#929b94]"/><Input type="email" autoComplete="username" placeholder="you@gym.com" value={email} onChange={(event)=>setEmail(event.target.value)} className="pl-10" required/></span></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-ink">Password</span><span className="relative block"><LockKeyhole size={16} className="absolute left-3 top-3 text-[#929b94]"/><Input type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event)=>setPassword(event.target.value)} className="pr-10 pl-10" required/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted" aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label>
          <Button className="mt-2 w-full" type="submit" disabled={login.isPending}>{login.isPending?'Signing in…':'Sign in'}</Button>
        </form>
        <p className="mt-8 border-t border-line pt-5 text-center text-xs leading-5 text-muted">Your administrator account is created through the secure setup command. Ask your project administrator if you need access.</p>
      </div>
    </div>
  </div>;
}
