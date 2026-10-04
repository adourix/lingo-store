"use client";
import { useEffect, useState } from "react";
const API=process.env.NEXT_PUBLIC_API_URL||"/api";
type Dashboard={salesMinor:number|string;invoices:number;products:number;customers:number;expensesMinor:number|string;profitMinor?:number|string};
export default function Dashboard(){const[d,setD]=useState<Dashboard|null>(null),[error,setError]=useState("");
useEffect(()=>{fetch(API+"/admin/dashboard",{credentials:"include"}).then(async r=>{if(r.status===401){location.href="/login";return;}const j=await r.json();if(!r.ok)throw new Error(j.error?.message||j.error);setD(j);}).catch(e=>setError(e.message||"Unable to load dashboard."));},[]);
const money=(x:number|string|undefined)=>x===undefined?"—":(Number(x)/100).toFixed(2)+" EGP";
return <div><p className="admin-muted">Operational overview</p><h1>Dashboard</h1>{error&&<p className="admin-error">{error}</p>}{d&&<div className="admin-grid">{[["Sales today",money(d.salesMinor)],["Invoices",d.invoices],["Products",d.products],["Customers",d.customers],["Expenses",money(d.expensesMinor)],["Profit",money(d.profitMinor)]].map(([label,value])=><article className="admin-card" key={String(label)}><p className="admin-muted">{label}</p><strong style={{fontSize:24}}>{String(value)}</strong></article>)}</div>}<section className="admin-card" style={{marginTop:18}}><h2>Security model</h2><p className="admin-muted">Authorization is enforced by the API. This application is only the operator interface; frontend visibility never grants permission.</p></section></div>}
