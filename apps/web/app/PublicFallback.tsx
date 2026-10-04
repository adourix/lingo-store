"use client";

import { FormEvent, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type User = { id: string; email: string; name: string; emailVerified: boolean };
type Product = { id: string; sku: string; name: string; description: string | null; priceMinor: number | string };

async function csrf() {
  const r = await fetch(API + "/auth/csrf", { credentials: "include" });
  if (!r.ok) throw new Error("Security token unavailable");
  return String((await r.json()).token || "");
}

export default function PublicFallback({ slug }: { slug: string[] }) {
  const path = "/" + slug.join("/");
  const [user,setUser]=useState<User|null>(null),[products,setProducts]=useState<Product[]>([]),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState(""),[done,setDone]=useState(false);

  useEffect(()=>{ if(path.startsWith("/account")) fetch(API+"/auth/me",{credentials:"include"}).then(async r=>{if(r.status===401){location.href="/login";return} if(r.ok)setUser((await r.json()).user)}).catch(()=>{}); },[path]);
  useEffect(()=>{ if(path.startsWith("/products/")) fetch(API+"/public/products",{credentials:"omit"}).then(r=>r.ok?r.json():[]).then((x:Product[])=>setProducts(x.filter(p=>p.sku===decodeURIComponent(slug[1]||"")))).catch(()=>{}); },[path]);

  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError("");try{
      const token=await csrf();let endpoint="/auth/login";let body:Record<string,string>={email,password};
      if(path==="/register"){endpoint="/auth/register";body={email,password,name}}
      else if(path==="/forgot-password"){endpoint="/auth/request-reset";body={email}}
      else if(path==="/reset-password"){endpoint="/auth/reset-password";body={token:new URLSearchParams(location.search).get("token")||"",password}}
      const r=await fetch(API+endpoint,{method:"POST",credentials:"include",headers:{"content-type":"application/json","x-csrf-token":token},body:JSON.stringify(body)});
      const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(typeof j.error==="string"?j.error:j.error?.message||"Request failed");
      setDone(true);if(path==="/login")location.href="/account";
    }catch(x){setError(x instanceof Error?x.message:"Request failed")}
  };

  if(path==="/login"||path==="/register"||path==="/forgot-password"||path==="/reset-password")
    return <main className="site-shell"><section className="container section"><div className="card" style={{maxWidth:520,margin:"48px auto"}}><h1>{path==="/login"?"Sign in":path==="/register"?"Create account":path==="/forgot-password"?"Forgot password":"Reset password"}</h1>{done?<p className="success">Request completed. Check your email if applicable.</p>:<form className="form-stack" onSubmit={submit}>{path==="/register"&&<label>Name<input value={name} onChange={e=>setName(e.target.value)} required/></label>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required={path!="/reset-password"}/></label>{path!="/forgot-password"&&<label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} required/></label>}<button className="button primary">Continue</button>{error&&<p className="error">{error}</p>}</form>}</div></section></main>;

  if(path==="/verify-email"){const token=new URLSearchParams(location.search).get("token")||"";if(!done)fetch(API+"/auth/verify-email",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({token})}).then(r=>setDone(r.ok)).catch(()=>{});return <main className="site-shell"><section className="container section"><div className="card"><h1>Email verification</h1><p>{done?"Your email is verified.":"Verifying your email…"}</p></div></section></main>}

  if(path==="/about")return <main className="site-shell"><section className="container section"><h1>About Lingo Store</h1><div className="card"><p>Lingo Store provides a storefront, back-office administration and browser-based point of sale backed by one secure platform.</p></div></section></main>;

  if(path.startsWith("/account"))return <main className="site-shell"><section className="container section"><h1>My account</h1>{user?<div className="grid"><article className="card"><h2>Profile</h2><p>{user.name}</p><p>{user.email}</p><p>{user.emailVerified?"Email verified":"Email not verified"}</p></article><article className="card"><h2>Orders</h2><p>Orders linked to your business customer account appear here.</p></article></div>:<p>Loading…</p>}</section></main>;

  if(path.startsWith("/products/")){const p=products[0];return <main className="site-shell"><section className="container section">{p?<article className="card"><p className="muted">{p.sku}</p><h1>{p.name}</h1><p>{p.description||"Available in store."}</p><p className="price">{(Number(p.priceMinor)/100).toFixed(2)} EGP</p></article>:<p>Product not found.</p>}</section></main>}

  if(path==="/contact")return <main className="site-shell"><section className="container section"><div className="card"><h1>Contact</h1><p>{message||"Use the contact form on the contact page."}</p></div></section></main>;

  return <main className="site-shell"><section className="container section"><h1>Not found</h1><p>The requested page does not exist.</p></section></main>;
}
