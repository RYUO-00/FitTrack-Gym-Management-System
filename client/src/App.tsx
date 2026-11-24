import { lazy,Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { request } from './lib/api';
import { AppLayout } from './components/AppLayout';
import { LoadingState } from './components/QueryState';
const LoginPage=lazy(()=>import('./pages/LoginPage').then((module)=>({default:module.LoginPage})));
const DashboardPage=lazy(()=>import('./pages/DashboardPage').then((module)=>({default:module.DashboardPage})));
const GymsPage=lazy(()=>import('./pages/GymsPage').then((module)=>({default:module.GymsPage})));
const MembersPage=lazy(()=>import('./pages/MembersPage').then((module)=>({default:module.MembersPage})));
const TrainersPage=lazy(()=>import('./pages/TrainersPage').then((module)=>({default:module.TrainersPage})));
const PlansPage=lazy(()=>import('./pages/PlansPage').then((module)=>({default:module.PlansPage})));
const SubscriptionsPage=lazy(()=>import('./pages/SubscriptionsPage').then((module)=>({default:module.SubscriptionsPage})));
const PaymentsPage=lazy(()=>import('./pages/PaymentsPage').then((module)=>({default:module.PaymentsPage})));
const AttendancePage=lazy(()=>import('./pages/AttendancePage').then((module)=>({default:module.AttendancePage})));
const ReportsPage=lazy(()=>import('./pages/ReportsPage').then((module)=>({default:module.ReportsPage})));
const SettingsPage=lazy(()=>import('./pages/SettingsPage').then((module)=>({default:module.SettingsPage})));

function ProtectedRoutes() {
  const location=useLocation();
  const session=useQuery({queryKey:['me'],queryFn:()=>request.get('/auth/me'),retry:false,staleTime:15_000});
  if(session.isLoading)return <LoadingState label="Opening FitTrack…"/>;
  if(session.isError)return <Navigate to="/login" state={{from:location.pathname}} replace/>;
  return <AppLayout/>;
}

export default function App() {
  return <Suspense fallback={<LoadingState label="Loading FitTrack…"/>}><Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route element={<ProtectedRoutes/>}>
      <Route path="/" element={<DashboardPage/>}/>
      <Route path="/gyms" element={<GymsPage/>}/>
      <Route path="/members" element={<MembersPage/>}/>
      <Route path="/trainers" element={<TrainersPage/>}/>
      <Route path="/plans" element={<PlansPage/>}/>
      <Route path="/subscriptions" element={<SubscriptionsPage/>}/>
      <Route path="/payments" element={<PaymentsPage/>}/>
      <Route path="/attendance" element={<AttendancePage/>}/>
      <Route path="/reports" element={<ReportsPage/>}/>
      <Route path="/settings" element={<SettingsPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense>;
}
