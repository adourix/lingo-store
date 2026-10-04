"use client";
import { useEffect, useState } from "react";
const API=process.env.NEXT_PUBLIC_API_URL||"/api";
type Profile={id:string;email:string;name:string;phone?:string|null;emailVerified?:boolean};
export default function AccountPage(){
 const[p,setP]=useState<Profile|null>(null),[name,setName]=useState(""),[phone,setPhone]=useState(""),[error,setError]=useState(""),[saved,setSaved]=useState("");
 async function load(){const r=await fetch(API+"/account/profile",{credentials:"include"});if(r.status===401){location.href="/login";return;}if(!r.ok){setError("Unable to load account.");return;}const x=await r.json();setP(x);setName(x.name||"");setPhone(x.phone||"");}
 useEffect(()=>{load().catch(()=>setError("Unable to load account."));},[]);
 async function save(){setError("");setSaved("");const csrf=await fetch(API+"/auth/csrf",{credentials:"include"}).then(r=>r.json());const r=await fetch(API+"/account/profile",{method:"PATCH",credentials:"include",headers:{"content-type":"application/json","x-csrf-token":csrf.token},body:JSON.stringify({name,phone})});if(!r.ok){const x=await r.json().catch(()=>({}));setError(x.error?.message||x.error||"Update failed.");return;}setP(await r.json());setSaved("Profile saved.");}
 async function logout(){const csrf=await fetch(API+"/auth/csrf",{credentials:"include"}).then(r=>r.json());await fetch(API+"/auth/logout",{method:"POST",credentials:"include",headers:{"content-type":"application/json","x-csrf-token":csrf.token},body:"{}"});location.href="/";}
 if(!p)return <main className="container section"><p>{error||"Loading…"}</p></main>;
 return <main className="container section"><header className="site-header" style={{position:"static",marginBottom:32}}><div className="site-header-inner"><a className="brand" href="/">Lingo Store</a><nav className="nav"><a href="/products">Products</a><a href="/account/security">Security</a><a href="/account/orders">Orders</a><button className="button secondary" onClick={logout}>Sign out</button></nav></div></header>
 <section className="card"><h1>My account</h1><p className="muted">{p.email} · {p.emailVerified?"Verified":"Email not verified"}</p><div className="form-stack" style={{maxWidth:520}}><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Phone<input value={phone} onChange={e=>setPhone(e.target.value)}/></label><button className="button primary" onClick={save}>Save profile</button></div>{saved&&<p className="success">{saved}</p>}{error&&<p className="error">{error}</p>}</section></main>;
}
