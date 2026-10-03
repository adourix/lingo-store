'use client';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const A=process.env.NEXT_PUBLIC_API_URL||"/api";

function SetupForm(){
  const q=useSearchParams();
  const token=q.get("token")||"";
  const [password,setPassword]=useState("");
  const [secret,setSecret]=useState("");
  const [otp,setOtp]=useState("");
  const [codes,setCodes]=useState<string[]>([]);
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!token)return;
    fetch(A+"/admin/auth/setup/"+encodeURIComponent(token))
      .then(r=>r.ok?r.json():Promise.reject())
      .then(x=>setSecret(x.totpSecret||""))
      .catch(()=>setError("Invalid or expired setup link"));
  },[token]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError("");
    const r=await fetch(A+"/admin/users/setup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,password,totpSecret:secret,otp})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setError(j.error||"Setup failed");return}
    setCodes(j.recoveryCodes||[]);
    setDone(true);
  }

  return <main style={{fontFamily:"system-ui",maxWidth:520,margin:"10vh auto"}}>
    {done?<><h1>Account activated</h1><p>Save these recovery codes now. They are shown once.</p><pre>{codes.join("\n")}</pre><p>You can now sign in from the Admin login page.</p></>:<><h1>Staff account setup</h1>{secret&&<p><b>MFA secret:</b> {secret}</p>}<form onSubmit={submit} style={{display:"grid",gap:12}}><input value={password}onChange={e=>setPassword(e.target.value)}type="password"minLength={14}maxLength={128}placeholder="New password"required/><input value={otp}onChange={e=>setOtp(e.target.value)}inputMode="numeric"maxLength={6}placeholder="Current authenticator code"required/><button disabled={!secret||!token}>Activate account</button></form>{error&&<p>{error}</p>}</>}
  </main>;
}

export default function Setup(){
  return <Suspense fallback={<main><h1>Staff account setup</h1><p>Loading…</p></main>}><SetupForm/></Suspense>;
}
