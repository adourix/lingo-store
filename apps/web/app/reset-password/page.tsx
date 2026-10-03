'use client';

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const A=process.env.NEXT_PUBLIC_API_URL||"/api";

function ResetForm(){
  const q=useSearchParams();
  const [password,setPassword]=useState("");
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");

  return <main>
    <h1>Reset password</h1>
    {done?<p>Password reset. Sign in again.</p>:<form onSubmit={async e=>{
      e.preventDefault();
      setError("");
      const r=await fetch(A+"/auth/reset-password",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({token:q.get("token")||"",password})
      });
      const j=await r.json().catch(()=>({}));
      if(r.ok)setDone(true);
      else setError(j.error||"Reset failed");
    }}>
      <input type="password" minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required/>
      <button type="submit">Reset password</button>
      <p>{error}</p>
    </form>}
  </main>;
}

export default function Reset(){
  return <Suspense fallback={<main><h1>Reset password</h1><p>Loading…</p></main>}><ResetForm/></Suspense>;
}
