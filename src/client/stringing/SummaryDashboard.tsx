import type { StringingAdjustment, StringingExpense, StringingRow } from "../../shared/stringing";

const amount=(value:unknown)=>typeof value==="number"?value:0;
const gbp=(value:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(value);

export function SummaryDashboard({rows,adjustments,expenses}:{rows:StringingRow[];adjustments:StringingAdjustment[];expenses:StringingExpense[]}){
  const privateRows=rows.filter(row=>row.source==="private"),proRows=rows.filter(row=>row.source==="prostring");
  const privateIncome=privateRows.reduce((sum,row)=>sum+amount(row.customerPrice),0),privateProfit=privateRows.reduce((sum,row)=>sum+amount(row.customerPrice)-amount(row.stringCost),0),proFees=proRows.reduce((sum,row)=>sum+amount(row.dueToMe),0),revenueDueToYou=privateIncome+proFees,estimatedEarnings=privateProfit+proFees;
  const privateOutstanding=privateRows.reduce((sum,row)=>sum+Math.max(amount(row.customerPrice)-amount(row.received),0),0);
  const proBefore=proRows.reduce((sum,row)=>sum+amount(row.dueToMe)-amount(row.cashHeld),0),adjustmentTotal=adjustments.reduce((sum,item)=>sum+(item.type==="supplied"?-item.amount:item.amount),0),proAfter=proBefore+adjustmentTotal;
  const costs=expenses.filter(item=>item.category!=="Sale").reduce((sum,item)=>sum+item.amount,0),sales=expenses.filter(item=>item.category==="Sale").reduce((sum,item)=>sum+item.amount,0),position=estimatedEarnings+sales-costs;
  const paid=privateRows.filter(row=>String(row.payment).toLowerCase()==="paid").length,unpaid=privateRows.length-paid,privateShare=revenueDueToYou?privateIncome/revenueDueToYou*100:0;
  const now=new Date(),months=Array.from({length:6},(_,offset)=>{const date=new Date(now.getFullYear(),now.getMonth()-5+offset,1);return {key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`,label:date.toLocaleDateString("en-GB",{month:"short"}),private:0,pro:0}});
  rows.forEach(row=>{if(!row.date)return;const date=new Date(row.date);if(Number.isNaN(date.valueOf()))return;const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`,month=months.find(item=>item.key===key);if(month)month[row.source==="private"?"private":"pro"]+=amount(row.source==="private"?row.customerPrice:row.dueToMe)});
  const monthMax=Math.max(1,...months.map(month=>month.private+month.pro));
  return <section className="dashboard-page">
    <div className="dashboard-numbers">
      <article className="dashboard-number"><span>Estimated earnings</span><strong>{gbp(estimatedEarnings)}</strong><small>Private profit plus ProString fees</small></article>
      <article className="dashboard-number alert-number"><span>Private payments outstanding</span><strong>{gbp(privateOutstanding)}</strong><small>{unpaid} not marked paid</small></article>
      <article className="dashboard-number"><span>Due to DM after adjustments</span><strong>{gbp(proAfter)}</strong><small>{gbp(proBefore)} before adjustments</small></article>
    </div>
    <div className="dashboard-layout">
      <article className="dashboard-panel income-panel"><header><div><span className="panel-kicker">REVENUE DUE TO YOU</span><h2>Private and ProString fees</h2></div><strong>{gbp(revenueDueToYou)}</strong></header><div className="income-visual"><div className="income-ring" style={{background:`conic-gradient(var(--moss) 0 ${privateShare}%,var(--blue) ${privateShare}% 100%)`}}><div><strong>{rows.length}</strong><span>jobs</span></div></div><div className="income-legend"><div><i className="private-dot"></i><span>Private clients</span><strong>{gbp(privateIncome)}</strong><small>{privateRows.length} jobs</small></div><div><i className="pro-dot"></i><span>ProString fees</span><strong>{gbp(proFees)}</strong><small>{proRows.length} jobs</small></div></div></div></article>
      <article className="dashboard-panel trend-panel"><header><div><span className="panel-kicker">LAST 6 MONTHS</span><h2>Monthly revenue due to you</h2></div></header><div className="mini-chart">{months.map(month=><div className="mini-month" key={month.key}><div className="mini-bars"><i className="private-bar" style={{height:`${month.private/monthMax*100}%`}} title={`Private ${gbp(month.private)}`}></i><i className="pro-bar" style={{height:`${month.pro/monthMax*100}%`}} title={`ProString fees ${gbp(month.pro)}`}></i></div><strong>{gbp(month.private+month.pro)}</strong><span>{month.label}</span></div>)}</div><div className="chart-key"><span><i className="private-dot"></i>Private</span><span><i className="pro-dot"></i>ProString fees</span></div></article>
      <article className="dashboard-panel payment-panel"><header><div><span className="panel-kicker">PRIVATE CLIENTS</span><h2>Payment status</h2></div><strong>{paid}/{privateRows.length}</strong></header><div className="payment-progress"><i style={{width:`${privateRows.length?paid/privateRows.length*100:0}%`}}></i></div><div className="payment-stats"><div><strong>{paid}</strong><span>Paid</span></div><div><strong>{unpaid}</strong><span>Not paid</span></div><div><strong>{gbp(privateProfit)}</strong><span>Private profit</span></div></div></article>
      <article className="dashboard-panel position-panel"><header><div><span className="panel-kicker">OVERALL POSITION</span><h2>After expenses</h2></div><strong className={position<0?"negative":""}>{gbp(position)}</strong></header><div className="position-lines"><div><span>Estimated earnings</span><strong>{gbp(estimatedEarnings)}</strong></div><div><span>Items sold</span><strong>+ {gbp(sales)}</strong></div><div><span>Expenses</span><strong>− {gbp(costs)}</strong></div></div></article>
    </div>
  </section>;
}
