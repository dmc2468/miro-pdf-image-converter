'use client';
import {useMemo,useState} from 'react';
type Row={id:string;source:string;name:string;date?:string|null;racquet?:string|null;main?:string|null;cross?:string|null;tension?:unknown;customerPrice?:unknown;received?:unknown};
type Item={name:string;jobs:number;charged:number;received:number;balance:number;oldest:string|null;days:number};
const n=(v:unknown)=>typeof v==='number'?v:0;
const gbp=(v:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Math.abs(v));
const showDate=(v:string|null)=>v?new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
export function PrivateBalances({rows,onSelectClient}:{rows:Row[];onSelectClient:(name:string)=>void}){
 const [filter,setFilter]=useState('all'),[sort,setSort]=useState('oldest'),[direction,setDirection]=useState<'asc'|'desc'>('asc');
 const items=useMemo(()=>Object.values(rows.filter(r=>r.source==='private').reduce<Record<string,{name:string;jobs:number;charged:number;received:number;oldest:string|null}>>((all,row)=>{
  const key=row.name.trim().toLowerCase(),item=all[key]??{name:row.name.trim(),jobs:0,charged:0,received:0,oldest:null},jobBalance=n(row.customerPrice)-n(row.received);
  item.jobs++;item.charged+=n(row.customerPrice);item.received+=n(row.received);
  if(jobBalance>0&&row.date&&(!item.oldest||row.date<item.oldest))item.oldest=row.date;
  all[key]=item;return all;
 },{})).map(x=>{const balance=x.charged-x.received,days=x.oldest?Math.floor((Date.now()-new Date(x.oldest).valueOf())/86400000):0;return {...x,balance,days}}).filter(x=>Math.abs(x.balance)>.001),[rows]);
 const filtered=items.filter(x=>filter==='all'||filter==='overdue'?(filter==='all'||(x.balance>0&&x.days>14)):filter==='owed'?x.balance>0:x.balance<0);
 const sorter=(a:Item,b:Item)=>{let result=sort==='balance'?Math.abs(a.balance)-Math.abs(b.balance):sort==='client'?a.name.localeCompare(b.name):sort==='jobs'?a.jobs-b.jobs:(a.oldest||'9999').localeCompare(b.oldest||'9999');return direction==='asc'?result:-result};
 const overdue=filtered.filter(x=>x.balance>0&&x.days>14).sort(sorter),current=filtered.filter(x=>!(x.balance>0&&x.days>14)).sort(sorter);
 const table=(list:Item[])=><div className="balance-list"><div className="balance-head"><span>Client</span><span>Jobs</span><span>Oldest owed</span><span>Charged</span><span>Received</span><span>Balance</span><span></span></div>{list.map(x=><div className="balance-row" key={x.name}><button className="client-link" onClick={()=>onSelectClient(x.name)}>{x.name}</button><span>{x.jobs}</span><span>{showDate(x.oldest)}</span><span>{gbp(x.charged)}</span><span>{gbp(x.received)}</span><span className={x.balance>0?'owes-you':'you-owe'}>{x.balance>0?gbp(x.balance)+' owed':gbp(x.balance)+' credit'}</span><button className="edit-button" onClick={()=>onSelectClient(x.name)}>Edit jobs</button></div>)}</div>;
 return <section className="balances-page"><div className="balance-tools"><p>Overdue means more than 14 days after the stringing date.</p><div><label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All balances</option><option value="overdue">Overdue only</option><option value="owed">Amounts owed</option><option value="credit">Credits</option></select></label><label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="oldest">Oldest date</option><option value="balance">Balance</option><option value="client">Client</option><option value="jobs">Job count</option></select></label><button className="sort-arrow" onClick={()=>setDirection(d=>d==='asc'?'desc':'asc')}>{direction==='asc'?'↑':'↓'}</button></div></div>
 {overdue.length?<><div className="balance-section-title overdue-title"><strong>Overdue</strong><span>{overdue.length} client{overdue.length===1?'':'s'}</span></div>{table(overdue)}</>:null}
 {current.length?<><div className="balance-section-title"><strong>{overdue.length?'Other balances':'Balances'}</strong><span>{current.length} client{current.length===1?'':'s'}</span></div>{table(current)}</>:null}
 {!overdue.length&&!current.length?<div className="empty-state">No balances match this filter.</div>:null}
 </section>
}
