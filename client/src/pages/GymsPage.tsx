import { useEffect,useState,type FormEvent } from 'react';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { Building2,Pencil,Plus,Search } from 'lucide-react';
import { useBranch,type Gym } from '../lib/branch';
import { request } from '../lib/api';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input,Select } from '../components/ui/input';
import { Field } from '../components/FormField';
import { StatusBadge } from '../components/StatusBadge';
import { Table,THead,TBody,TR,TH,TD } from '../components/ui/table';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '../components/ui/dialog';
import { EmptyState } from '../components/QueryState';

type Form={branchName:string;address:string;city:string;contactNumber:string;email:string;status:'ACTIVE'|'INACTIVE'};
const blank:Form={branchName:'',address:'',city:'',contactNumber:'',email:'',status:'ACTIVE'};
export function GymsPage(){
 const {gyms,gym,user}=useBranch();const client=useQueryClient();const toast=useToast();
 const [search,setSearch]=useState('');const [open,setOpen]=useState(false);const [editing,setEditing]=useState<Gym|null>(null);const [form,setForm]=useState<Form>(blank);
 useEffect(()=>{setForm(editing?{...editing}:blank);},[editing,open]);
 const refresh=()=>{void client.invalidateQueries({queryKey:['gyms']});};
 const save=useMutation({mutationFn:()=>editing?request.put(`/gyms/${editing.gymId}`,form):request.post('/gyms',form),onSuccess:()=>{setOpen(false);refresh();toast(editing?'Branch updated.':'Branch added. Select it in the workspace header to switch.');},onError:(e:Error)=>toast(e.message,'error')});
 const toggle=useMutation({mutationFn:(g:Gym)=>request.put(`/gyms/${g.gymId}`,{...g,status:g.status==='ACTIVE'?'INACTIVE':'ACTIVE'}),onSuccess:()=>{refresh();toast('Branch status updated. Existing history is preserved.');},onError:(e:Error)=>toast(e.message,'error')});
 const rows=gyms.filter(g=>`${g.branchName} ${g.city} ${g.address}`.toLowerCase().includes(search.toLowerCase()));
 const field=(name:keyof Form,value:string)=>setForm(v=>({...v,[name]:value}));
 const submit=(e:FormEvent)=>{e.preventDefault();save.mutate();};
 return <><PageHeader title="Gym branches" description="Manage branch contact details and availability." action={user.gymId===null?<Button onClick={()=>{setEditing(null);setOpen(true);}}><Plus size={16}/>Add branch</Button>:undefined}/>
 <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="text-sm font-semibold">Branch directory</h2><p className="mt-1 text-xs text-muted">Current workspace: {gym.branchName}. Inactive branches retain their history.</p></div><div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search branch or city" className="pl-9"/></div></div>
 {rows.length?<Table><THead><TR><TH>Branch</TH><TH>Address</TH><TH>Contact</TH><TH>Status</TH><TH className="text-right">Actions</TH></TR></THead><TBody>{rows.map(g=><TR key={g.gymId}><TD><div className="flex items-center gap-2"><Building2 size={16}/><div><span className="font-semibold">{g.branchName}</span><p className="mt-1 text-xs text-muted">{g.city} · #{g.gymId}</p></div></div></TD><TD className="max-w-xs whitespace-normal text-xs">{g.address}</TD><TD><p className="text-xs">{g.contactNumber}</p><p className="mt-1 text-xs text-muted">{g.email}</p></TD><TD><StatusBadge status={g.status}/></TD><TD><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${g.branchName}`} onClick={()=>{setEditing(g);setOpen(true);}}><Pencil size={15}/></Button><Button variant="secondary" size="sm" disabled={toggle.isPending} onClick={()=>{if(window.confirm(`${g.status==='ACTIVE'?'Deactivate':'Activate'} "${g.branchName}"? ${g.status==='ACTIVE'?'New memberships and check-ins will stop; saved history stays available.':''}`))toggle.mutate(g);}}>{g.status==='ACTIVE'?'Deactivate':'Activate'}</Button></div></TD></TR>)}</TBody></Table>:<EmptyState title="No matching branches" description="Try a different branch name or city."/>}</Card>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing?'Edit branch':'Add gym branch'}</DialogTitle><DialogDescription>Branch details are saved in PostgreSQL. No separate branch password is needed.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Branch name"><Input required minLength={2} maxLength={120} value={form.branchName} onChange={e=>field('branchName',e.target.value)}/></Field><Field label="Address"><Input required maxLength={500} value={form.address} onChange={e=>field('address',e.target.value)}/></Field><div className="grid grid-cols-2 gap-3"><Field label="City"><Input required minLength={2} maxLength={100} value={form.city} onChange={e=>field('city',e.target.value)}/></Field><Field label="Contact number"><Input required type="tel" minLength={7} maxLength={30} value={form.contactNumber} onChange={e=>field('contactNumber',e.target.value)}/></Field></div><Field label="Email"><Input required type="email" value={form.email} onChange={e=>field('email',e.target.value)}/></Field><Field label="Status"><Select value={form.status} onChange={e=>field('status',e.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select></Field><div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={save.isPending}>{save.isPending?'Saving…':editing?'Save changes':'Add branch'}</Button></div></form></DialogContent></Dialog>
 </>;
}
