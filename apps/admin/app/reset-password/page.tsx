'use client';

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const A=process.env.NEXT_PUBLIC_API_URL||"/api";

function ResetForm(){
  const q=useSearchParams();
  const [password,setPassword]=useState("");
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();
    const r=await fetch(A+"/admin/auth/reset-password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:q.get("token")||"",password})});
    const j=await r.json().catch(()=>({}));
    if(r.ok)setDone(true);else setError(j.error||"Reset failed");
  }
  return <main><h1>Reset staff password</h1>{done?<p>Password reset. Sign in and complete MFA.</p>:<form onSubmit={submit}><input value={password}onChange={e=>setPassword(e.target.value)}type="password"minLength={14}maxLength={128}required/><button type="submit">Reset password</button><p>{error}</p></form>}</main>;
}

export default function Reset(){
  return <Suspense fallback={<main><h1>Reset staff password</h1><p>Loading…</p></main>}><ResetForm/></Suspense>;
}
