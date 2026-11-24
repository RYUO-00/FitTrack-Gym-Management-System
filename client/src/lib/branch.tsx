import { createContext,useContext,useEffect,useState,type ReactNode } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { request,setApiGym,type Page } from './api';
import { LoadingState,ErrorState,EmptyState } from '../components/QueryState';
export type Gym={gymId:number;branchName:string;address:string;city:string;contactNumber:string;email:string;status:'ACTIVE'|'INACTIVE'};
export type Admin={adminId:number;email:string;displayName:string;gymId:number|null};
type BranchState={gym:Gym;gyms:Gym[];user:Admin;switchBranch:(id:number)=>Promise<void>};
const BranchContext=createContext<BranchState|null>(null);
export function useBranch(){const value=useContext(BranchContext);if(!value)throw Error('Branch context is unavailable');return value;}
export function BranchProvider({children}:{children:ReactNode}){
 const client=useQueryClient();const [id,setId]=useState<number>();
 const me=useQuery({queryKey:['me'],queryFn:()=>request.get<{user:Admin}>('/auth/me')});
 const branches=useQuery({queryKey:['gyms'],queryFn:async()=>{
   const all:Gym[]=[];let page=1;let totalPages=1;
   do{const result=await request.get<Page<Gym>>(`/gyms?pageSize=100&page=${page}`);all.push(...result.rows);totalPages=result.pagination.totalPages;page++;}while(page<=totalPages);
   return all;
 },enabled:!!me.data?.user});
 const gyms=branches.data;const user=me.data?.user;
 useEffect(()=>{
  if(!gyms?.length||!user)return;
  const remembered=Number(localStorage.getItem(`fittrack.branch.${user.adminId}`));
  const next=gyms.find(g=>g.gymId===(id??remembered))?.gymId??gyms[0].gymId;
  if(id!==undefined&&id!==next){void client.cancelQueries({predicate:q=>!['me','gyms'].includes(String(q.queryKey[0]))});client.removeQueries({predicate:q=>!['me','gyms'].includes(String(q.queryKey[0]))});}
  setApiGym(next);setId(next);localStorage.setItem(`fittrack.branch.${user.adminId}`,String(next));
 },[gyms,user,id,client]);
 const gym=gyms?.find(g=>g.gymId===id);
 const switchBranch=async(next:number)=>{
  const selected=gyms?.find(g=>g.gymId===next);if(!selected||!gym||next===id)return;
  if(!window.confirm(`Switch branch from "${gym.branchName}" to "${selected.branchName}"?`))return;
  const scoped=(q:{queryKey:readonly unknown[]})=>!['me','gyms'].includes(String(q.queryKey[0]));
  await client.cancelQueries({predicate:scoped});setApiGym(next);
  localStorage.setItem(`fittrack.branch.${user!.adminId}`,String(next));
  client.removeQueries({predicate:scoped});setId(next);
 };
 if(me.isError||branches.isError)return <ErrorState message={me.error?.message??branches.error?.message??'Could not load branches'} onRetry={()=>{void me.refetch();void branches.refetch();}}/>;
 if(gyms?.length===0)return <EmptyState title="No authorized branches" description="Contact an administrator to configure your branch access."/>;
 if(!gym||!user)return <LoadingState label="Loading your branch workspace…"/>;
 return <BranchContext.Provider value={{gym,gyms:gyms!,user,switchBranch}}>{children}</BranchContext.Provider>;
}
