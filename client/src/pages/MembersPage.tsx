import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Mail, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '../components/ui/dialog';
import { Table,THead,TBody,TR,TH,TD } from '../components/ui/table';
import { EmptyState,ErrorState,LoadingState } from '../components/QueryState';
import { date,currency,dateTime } from '../lib/format';
import { params,request,type Page as PageResult } from '../lib/api';
import { useToast } from '../lib/toast';
import { StatusBadge } from '../components/StatusBadge';

type Member={memberId:number;memberName:string;email:string;phone:string;joinDate:string;createdAt:string};
type History={member:Member;subscriptions:{subscriptionId:number;planName:string;startDate:string;endDate:string;effectiveStatus:string;trainerName:string|null}[];payments:{paymentId:number;amount:number;paymentDate:string;paymentMethod:string;paymentStatus:string;planName:string}[]};

export function MembersPage(){
  const [search,setSearch]=useState('');const [debounced,setDebounced]=useState('');const [page,setPage]=useState(1);
  const [editing,setEditing]=useState<Member|null>(null);const [formOpen,setFormOpen]=useState(false);const [viewId,setViewId]=useState<number|null>(null);
  const queryClient=useQueryClient();const toast=useToast();
  useEffect(()=>{const timer=window.setTimeout(()=>{setDebounced(search.trim());setPage(1);},250);return()=>window.clearTimeout(timer);},[search]);
  const members=useQuery({queryKey:['members',debounced,page],queryFn:()=>request.get<PageResult<Member>>(`/members${params({search:debounced,page,pageSize:10})}`)});
  const history=useQuery({queryKey:['member-history',viewId],queryFn:()=>request.get<History>(`/members/${viewId}/history`),enabled:viewId!==null});
  const remove=useMutation({mutationFn:(id:number)=>request.delete(`/members/${id}`),onSuccess:()=>{void queryClient.invalidateQueries({queryKey:['members']});void queryClient.invalidateQueries({queryKey:['dashboard']});toast('Member removed.');},onError:(error:Error)=>toast(error.message,'error')});
  const openCreate=()=>{setEditing(null);setFormOpen(true);};
  const openEdit=(member:Member)=>{setEditing(member);setFormOpen(true);};
  const saved=()=>{setFormOpen(false);setEditing(null);void queryClient.invalidateQueries({queryKey:['members']});void queryClient.invalidateQueries({queryKey:['dashboard']});};
  const rows=members.data?.rows??[];

  return <>
    <PageHeader title="Members" description="Keep member profiles and their gym history in one place." action={<Button onClick={openCreate}><Plus size={16}/>Add member</Button>}/>
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold text-ink">Member directory</h2><p className="mt-1 text-xs text-muted">Search by member, email or phone</p></div><div className="relative w-full sm:max-w-[300px]"><Search size={15} className="absolute left-3 top-3 text-muted"/><Input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search members…" className="pl-9"/><span className="sr-only">Search members by name, email or phone</span></div></div>
      {members.isLoading?<LoadingState label="Loading members…"/>:members.isError?<ErrorState message={members.error.message} onRetry={()=>void members.refetch()}/>:rows.length===0?<EmptyState title={debounced?'No matching members':'No members added yet'} description={debounced?'Try a different name, email or phone number.':'Add a member to start building your gym directory.'}/>:<>
        <Table><THead><TR><TH>Member</TH><TH>Contact</TH><TH>Joined</TH><TH>Record</TH><TH className="text-right">Actions</TH></TR></THead><TBody>{rows.map((member)=><TR key={member.memberId}>
          <TD><button onClick={()=>setViewId(member.memberId)} className="flex items-center gap-3 text-left"><span className="flex size-9 items-center justify-center rounded-full bg-[#e8eee7] text-[11px] font-semibold text-forest">{member.memberName.split(' ').map((part)=>part[0]).slice(0,2).join('').toUpperCase()}</span><span><span className="block font-semibold text-ink hover:text-moss">{member.memberName}</span><span className="mt-0.5 block text-[11px] text-muted">ID {String(member.memberId).padStart(4,'0')}</span></span></button></TD>
          <TD><span className="block text-xs">{member.email}</span><span className="mt-1 block text-[11px] text-muted">{member.phone}</span></TD><TD className="text-xs text-muted">{date(member.joinDate)}</TD><TD><span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf4e9] px-2.5 py-1 text-[10px] font-semibold text-moss"><span className="size-1.5 rounded-full bg-moss"/>Member</span></TD>
          <TD><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`View ${member.memberName}`} onClick={()=>setViewId(member.memberId)}><Eye size={16}/></Button><Button variant="ghost" size="icon" aria-label={`Edit ${member.memberName}`} onClick={()=>openEdit(member)}><Pencil size={15}/></Button><Button variant="ghost" size="icon" aria-label={`Delete ${member.memberName}`} onClick={()=>{if(window.confirm(`Delete ${member.memberName}? This can’t be undone. Members with subscription history are protected by the database.`))remove.mutate(member.memberId);}}><Trash2 size={15} className="text-rose-600"/></Button></div></TD>
        </TR>)}</TBody></Table>
        <div className="flex items-center justify-between border-t border-line px-4 py-3"><p className="text-xs text-muted">Showing <strong className="font-semibold text-ink">{(page-1)*10+1}–{Math.min(page*10,members.data!.pagination.total)}</strong> of {members.data!.pagination.total} members</p><div className="flex gap-1"><Button variant="secondary" size="sm" disabled={page<=1} onClick={()=>setPage((value)=>value-1)}><ChevronLeft size={15}/>Previous</Button><Button variant="secondary" size="sm" disabled={page>=members.data!.pagination.totalPages} onClick={()=>setPage((value)=>value+1)}>Next<ChevronRight size={15}/></Button></div></div>
      </>}
    </Card>
    <MemberForm open={formOpen} onOpenChange={setFormOpen} member={editing} onSaved={saved}/>
    <MemberDetails open={viewId!==null} memberId={viewId} history={history.data} loading={history.isLoading} error={history.isError?history.error.message:undefined} onOpenChange={(open)=>{if(!open)setViewId(null);}}/>
  </>;
}

function MemberForm({open,onOpenChange,member,onSaved}:{open:boolean;onOpenChange:(value:boolean)=>void;member:Member|null;onSaved:()=>void}){
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [phone,setPhone]=useState('');const [joinDate,setJoinDate]=useState('');
  const client=useQueryClient();const toast=useToast();
  useEffect(()=>{setName(member?.memberName??'');setEmail(member?.email??'');setPhone(member?.phone??'');setJoinDate(member?.joinDate?.slice(0,10)??'');},[member,open]);
  const mutation=useMutation({mutationFn:()=>member?request.put(`/members/${member.memberId}`,{memberName:name,email,phone,joinDate:joinDate||undefined}):request.post('/members',{memberName:name,email,phone,joinDate:joinDate||undefined}),onSuccess:()=>{toast(member?'Member details updated.':'Member added.');onSaved();void client.invalidateQueries({queryKey:['members']});},onError:(error:Error)=>toast(error.message,'error')});
  const submit=(event:FormEvent)=>{event.preventDefault();mutation.mutate();};
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle className="text-lg font-semibold text-ink">{member?'Edit member':'Add a member'}</DialogTitle><DialogDescription>Member contact details are unique across the gym directory.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4"><Field label="Full name"><Input required minLength={2} maxLength={120} value={name} onChange={(event)=>setName(event.target.value)} placeholder="Member name"/></Field><Field label="Email address"><Input required type="email" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="name@example.com"/></Field><Field label="Phone number"><Input required minLength={7} value={phone} onChange={(event)=>setPhone(event.target.value)} placeholder="+91 90000 00000"/></Field><Field label="Join date"><Input type="date" value={joinDate} onChange={(event)=>setJoinDate(event.target.value)}/></Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending?'Saving…':member?'Save changes':'Add member'}</Button></div>
    </form></DialogContent></Dialog>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink">{label}</span>{children}</label>;}

function MemberDetails({open,memberId,history,loading,error,onOpenChange}:{open:boolean;memberId:number|null;history?:History;loading:boolean;error?:string;onOpenChange:(open:boolean)=>void}){
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="text-lg font-semibold text-ink">Member history</DialogTitle><DialogDescription>Profile, subscriptions and payment records for this member.</DialogDescription></DialogHeader>
    {loading?<LoadingState label="Loading member history…"/>:error?<ErrorState message={error}/>:history?<div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-canvas p-4"><div className="flex items-center gap-2"><UserRound size={16} className="text-moss"/><span className="text-sm font-semibold text-ink">{history.member.memberName}</span></div><span className="flex items-center gap-1.5 text-xs text-muted"><Mail size={13}/>{history.member.email}</span><span className="text-xs text-muted">{history.member.phone}</span><span className="text-xs text-muted">Joined {date(history.member.joinDate)}</span></div>
      <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-[.08em] text-muted">Subscription history</h3>{history.subscriptions.length?<div className="overflow-hidden rounded-lg border border-line"><Table><THead><TR><TH>Plan</TH><TH>Period</TH><TH>Status</TH></TR></THead><TBody>{history.subscriptions.map((sub)=><TR key={sub.subscriptionId}><TD><span className="block font-medium">{sub.planName}</span><span className="text-[10px] text-muted">{sub.trainerName??'No trainer assigned'}</span></TD><TD className="text-xs text-muted">{date(sub.startDate)} – {date(sub.endDate)}</TD><TD><StatusBadge status={sub.effectiveStatus}/></TD></TR>)}</TBody></Table></div>:<p className="rounded-lg bg-canvas p-4 text-xs text-muted">No subscription records.</p>}</section>
      <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-[.08em] text-muted">Payment history</h3>{history.payments.length?<div className="overflow-hidden rounded-lg border border-line"><Table><THead><TR><TH>Plan</TH><TH>Paid on</TH><TH>Amount</TH><TH>Status</TH></TR></THead><TBody>{history.payments.map((pay)=><TR key={pay.paymentId}><TD>{pay.planName}</TD><TD className="text-xs text-muted">{dateTime(pay.paymentDate)}</TD><TD>{currency(pay.amount)}</TD><TD><StatusBadge status={pay.paymentStatus}/></TD></TR>)}</TBody></Table></div>:<p className="rounded-lg bg-canvas p-4 text-xs text-muted">No payment records.</p>}</section>
    </div>:<EmptyState title="Member not found" description={`Record ${memberId??''} is unavailable.`}/>}</DialogContent></Dialog>;
}
