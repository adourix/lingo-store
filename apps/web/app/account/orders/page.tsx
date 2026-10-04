"use client";
import { useEffect, useState } from "react";
const API=process.env.NEXT_PUBLIC_API_URL||"/api";
type Order={id:string;invoiceNo:string;status:string;totalMinor:number|string};
export default function OrdersPage(){const[data,setData]=useState<Order[]>([]),[error,setError]=useState("");
useEffect(()=>{fetch(API+"/account/orders",{credentials:"include"}).then(async r=>{if(r.status===401){location.href="/login";return;}if(!r.ok)throw new Error();setData(await r.json());}).catch(()=>setError("Orders are not available yet."));},[]);
return <main className="container section"><a className="brand" href="/account">Lingo Store</a><h1>My orders</h1>{error?<p className="error">{error}</p>:data.length===0?<section className="card"><p className="muted">No orders yet.</p></section>:<div className="grid">{data.map(x=><article className="card" key={x.id}><h2>{x.invoiceNo}</h2><p>{x.status}</p><p className="price">{(Number(x.totalMinor)/100).toFixed(2)} EGP</p></article>)}</div>}</main>}
