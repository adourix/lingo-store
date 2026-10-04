"use client";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
const API=process.env.NEXT_PUBLIC_API_URL||"/api";
const items=[
["dashboard","Dashboard","dashboard.view"],["sales","Sales","sales.view"],["products","Products","products.view"],["categories","Categories","categories.manage"],["inventory","Inventory","inventory.view"],["purchases","Purchases","purchases.view"],["customers","Customers","customers.view"],["suppliers","Suppliers","suppliers.view"],["payments","Payments","payments.view"],["expenses","Expenses","expenses.view"],["cash-sessions","Cash sessions","cash_session.open"],["terminals","Terminals","terminals.manage"],["reports","Reports","reports.view"],["audit","Audit","audit.view"],["users","Users","users.view"],["roles","Roles","roles.manage"],["sessions","Sessions","admin.access"],["settings","Settings","settings.manage"]
] as const;
export default function AdminChrome({children}:{children:ReactNode}){const path=usePathname();const authPage=path==="/login"||path==="/mfa"||path==="/forgot-password"||path.startsWith("/setup/");const[permissions,setPermissions]=useState<Set<string>>(new Set()),[name,setName]=useState("");
useEffect(()=>{if(authPage)return;fetch(API+"/admin/auth/me",{credentials:"include"}).then(r=>r.ok?r.json():null).then(x=>{if(x){setPermissions(new Set(x.permissions||[]));setName(x.user?.name||x.user?.username||"");}}).catch(()=>{});},[]);
const can=(p:string)=>permissions.has("admin.access")||permissions.has(p);
async function logout(){const csrf=await fetch(API+"/admin/auth/csrf",{credentials:"include"}).then(r=>r.json());await fetch(API+"/admin/auth/logout",{method:"POST",credentials:"include",headers:{"content-type":"application/json","x-csrf-token":csrf.token},body:"{}"});location.href="/login";}
return <div className="admin-shell"><header className="admin-header"><a className="admin-brand" href="/">Lingo Store Admin</a><div style={{display:"flex",gap:14,alignItems:"center"}}><span className="admin-muted">{name}</span><button className="admin-button secondary" onClick={logout}>Sign out</button></div></header><div className="admin-layout"><aside className="admin-sidebar"><nav className="admin-nav">{items.filter(x=>can(x[2])).map(x=><a href={"/"+x[0]} key={x[0]}>{x[1]}</a>)}</nav></aside><main className="admin-main">{children}</main></div></div>}
