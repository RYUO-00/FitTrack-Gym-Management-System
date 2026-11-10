import { useState,type FormEvent } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine,CalendarCheck2,LogIn,LogOut,Search,Users } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input,Select } from '../components/ui/input';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '../components/ui/dialog';
import { Table,TBody,TD,TH,THead,TR } from '../components/ui/table';
import { EmptyState,ErrorState,LoadingState } from '../components/QueryState';
import { Field } from '../components/FormField';
import { dateTime,today,number } from '../lib/format';
import { params,request,type Page as PageResult } from '../lib/api';
import { useToast } from '../lib/toast';

type Attendance={attendanceId:number;subscriptionId:number;memberName:string;memberId:number;email:string;planName:string;checkInAt:string;checkOutAt:string|null;trainerName:string|null};
type Option={subscriptionId:number;memberName:string;planName:string;effectiveStatus:string};
export function AttendancePage(){
  const [date,setDate]=useState(today());const [search,setSearch]=useState('');const [open,setOpen]=useState(false);const client=useQueryClient();const toast=useToast();
  const visits=useQuery({queryKey:['attendance',date,search],queryFn:()=>request.get<Attendance[]>(`/attendance${params({date,search})}`)});
  const checkOut=useMutation({mutationFn:(id:number)=>request.patch(`/attendance/${id}/checkout`,{}),onSuccess:()=>{toast('Member check-out recorded.');void client.invalidateQueries({queryKey:['attendance']});void client.invalidateQueries({queryKey:['dashboard']});},onError:(error:Error)=>toast(error.message,'error')});
  const rows=visits.data??[];const openVisits=rows.filter((visit)=>!visit.checkOutAt).length;
  return <><PageHeader title="Attendance" description="Record member check-ins and review daily gym visits." action={<Button onClick={()=>setOpen(true)}><LogIn size={16}/>Check in member</Button>}/>
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Card className="flex items-center gap-3 p-4"><span className="flex size-9 items-center justify-center rounded-lg bg-[#edf4e9] text-moss"><Users size={17}/></span><div><p className="text-xs text-muted">Visits for selected date</p><p className="mt-1 text-lg font-semibold">{number(rows.length)}</p></div></Card><Card className="flex items-center gap-3 p-4"><span className="flex size-9 items-center justify-center rounded-lg bg-[#f4f2e8] text-[#927531]"><CalendarCheck2 size={17}/></span><div><p className="text-xs text-muted">Open gym sessions</p><p className="mt-1 text-lg font-semibold">{number(openVisits)}</p></div></Card><Card className="flex items-center gap-3 p-4"><span className="flex size-9 items-center justify-center rounded-lg bg-canvas text-muted"><ArrowDownToLine size={17}/></span><div><p className="text-xs text-muted">Completed visits</p><p className="mt-1 text-lg font-semibold">{number(rows.length-openVisits)}</p></div></Card></div>
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Attendance history</h2><p className="mt-1 text-xs text-muted">Check-ins require a subscription active on the visit date.</p></div><div className="flex gap-2"><div className="relative min-w-0 flex-1 sm:w-56"><Search size={15} className="absolute left-3 top-3 text-muted"/><Input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search members…" className="pl-9"/></div><Input type="date" value={date} onChange={(event)=>setDate(event.target.value)} className="w-[150px]"/></div></div>
      {visits.isLoading?<LoadingState label="Loading attendance…"/>:visits.isError?<ErrorState message={visits.error.message} onRetry={()=>void visits.refetch()}/>:!rows.length?<EmptyState title="No visits for this date" description="Choose a different date or record a member check-in."/>:<Table><THead><TR><TH>Member</TH><TH>Plan</TH><TH>Check-in</TH><TH>Check-out</TH><TH>Trainer</TH><TH className="text-right">Action</TH></TR></THead><TBody>{rows.map((visit)=><TR key={visit.attendanceId}><TD><span className="block font-semibold">{visit.memberName}</span><span className="mt-1 block text-[10px] text-muted">{visit.email}</span></TD><TD>{visit.planName}</TD><TD className="text-xs text-muted">{dateTime(visit.checkInAt)}</TD><TD className="text-xs text-muted">{visit.checkOutAt?dateTime(visit.checkOutAt):<span className="rounded-full bg-[#edf4e9] px-2 py-1 text-[10px] font-semibold text-moss">In gym</span>}</TD><TD className="text-xs text-muted">{visit.trainerName??'—'}</TD><TD className="text-right">{!visit.checkOutAt&&<Button variant="secondary" size="sm" onClick={()=>checkOut.mutate(visit.attendanceId)} disabled={checkOut.isPending}><LogOut size={14}/>Check out</Button>}</TD></TR>)}</TBody></Table>}
    </Card><CheckInForm open={open} onOpenChange={setOpen} onSaved={()=>{setOpen(false);void client.invalidateQueries({queryKey:['attendance']});void client.invalidateQueries({queryKey:['dashboard']});}}/>
  </>;
}

function CheckInForm({open,onOpenChange,onSaved}:{open:boolean;onOpenChange:(value:boolean)=>void;onSaved:()=>void}){
  const [subscriptionId,setSubscriptionId]=useState('');const toast=useToast();
  const active=useQuery({queryKey:['eligible-attendance'],queryFn:()=>request.get<PageResult<Option>>('/subscriptions?status=ACTIVE&pageSize=100'),enabled:open});
  const mutation=useMutation({mutationFn:()=>request.post('/attendance',{subscriptionId:Number(subscriptionId)}),onSuccess:()=>{toast('Check-in recorded.');onSaved();},onError:(error:Error)=>toast(error.message,'error')});
  const submit=(event:FormEvent)=>{event.preventDefault();mutation.mutate();};
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle className="text-lg font-semibold">Check in a member</DialogTitle><DialogDescription>Only subscriptions active today can be used for a new check-in.</DialogDescription></DialogHeader>{active.isLoading?<LoadingState label="Checking eligible memberships…"/>:active.isError?<ErrorState message={active.error.message}/>:<form onSubmit={submit} className="space-y-4"><Field label="Active member subscription"><Select required value={subscriptionId} onChange={(event)=>setSubscriptionId(event.target.value)}><option value="">Select member and plan</option>{(active.data?.rows??[]).map((sub)=><option key={sub.subscriptionId} value={sub.subscriptionId}>#{sub.subscriptionId} · {sub.memberName} · {sub.planName}</option>)}</Select></Field><p className="rounded-lg bg-canvas p-3 text-xs leading-5 text-muted">The database validates the subscription dates and prevents a second open visit for the same subscription.</p><div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending||!active.data?.rows.length}>{mutation.isPending?'Checking in…':'Record check-in'}</Button></div></form>}</DialogContent></Dialog>;
}
