import { useQuery } from '@tanstack/react-query';
import { CheckCircle2,Database,KeyRound,LockKeyhole,Server } from 'lucide-react';
import { request } from '../lib/api';
import { Card,CardContent,CardHeader,CardTitle } from '../components/ui/card';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/QueryState';

type User={adminId:number;email:string;displayName:string};
type Health={status:string;database:string};
export function SettingsPage(){
  const user=useQuery({queryKey:['me'],queryFn:()=>request.get<{user:User}>('/auth/me')});
  const health=useQuery({queryKey:['health'],queryFn:()=>request.get<Health>('/health'),retry:1});
  return <><PageHeader title="Settings" description="Administrator account and application status."/>
    <div className="grid gap-3 xl:grid-cols-2"><Card><CardHeader><div><CardTitle>Administrator account</CardTitle><p className="mt-1 text-xs text-muted">Signed-in workspace identity</p></div><span className="rounded-lg bg-[#edf4e9] p-2 text-moss"><KeyRound size={17}/></span></CardHeader><CardContent>{user.isLoading?<LoadingState label="Loading account…"/>:<div className="space-y-4"><div className="rounded-lg bg-canvas p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Name</p><p className="mt-1 text-sm font-semibold">{user.data?.user.displayName??'—'}</p></div><div className="rounded-lg bg-canvas p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Email</p><p className="mt-1 text-sm font-semibold">{user.data?.user.email??'—'}</p></div><div className="flex items-start gap-3 rounded-lg border border-line p-4"><LockKeyhole size={17} className="mt-0.5 text-moss"/><div><p className="text-xs font-semibold">Protected administrator session</p><p className="mt-1 text-xs leading-5 text-muted">The session is held in a signed, HTTP-only cookie. Passwords are stored as bcrypt hashes.</p></div></div></div>}</CardContent></Card>
      <Card><CardHeader><div><CardTitle>Application health</CardTitle><p className="mt-1 text-xs text-muted">Backend connectivity check</p></div><span className="rounded-lg bg-[#edf4e9] p-2 text-moss"><Server size={17}/></span></CardHeader><CardContent><div className="space-y-3"><div className="flex items-center justify-between rounded-lg border border-line p-4"><span className="flex items-center gap-2 text-sm font-medium"><Database size={16} className="text-muted"/>PostgreSQL</span>{health.isLoading?<span className="text-xs text-muted">Checking…</span>:health.data?.database==='connected'?<span className="flex items-center gap-1.5 text-xs font-semibold text-moss"><CheckCircle2 size={15}/>Connected</span>:<span className="text-xs font-semibold text-rose-600">Unavailable</span>}</div><div className="rounded-lg bg-canvas p-4 text-xs leading-5 text-muted">Schema initialization, SQL query examples, functions, procedures, triggers and transaction exercises are provided in the project’s <code className="font-semibold text-ink">database/</code> directory.</div><p className="px-1 text-[10px] text-muted">Health result: {health.error?.message??(health.data?.status??'Waiting for check')}</p></div></CardContent></Card>
    </div>
  </>;
}
