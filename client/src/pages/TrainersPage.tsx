import { useEffect, useState, type FormEvent } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Eye,Plus,Search,Pencil,Trash2,Dumbbell,Users } from 'lucide-react';
import { request,type Page as PageResult } from '../lib/api';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '../components/ui/dialog';
import { Table,TBody,TD,TH,THead,TR } from '../components/ui/table';
import { EmptyState,ErrorState,LoadingState } from '../components/QueryState';
import { Field } from '../components/FormField';

type Trainer={trainerId:number;trainerName:string;email:string;phone:string;specialization:string;assignedMemberCount:number};
export function TrainersPage(){
  const [search,setSearch]=useState('');const [edit,setEdit]=useState<Trainer|null>(null);const [open,setOpen]=useState(false);const [view,setView]=useState<Trainer|null>(null);
  const client=useQueryClient();const toast=useToast();
  const trainers=useQuery({queryKey:['trainers',search],queryFn:()=>request.get<PageResult<Trainer>>(`/trainers?search=${encodeURIComponent(search)}&pageSize=100`)});
  const remove=useMutation({mutationFn:(id:number)=>request.delete(`/trainers/${id}`),onSuccess:()=>{void client.invalidateQueries({queryKey:['trainers']});toast('Trainer removed. Their historical subscriptions remain in the database.');},onError:(error:Error)=>toast(error.message,'error')});
  const rows=trainers.data?.rows??[];
  return <><PageHeader title="Trainers" description="Manage your coaching team and member assignments." action={<Button onClick={()=>{setEdit(null);setOpen(true);}}><Plus size={16}/>Add trainer</Button>}/>
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Trainer roster</h2><p className="mt-1 text-xs text-muted">Specializations and assigned members</p></div><div className="relative sm:w-72"><Search size={15} className="absolute left-3 top-3 text-muted"/><Input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search trainers…" className="pl-9"/></div></div>
      {trainers.isLoading?<LoadingState label="Loading trainers…"/>:trainers.isError?<ErrorState message={trainers.error.message} onRetry={()=>void trainers.refetch()}/>:rows.length===0?<EmptyState title="No trainers found" description="Add a trainer to manage coaching assignments."/>:<Table><THead><TR><TH>Trainer</TH><TH>Specialization</TH><TH>Assigned members</TH><TH>Contact</TH><TH className="text-right">Actions</TH></TR></THead><TBody>{rows.map((trainer)=><TR key={trainer.trainerId}><TD><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-[#e8eee7] text-forest"><Dumbbell size={16}/></span><span><span className="block font-semibold">{trainer.trainerName}</span><span className="mt-0.5 block text-[11px] text-muted">ID {trainer.trainerId}</span></span></div></TD><TD><span className="rounded-md bg-canvas px-2.5 py-1.5 text-xs text-muted">{trainer.specialization}</span></TD><TD><span className="inline-flex items-center gap-1.5 text-xs font-medium"><Users size={14} className="text-muted"/>{trainer.assignedMemberCount}</span></TD><TD><span className="block text-xs">{trainer.email}</span><span className="mt-1 block text-[11px] text-muted">{trainer.phone}</span></TD><TD><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label="View trainer details" onClick={()=>setView(trainer)}><Eye size={16}/></Button><Button variant="ghost" size="icon" aria-label="Edit trainer" onClick={()=>{setEdit(trainer);setOpen(true);}}><Pencil size={15}/></Button><Button variant="ghost" size="icon" aria-label="Delete trainer" onClick={()=>{if(window.confirm(`Remove ${trainer.trainerName}? Existing subscriptions will keep their history.`))remove.mutate(trainer.trainerId);}}><Trash2 size={15} className="text-rose-600"/></Button></div></TD></TR>)}</TBody></Table>}
    </Card>
    <TrainerForm open={open} onOpenChange={setOpen} trainer={edit} onSaved={()=>{setOpen(false);void client.invalidateQueries({queryKey:['trainers']});void client.invalidateQueries({queryKey:['subscriptions']});}}/>
    <Dialog open={view!==null} onOpenChange={(value)=>{if(!value)setView(null);}}><DialogContent><DialogHeader><DialogTitle className="text-lg font-semibold">Trainer details</DialogTitle><DialogDescription>Contact and current assignment overview.</DialogDescription></DialogHeader>{view&&<div className="space-y-3 rounded-xl bg-canvas p-4 text-sm"><p className="font-semibold">{view.trainerName}</p><p className="text-muted">{view.specialization}</p><p>{view.email} · {view.phone}</p><p className="flex items-center gap-2 border-t border-line pt-3 text-xs text-muted"><Users size={14}/>{view.assignedMemberCount} distinct assigned members</p></div>}</DialogContent></Dialog>
  </>;
}

function TrainerForm({open,onOpenChange,trainer,onSaved}:{open:boolean;onOpenChange:(value:boolean)=>void;trainer:Trainer|null;onSaved:()=>void}){
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [phone,setPhone]=useState('');const [specialization,setSpecialization]=useState('');const toast=useToast();
  useEffect(()=>{setName(trainer?.trainerName??'');setEmail(trainer?.email??'');setPhone(trainer?.phone??'');setSpecialization(trainer?.specialization??'');},[trainer,open]);
  const mutation=useMutation({mutationFn:()=>trainer?request.put(`/trainers/${trainer.trainerId}`,{trainerName:name,email,phone,specialization}):request.post('/trainers',{trainerName:name,email,phone,specialization}),onSuccess:()=>{toast(trainer?'Trainer updated.':'Trainer added.');onSaved();},onError:(error:Error)=>toast(error.message,'error')});
  const submit=(event:FormEvent)=>{event.preventDefault();mutation.mutate();};
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle className="text-lg font-semibold">{trainer?'Edit trainer':'Add trainer'}</DialogTitle><DialogDescription>Trainer contact and specialization details.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Full name"><Input required minLength={2} value={name} onChange={(event)=>setName(event.target.value)}/></Field><Field label="Email"><Input type="email" required value={email} onChange={(event)=>setEmail(event.target.value)}/></Field><Field label="Phone"><Input required minLength={7} value={phone} onChange={(event)=>setPhone(event.target.value)}/></Field><Field label="Specialization"><Input required minLength={2} value={specialization} onChange={(event)=>setSpecialization(event.target.value)} placeholder="Strength & conditioning"/></Field><div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending?'Saving…':trainer?'Save changes':'Add trainer'}</Button></div></form></DialogContent></Dialog>;
}
