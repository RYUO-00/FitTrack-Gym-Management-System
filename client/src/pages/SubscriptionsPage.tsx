import { useState,type FormEvent } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { ChevronLeft,ChevronRight,Plus,RefreshCcw,Search,Ban } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input,Select } from '../components/ui/input';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '../components/ui/dialog';
import { Table,TBody,TD,TH,THead,TR } from '../components/ui/table';
import { EmptyState,ErrorState,LoadingState } from '../components/QueryState';
import { Field } from '../components/FormField';
import { StatusBadge } from '../components/StatusBadge';
import { currency,date,number,today } from '../lib/format';
import { params,request,type Page as PageResult } from '../lib/api';
import { useToast } from '../lib/toast';

type Subscription={subscriptionId:number;memberId:number;planId:number;trainerId:number|null;memberName:string;planName:string;trainerName:string|null;startDate:string;endDate:string;status:string;effectiveStatus:string;price:number};
type Option={memberId:number;memberName:string;email:string;planId:number;planName:string;price:number;trainerId:number;trainerName:string;isActive:boolean};

export function SubscriptionsPage(){
  const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [page,setPage]=useState(1);const [open,setOpen]=useState(false);const [renewing,setRenewing]=useState<Subscription|null>(null);
  const client=useQueryClient();const toast=useToast();
  const subscriptions=useQuery({queryKey:['subscriptions',search,status,page],queryFn:()=>request.get<PageResult<Subscription>>(`/subscriptions${params({search,status,page,pageSize:10})}`)});
  const cancel=useMutation({mutationFn:(id:number)=>request.post(`/subscriptions/${id}/cancel`,{}),onSuccess:()=>{toast('Subscription cancelled. The original history is retained.');void client.invalidateQueries({queryKey:['subscriptions']});void client.invalidateQueries({queryKey:['dashboard']});},onError:(error:Error)=>toast(error.message,'error')});
  const rows=subscriptions.data?.rows??[];
  return <><PageHeader title="Subscriptions" description="Create, renew and track each member’s subscription history." action={<Button onClick={()=>{setRenewing(null);setOpen(true);}}><Plus size={16}/>New subscription</Button>}/>
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-sm font-semibold">Membership timeline</h2><p className="mt-1 text-xs text-muted">Renewals create a new record and keep previous terms intact.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative sm:w-64"><Search size={15} className="absolute left-3 top-3 text-muted"/><Input value={search} onChange={(event)=>{setSearch(event.target.value);setPage(1);}} placeholder="Search member or plan…" className="pl-9"/></div><Select value={status} onChange={(event)=>{setStatus(event.target.value);setPage(1);}} className="sm:w-40"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="UPCOMING">Upcoming</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option></Select></div></div>
      {subscriptions.isLoading?<LoadingState label="Loading subscriptions…"/>:subscriptions.isError?<ErrorState message={subscriptions.error.message} onRetry={()=>void subscriptions.refetch()}/>:rows.length===0?<EmptyState title="No subscriptions found" description="Create a subscription to start a member’s gym access history."/>:<>
        <Table><THead><TR><TH>Member & plan</TH><TH>Trainer</TH><TH>Coverage</TH><TH>Effective status</TH><TH className="text-right">Actions</TH></TR></THead><TBody>{rows.map((sub)=><TR key={sub.subscriptionId}><TD><span className="block font-semibold">{sub.memberName}</span><span className="mt-1 block text-[11px] text-muted">{sub.planName} · {currency(sub.price)}</span></TD><TD className="text-xs text-muted">{sub.trainerName??'Unassigned'}</TD><TD><span className="block text-xs">{date(sub.startDate)} – {date(sub.endDate)}</span><span className="mt-1 block text-[10px] text-muted">Subscription #{sub.subscriptionId}</span></TD><TD><StatusBadge status={sub.effectiveStatus}/></TD><TD><div className="flex justify-end gap-1"><Button variant="secondary" size="sm" onClick={()=>{setRenewing(sub);setOpen(true);}}><RefreshCcw size={13}/>Renew</Button>{sub.effectiveStatus!=='CANCELLED'&&<Button variant="ghost" size="icon" aria-label="Cancel subscription" onClick={()=>{if(window.confirm(`Cancel ${sub.memberName}’s ${sub.planName} subscription? This change is retained in history.`))cancel.mutate(sub.subscriptionId);}}><Ban size={15} className="text-rose-600"/></Button>}</div></TD></TR>)}</TBody></Table>
        <div className="flex items-center justify-between border-t border-line px-4 py-3"><p className="text-xs text-muted">{number(subscriptions.data!.pagination.total)} subscription records</p><div className="flex gap-1"><Button variant="secondary" size="sm" disabled={page<=1} onClick={()=>setPage((value)=>value-1)}><ChevronLeft size={15}/>Previous</Button><Button variant="secondary" size="sm" disabled={page>=subscriptions.data!.pagination.totalPages} onClick={()=>setPage((value)=>value+1)}>Next<ChevronRight size={15}/></Button></div></div>
      </>}
    </Card>
    <SubscriptionForm open={open} onOpenChange={setOpen} renewal={renewing} onSaved={()=>{setOpen(false);setRenewing(null);void client.invalidateQueries({queryKey:['subscriptions']});void client.invalidateQueries({queryKey:['dashboard']});void client.invalidateQueries({queryKey:['payments']});}}/>
  </>;
}

function SubscriptionForm({open,onOpenChange,renewal,onSaved}:{open:boolean;onOpenChange:(value:boolean)=>void;renewal:Subscription|null;onSaved:()=>void}){
  const [memberId,setMemberId]=useState('');const [planId,setPlanId]=useState('');const [trainerId,setTrainerId]=useState('');const [startDate,setStartDate]=useState(today());const [takePayment,setTakePayment]=useState(false);const [amount,setAmount]=useState('');const [method,setMethod]=useState('UPI');const toast=useToast();
  const members=useQuery({queryKey:['member-options'],queryFn:()=>request.get<PageResult<Option>>('/members?pageSize=100'),enabled:open&&!renewal});
  const plans=useQuery({queryKey:['plan-options'],queryFn:()=>request.get<PageResult<Option>>('/plans?pageSize=100'),enabled:open});
  const trainers=useQuery({queryKey:['trainer-options'],queryFn:()=>request.get<PageResult<Option>>('/trainers?pageSize=100'),enabled:open});
  const mutation=useMutation({mutationFn:()=>{
    const payment=takePayment?{amount:Number(amount),paymentMethod:method}:{};
    return renewal?request.post(`/subscriptions/${renewal.subscriptionId}/renew`,{planId:Number(planId),trainerId:trainerId?Number(trainerId):null,startDate,...payment}):request.post('/subscriptions',{memberId:Number(memberId),planId:Number(planId),trainerId:trainerId?Number(trainerId):null,startDate,...payment});
  },onSuccess:()=>{toast(renewal?'Renewal added to subscription history.':'Subscription created.');onSaved();},onError:(error:Error)=>toast(error.message,'error')});
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(takePayment&&!window.confirm(`Create this subscription and record ${currency(amount)} as a paid ${method.replace('_',' ')} transaction?`))return;
    mutation.mutate();
  };
  const planRows=(plans.data?.rows??[]).filter((plan)=>plan.isActive);
  const loading=(!renewal&&members.isLoading)||plans.isLoading||trainers.isLoading;
  const failed=members.isError||plans.isError||trainers.isError;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle className="text-lg font-semibold">{renewal?'Renew subscription':'Create subscription'}</DialogTitle><DialogDescription>{renewal?`A new history record will be added for ${renewal.memberName}.`:'Choose the member, plan, and start date for gym access.'}</DialogDescription></DialogHeader>
    {loading?<LoadingState label="Loading membership options…"/>:failed?<ErrorState message="Could not load members, plans or trainers. Close this form and try again."/>:<form onSubmit={submit} className="space-y-4">
      {renewal?<div className="rounded-lg bg-canvas px-3 py-2.5 text-xs"><span className="font-semibold text-ink">{renewal.memberName}</span><span className="ml-2 text-muted">Previous: {renewal.planName} through {date(renewal.endDate)}</span></div>:<Field label="Member"><Select required value={memberId} onChange={(event)=>setMemberId(event.target.value)}><option value="">Select a member</option>{(members.data?.rows??[]).map((member)=><option key={member.memberId} value={member.memberId}>{member.memberName} · {member.email}</option>)}</Select></Field>}
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Membership plan"><Select required value={planId} onChange={(event)=>setPlanId(event.target.value)}><option value="">Select a plan</option>{planRows.map((plan)=><option key={plan.planId} value={plan.planId}>{plan.planName} · {currency(plan.price)}</option>)}</Select></Field><Field label="Assign trainer (optional)"><Select value={trainerId} onChange={(event)=>setTrainerId(event.target.value)}><option value="">No trainer</option>{(trainers.data?.rows??[]).map((trainer)=><option key={trainer.trainerId} value={trainer.trainerId}>{trainer.trainerName}</option>)}</Select></Field></div>
      <Field label="Start date" hint={renewal?'If current coverage continues, the renewal will start after its end date.':'Expiry is calculated from the selected plan duration.'}><Input type="date" required value={startDate} onChange={(event)=>setStartDate(event.target.value)}/></Field>
      <label className="flex items-center gap-2 rounded-lg border border-line p-3 text-xs font-medium text-ink"><input type="checkbox" checked={takePayment} onChange={(event)=>setTakePayment(event.target.checked)} className="accent-moss"/>Record an initial payment in the same transaction</label>
      {takePayment&&<div className="grid grid-cols-2 gap-3"><Field label="Payment amount"><Input type="number" min="0.01" step="0.01" required value={amount} onChange={(event)=>setAmount(event.target.value)}/></Field><Field label="Payment method"><Select value={method} onChange={(event)=>setMethod(event.target.value)}><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option></Select></Field></div>}
      <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending||planRows.length===0}>{mutation.isPending?'Saving…':renewal?'Create renewal':'Create subscription'}</Button></div>
    </form>}
  </DialogContent></Dialog>;
}
