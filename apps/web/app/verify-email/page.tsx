'use client';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const A=process.env.NEXT_PUBLIC_API_URL||"/api";

function VerifyForm(){
  const q=useSearchParams();
  const [ok,setOk]=useState(false);
  useEffect(()=>{
    fetch(A+"/auth/verify-email",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({token:q.get("token")||""})
    }).then(r=>setOk(r.ok));
  },[q]);
  return <main><h1>{ok?"Email verified":"Verifying email…"}</h1></main>;
}

export default function Verify(){
  return <Suspense fallback={<main><h1>Verifying email…</h1></main>}><VerifyForm/></Suspense>;
}
