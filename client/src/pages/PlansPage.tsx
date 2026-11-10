import { useEffect,useState,type FormEvent } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Check,Plus,Search,ToggleLeft,ToggleRight,Pencil } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input,Select } from '../components/ui/input';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '../components/ui/dialog';
import { Table,TBody,TD,TH,THead,TR } from '../components/ui/table';
import { EmptyState,ErrorState,LoadingState } from '../components/QueryState';
import { Field } from '../components/FormField';
import { currency } from '../lib/format';
import { request,type Page as PageResult } from '../lib/api';
import { useToast } from '../lib/toast';
import { StatusBadge } from '../components/StatusBadge';

type Plan={planId:number;planName:string;durationMonths:number;price:number;description:string;isActive:boolean};
export function PlansPage(){
  const [search,setSearch]=useState('');const [editing,setEditing]=useState<Plan|null>(null);const [open,setOpen]=useState(false);const client=useQueryClient();const toast=useToast();
  const plans=useQuery({queryKey:['plans',search],queryFn:()=>request.get<PageResult<Plan>>(`/plans?search=${encodeURIComponent(search)}&pageSize=100`)});
  const update=useMutation({mutationFn:(plan:Plan)=>request.put(`/plans/${plan.planId}`,{planName:plan.planName,durationMonths:plan.durationMonths,price:plan.price,description:plan.description,isActive:!plan.isActive}),onSuccess:()=>{toast('Plan availability updated.');void client.invalidateQueries({queryKey:['plans']});void client.invalidateQueries({queryKey:['subscriptions']});},onError:(error:Error)=>toast(error.message,'error')});
  return <><PageHeader title="Membership plans" description="Set the pricing and duration for your membership options." action={<Button onClick={()=>{setEditing(null);setOpen(true);}}><Plus size={16}/>Add plan</Button>}/>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{plans.data?.rows.slice(0,4).map((plan,index)=><Card key={plan.planId} className="relative overflow-hidden p-5"><span className={`absolute inset-x-0 top-0 h-[3px] ${index===0?'bg-moss':index===1?'bg-[#a5bc59]':index===2?'bg-[#a88455]':'bg-[#7891a7]'}`}/><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted">{plan.planName}</p><p className="mt-2 text-2xl font-semibold tracking-[-.035em]">{currency(plan.price)}</p></div><span className="rounded-lg bg-canvas p-2 text-muted"><Check size={16}/></span></div><p className="mt-3 text-xs text-muted">{plan.durationMonths} {plan.durationMonths===1?'month':'months'} access</p></Card>)}</div>
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Plan catalog</h2><p className="mt-1 text-xs text-muted">Plans attached to membership history stay in the database.</p></div><div className="relative sm:w-72"><Search size={15} className="absolute left-3 top-3 text-muted"/><Input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search plans…" className="pl-9"/></div></div>
      {plans.isLoading?<LoadingState label="Loading plans…"/>:plans.isError?<ErrorState message={plans.error.message} onRetry={()=>void plans.refetch()}/>:!plans.data?.rows.length?<EmptyState title="No plans found" description="Add a plan to offer a membership option."/>:<Table><THead><TR><TH>Plan</TH><TH>Duration</TH><TH>Price</TH><TH>Availability</TH><TH>Description</TH><TH className="text-right">Actions</TH></TR></THead><TBody>{plans.data.rows.map((plan)=><TR key={plan.planId}><TD><span className="font-semibold">{plan.planName}</span></TD><TD>{plan.durationMonths} {plan.durationMonths===1?'month':'months'}</TD><TD className="font-semibold">{currency(plan.price)}</TD><TD><StatusBadge status={plan.isActive?'Active':'Inactive'}/></TD><TD className="max-w-[270px] truncate text-xs text-muted">{plan.description||'—'}</TD><TD><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={()=>{setEditing(plan);setOpen(true);}} aria-label={`Edit ${plan.planName}`}><Pencil size={15}/></Button><Button variant="ghost" size="sm" onClick={()=>update.mutate(plan)} disabled={update.isPending}>{plan.isActive?<><ToggleRight size={16}/>Deactivate</>:<><ToggleLeft size={16}/>Activate</>}</Button></div></TD></TR>)}</TBody></Table>}
    </Card>
    <PlanForm open={open} onOpenChange={setOpen} plan={editing} onSaved={()=>{setOpen(false);void client.invalidateQueries({queryKey:['plans']});}}/>
  </>;
}

function PlanForm({open,onOpenChange,plan,onSaved}:{open:boolean;onOpenChange:(value:boolean)=>void;plan:Plan|null;onSaved:()=>void}){
  const [name,setName]=useState('');const [months,setMonths]=useState('1');const [price,setPrice]=useState('');const [description,setDescription]=useState('');const [active,setActive]=useState('true');const toast=useToast();
  useEffect(()=>{setName(plan?.planName??'');setMonths(String(plan?.durationMonths??1));setPrice(String(plan?.price??''));setDescription(plan?.description??'');setActive(String(plan?.isActive??true));},[plan,open]);
  const mutation=useMutation({mutationFn:()=>{const body={planName:name,durationMonths:Number(months),price:Number(price),description,isActive:active==='true'};return plan?request.put(`/plans/${plan.planId}`,body):request.post('/plans',body);},onSuccess:()=>{toast(plan?'Plan updated.':'Plan created.');onSaved();},onError:(error:Error)=>toast(error.message,'error')});
  const submit=(event:FormEvent)=>{event.preventDefault();mutation.mutate();};
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle className="text-lg font-semibold">{plan?'Edit membership plan':'Create membership plan'}</DialogTitle><DialogDescription>Duration and price are validated and stored in PostgreSQL.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Plan name"><Input required minLength={2} value={name} onChange={(event)=>setName(event.target.value)} placeholder="Monthly Plan"/></Field><div className="grid grid-cols-2 gap-3"><Field label="Duration (months)"><Input type="number" min="1" max="60" required value={months} onChange={(event)=>setMonths(event.target.value)}/></Field><Field label="Price (INR)"><Input type="number" min="0.01" step="0.01" required value={price} onChange={(event)=>setPrice(event.target.value)} placeholder="1800"/></Field></div><Field label="Description"><Input maxLength={500} value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="What this plan includes"/></Field><Field label="Availability"><Select value={active} onChange={(event)=>setActive(event.target.value)}><option value="true">Active</option><option value="false">Inactive</option></Select></Field><div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending?'Saving…':plan?'Save changes':'Create plan'}</Button></div></form></DialogContent></Dialog>;
}
