import { useState } from "react";
export type Expense = {
  id: string;
  date: string;
  supplier: string;
  category: string;
  description: string;
  amount: number;
  notes?: string;
  receipt?: { name: string; key: string; contentType: string };
};
export type StringPrice = {
  id: string;
  brand: string;
  name: string;
  gauge: string;
  type: string;
  costPerRacket: number;
  setCost?: number;
  reel100Cost?: number;
  reel200Cost?: number;
  purchaseFormat?: "set" | "100m" | "200m";
  priceToCustomer?: number;
  customerPriceOverride?: number | null;
  priceSource?: string;
  colour?: string;
  hardness?: string;
  characteristics?: string[];
  reelPriceUrl?: string;
  inStock?: boolean;
};
const gbp = (v: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    v,
  );
const retailerOptions=(brand:string)=>{const key=brand.toLowerCase();if(key.includes("toroline"))return [{value:"ph-tennis",label:"PH Tennis",domain:"phtennis.com"},{value:"manual",label:"Manual input"}];if(key.includes("pro string"))return [{value:"manual",label:"Manual input"}];if(key.includes("yonex"))return [{value:"all-things-tennis",label:"All Things Tennis",domain:"allthingstennis.co.uk"},{value:"manual",label:"Manual input"}];if(key.includes("head"))return [{value:"all-things-tennis",label:"All Things Tennis",domain:"allthingstennis.co.uk"},{value:"amazon",label:"Amazon",domain:"amazon.co.uk"},{value:"manual",label:"Manual input"}];if(key.includes("babolat"))return [{value:"all-things-tennis",label:"All Things Tennis",domain:"allthingstennis.co.uk"},{value:"manual",label:"Manual input"}];if(key.includes("tecnifibre")||key.includes("technifibre"))return [{value:"all-things-tennis",label:"All Things Tennis",domain:"allthingstennis.co.uk"},{value:"decathlon",label:"Decathlon",domain:"decathlon.co.uk"},{value:"amazon",label:"Amazon",domain:"amazon.co.uk"},{value:"manual",label:"Manual input"}];return [{value:"google",label:"Google Shopping"},{value:"manual",label:"Manual input"}]};
export function Expenses({
  items,
  onChange,
  token,
  grossProfit,
}: {
  items: Expense[];
  onChange: (v: Expense[]) => void;
  token: string;
  grossProfit: number;
}) {
  const blank = () => ({
    id: `expense-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    supplier: "",
    category: "String stock",
    description: "",
    amount: 0,
    notes: "",
  });
  const [draft, setDraft] = useState<Expense | null>(null);
  const total = items.filter(x=>x.category!=="Sale").reduce((s, x) => s + x.amount, 0);
  const sales = items.filter(x=>x.category==="Sale").reduce((s,x)=>s+x.amount,0);
  async function receipt(file: File, item: Expense) {
    const form = new FormData();
    form.append("receipt", file);
    const response = await fetch(`/api/stringing/expenses/${item.id}/receipt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (response.ok) {
      const body = await response.json();
      onChange(
        items.map((x) =>
          x.id === item.id ? { ...x, receipt: body.receipt } : x,
        ),
      );
    }
  }
  async function openReceipt(item: Expense) {
    const response=await fetch(`/api/stringing/expenses/${item.id}/receipt`,{headers:{Authorization:`Bearer ${token}`}});
    if(response.ok) window.open(URL.createObjectURL(await response.blob()),"_blank");
  }
  return (
    <section className="finance-page">
      <div className="finance-summary">
        <article>
          <span>Gross profit from stringing</span>
          <strong>{gbp(grossProfit)}</strong>
        </article>
        <article>
          <span>Total stringing expenses</span>
          <strong>{gbp(total)}</strong>
        </article>
        <article>
          <span>Items sold</span>
          <strong>{gbp(sales)}</strong>
        </article>
        <article>
          <span>Position after expenses</span>
          <strong>{gbp(grossProfit + sales - total)}</strong>
        </article>
      </div>
      <div className="finance-head">
        <div>
          <h2>All expenses</h2>
          <p>Equipment, training, string stock and other business costs.</p>
        </div>
        <button className="primary" onClick={() => setDraft(blank())}>
          + Add expense
        </button>
      </div>
      <div className="finance-list">
        <div className="finance-row finance-labels">
          <span>Date</span>
          <span>Supplier / description</span>
          <span>Category</span>
          <span>Amount</span>
          <span>Receipt</span>
          <span>Notes</span>
          <span></span>
        </div>
        {items.filter(x=>x.category!=="Sale").map((x) => (
          <div className="finance-row" key={x.id}>
            <span>{new Date(x.date).toLocaleDateString("en-GB")}</span>
            <span>
              <strong>{x.supplier}</strong>
              <small>{x.description}</small>
            </span>
            <span>{x.category}</span>
            <span>{gbp(x.amount)}</span>
            <span>
              {x.receipt ? (
                <button className="receipt-link" onClick={()=>void openReceipt(x)}>
                  {x.receipt.name}
                </button>
              ) : (
                <label className="upload-link">
                  Upload
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      e.target.files?.[0] && void receipt(e.target.files[0], x)
                    }
                  />
                </label>
              )}
            </span>
            <span className="expense-notes">{x.notes || "—"}</span>
            <button className="edit-button" onClick={() => setDraft({ ...x })}>
              Edit
            </button>
          </div>
        ))}
      </div>
      <div className="finance-head sold-head"><div><h2>Items sold</h2><p>Money recovered from equipment and other stringing assets.</p></div></div>
      <div className="finance-list sold-list">
        <div className="finance-row finance-labels"><span>Date</span><span>Supplier / description</span><span>Category</span><span>Amount</span><span></span><span>Notes</span><span></span></div>
        {items.filter(x=>x.category==="Sale").map(x=><div className="finance-row" key={x.id}><span>{new Date(x.date).toLocaleDateString("en-GB")}</span><span><strong>{x.supplier}</strong><small>{x.description}</small></span><span>{x.category}</span><span>{gbp(x.amount)}</span><span></span><span className="expense-notes">{x.notes || "—"}</span><button className="edit-button" onClick={()=>setDraft({...x})}>Edit</button></div>)}
      </div>
      {draft ? (
        <div className="modal-backdrop">
          <form
            className="edit-modal"
            onSubmit={(e) => {
              e.preventDefault();
              onChange([...items.filter((x) => x.id !== draft.id), draft]);
              setDraft(null);
            }}
          >
            <div className="edit-head">
              <h2>Expense</h2>
              <button type="button" onClick={() => setDraft(null)}>
                ×
              </button>
            </div>
            <div className="edit-grid">
              <label>
                Date
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <label>
                Supplier
                <input
                  value={draft.supplier}
                  onChange={(e) =>
                    setDraft({ ...draft, supplier: e.target.value })
                  }
                />
              </label>
              <label>
                Category
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                >
                  <option>Equipment</option>
                  <option>Training</option>
                  <option>String stock</option>
                  <option>Tools</option>
                  <option>Travel</option>
                  <option>Other</option>
                  <option>Sale</option>
                </select>
              </label>
              <label>
                Amount
                <input
                  type="number"
                  step=".01"
                  value={draft.amount}
                  onChange={(e) =>
                    setDraft({ ...draft, amount: Number(e.target.value) })
                  }
                />
              </label>
              <label className="wide">
                Description
                <input
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Notes
                <input value={draft.notes??""} onChange={e=>setDraft({...draft,notes:e.target.value})}/>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
              <button className="primary">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
export function StringCosts({
  items,
  onChange,
}: {
  items: StringPrice[];
  onChange: (v: StringPrice[]) => void;
}) {
  const blank = () => ({
    id: `string-${Date.now()}`,
    brand: "",
    name: "",
    gauge: "",
    type: "Poly",
    costPerRacket: 0,
    setCost: 0,
    reel100Cost: 0,
    reel200Cost: 0,
    purchaseFormat: "set" as const,
    priceToCustomer: 0,
    priceSource: "manual",
    inStock: true,
  });
  const [d, setD] = useState<StringPrice | null>(null);
  const [showCostDetails,setShowCostDetails]=useState(false);
  const [query,setQuery]=useState(""),[brandFilter,setBrandFilter]=useState("all"),[typeFilter,setTypeFilter]=useState("all"),[formatFilter,setFormatFilter]=useState("all");
  const [sortBy,setSortBy]=useState<"name"|"customer"|"cost"|"markup">("name"),[sortDirection,setSortDirection]=useState<"asc"|"desc">("asc");
  const effectivePrice=(item:StringPrice)=>{if(item.customerPriceOverride!=null)return item.customerPriceOverride;const price=item.priceToCustomer??item.setCost??0;return item.priceSource==="manual"?price:Math.ceil(price)};
  const markup=(item:StringPrice)=>item.costPerRacket===0?"—":`${(((effectivePrice(item)-item.costPerRacket)/item.costPerRacket)*100).toFixed(1)}%`;
  const calculatedCost=(item:StringPrice)=>item.purchaseFormat==="100m"?(item.reel100Cost??0)/8:item.purchaseFormat==="200m"?(item.reel200Cost??0)/17:(item.setCost??0);
  const sources=d?retailerOptions(d.brand):[];
  const selectedSource=d?sources.find(source=>source.value===(d.priceSource??sources[0]?.value)):undefined;
  const brands=Array.from(new Set(items.map(x=>x.brand).filter(Boolean))).sort();
  const types=Array.from(new Set(items.map(x=>x.type).filter(Boolean))).sort();
  const visible=items.filter(x=>(!query||`${x.brand} ${x.name} ${x.gauge} ${x.colour??""} ${(x.characteristics??[]).join(" ")}`.toLowerCase().includes(query.toLowerCase()))&&(brandFilter==="all"||x.brand===brandFilter)&&(typeFilter==="all"||x.type===typeFilter)&&(formatFilter==="all"||x.purchaseFormat===formatFilter)).sort((a,b)=>{const av=sortBy==="customer"?effectivePrice(a):sortBy==="cost"?a.costPerRacket:sortBy==="markup"?(a.costPerRacket?((effectivePrice(a)-a.costPerRacket)/a.costPerRacket)*100:Number.POSITIVE_INFINITY):`${a.brand} ${a.name}`;const bv=sortBy==="customer"?effectivePrice(b):sortBy==="cost"?b.costPerRacket:sortBy==="markup"?(b.costPerRacket?((effectivePrice(b)-b.costPerRacket)/b.costPerRacket)*100:Number.POSITIVE_INFINITY):`${b.brand} ${b.name}`;const result=typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv));return sortDirection==="asc"?result:-result});
  const yonex=visible.filter(x=>x.brand.toLowerCase()==="yonex"),others=visible.filter(x=>x.brand.toLowerCase()!=="yonex");
  const characteristicColumns=["Comfort","Power","Spin","Control","Durability","Responsive"];
  const list=(sectionItems:StringPrice[],yonexSection=false)=><div className={yonexSection?"finance-list yonex-list":"finance-list"}>
    <div className={showCostDetails?"string-row string-labels details":"string-row string-labels"}><span>Manufacturer</span><span>String</span><span>Type</span><span>Gauge</span><span>Customer price</span><span>Stock</span>{showCostDetails?<><span>Cost per racket</span><span>Markup</span></>:null}<span></span></div>
    {sectionItems.map(x=><div className={`${showCostDetails?"string-row details":"string-row"}${x.inStock===false?" out-of-stock":""}`} key={x.id}>
      <strong>{x.brand}</strong>
      <span className="string-name"><strong>{x.name}</strong>{yonexSection?<span className="characteristic-grid" aria-label="Colour, hardness and string characteristics"><span className={x.colour?"active":""}>{x.colour??""}</span><span className={x.hardness?"active":""}>{x.hardness??""}</span>{characteristicColumns.map(label=><span key={label} className={(x.characteristics??[]).includes(label)?"active":""}>{(x.characteristics??[]).includes(label)?label:""}</span>)}</span>:null}</span>
      <span>{x.type}</span><span>{x.gauge}</span><strong>{effectivePrice(x)>0?gbp(effectivePrice(x)):"—"}</strong><strong>{x.inStock===false?"No":"Yes"}</strong>
      {showCostDetails?<><strong>{x.costPerRacket>0?gbp(x.costPerRacket):"—"}</strong><strong>{markup(x)}</strong></>:null}
      <button className="edit-button" onClick={()=>setD({...x,inStock:x.inStock!==false})}>Edit</button>
    </div>)}
  </div>;
  return (
    <section className="finance-page">
      <div className="finance-head">
        <div>
          <h2>String Prices</h2>
          <p>
            Cost per racket is used automatically to calculate order profit.
          </p>
        </div>
        <button className="primary" onClick={() => setD(blank())}>
          + Add string
        </button>
      </div>
      <div className="string-filters"><input className="search" placeholder="Search brand, string or gauge…" value={query} onChange={e=>setQuery(e.target.value)}/><label>Brand<select value={brandFilter} onChange={e=>setBrandFilter(e.target.value)}><option value="all">All brands</option>{brands.map(x=><option key={x}>{x}</option>)}</select></label><label>Type<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All types</option>{types.map(x=><option key={x}>{x}</option>)}</select></label><label>Purchased as<select value={formatFilter} onChange={e=>setFormatFilter(e.target.value)}><option value="all">All formats</option><option value="set">Set</option><option value="100m">100 m reel</option><option value="200m">200 m reel</option></select></label><label>Sort by<select value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}><option value="name">String name</option><option value="customer">Customer price</option><option value="cost">Cost per racket</option><option value="markup">Markup</option></select></label><button className="sort-arrow" title={sortDirection==="asc"?"Ascending":"Descending"} onClick={()=>setSortDirection(value=>value==="asc"?"desc":"asc")}>{sortDirection==="asc"?"↑":"↓"}</button></div>
      <div className="string-detail-toggle"><span>Show cost and markup</span><button type="button" role="switch" aria-checked={showCostDetails} className={showCostDetails?"toggle-switch on":"toggle-switch"} onClick={()=>setShowCostDetails(value=>!value)}><span /></button></div>
      {yonex.length?<div className="string-section"><div className="string-section-head"><div><h3>Yonex strings</h3><p>Range details from General rows 35–43. Reel prices checked at All Things Tennis.</p></div></div>{list(yonex,true)}</div>:null}
      {others.length?<div className="string-section"><div className="string-section-head"><h3>Other strings</h3></div>{list(others)}</div>:null}
      {!visible.length?<div className="empty-state finance-list">No strings match these filters.</div>:null}
      {d ? (
        <div className="modal-backdrop">
          <form
            className="edit-modal"
            onSubmit={(e) => {
              e.preventDefault();
              const cost=calculatedCost(d);
              onChange([...items.filter((x) => x.id !== d.id), {...d,costPerRacket:cost}]);
              setD(null);
            }}
          >
            <div className="edit-head">
              <h2>String cost</h2>
              <button type="button" onClick={() => setD(null)}>
                ×
              </button>
            </div>
            <div className="edit-grid">
              {(["brand", "name", "gauge", "type"] as const).map((k) => (
                <label key={k}>
                  {k[0].toUpperCase() + k.slice(1)}
                  <input
                    value={d[k]}
                    onChange={(e) => {const value=e.target.value;setD({ ...d, [k]: value,...(k==="brand"?{priceSource:retailerOptions(value)[0].value}:{}) })}}
                  />
                </label>
              ))}
              {d.brand.toLowerCase()==="yonex"?<><label>Colour<input value={d.colour??""} onChange={e=>setD({...d,colour:e.target.value})}/></label><label>Hardness<input value={d.hardness??""} onChange={e=>setD({...d,hardness:e.target.value})}/></label><label className="edit-wide">Characteristics<input value={(d.characteristics??[]).join(", ")} onChange={e=>setD({...d,characteristics:e.target.value.split(",").map(value=>value.trim()).filter(Boolean)})}/></label></>:null}
              <label>In stock<select value={d.inStock?"yes":"no"} onChange={e=>setD({...d,inStock:e.target.value==="yes"})}><option value="yes">Yes</option><option value="no">No</option></select></label>
              <label>How I bought it<select value={d.purchaseFormat ?? "set"} onChange={e=>setD({...d,purchaseFormat:e.target.value as "set"|"100m"|"200m"})}><option value="set">Set (12 m)</option><option value="100m">100 m reel</option><option value="200m">200 m reel</option></select></label>
              {d.purchaseFormat==="100m"?<label>Price paid for 100 m reel<input autoFocus type="number" step=".01" value={d.reel100Cost ?? 0} onChange={e=>setD({...d,reel100Cost:Number(e.target.value)})}/></label>:d.purchaseFormat==="200m"?<label>Price paid for 200 m reel<input autoFocus type="number" step=".01" value={d.reel200Cost ?? 0} onChange={e=>setD({...d,reel200Cost:Number(e.target.value)})}/></label>:<label>Price paid for set<input autoFocus type="number" step=".01" value={d.setCost ?? 0} onChange={e=>setD({...d,setCost:Number(e.target.value)})}/></label>}
              <label>Customer price source<select value={d.priceSource??sources[0]?.value??"manual"} onChange={e=>setD({...d,priceSource:e.target.value})}>{sources.map(source=><option key={source.value} value={source.value}>{source.label}</option>)}</select></label>
              <label>Online set price<input type="number" step=".01" value={d.priceToCustomer ?? d.setCost ?? 0} onChange={e=>setD({...d,priceToCustomer:Number(e.target.value)})}/></label>
              <label>Customer price override (optional)<input type="number" step=".01" placeholder="Use online price" value={d.customerPriceOverride ?? ""} onChange={e=>setD({...d,customerPriceOverride:e.target.value===""?null:Number(e.target.value)})}/></label>
              {selectedSource?.value!=="manual"?<div className="price-lookup"><div><strong>{selectedSource?.label} set price</strong><span>Search the selected retailer for this exact string and gauge.</span></div><button type="button" className="secondary" onClick={()=>window.open(`https://www.google.com/search?q=${encodeURIComponent(`${selectedSource?.domain?`site:${selectedSource.domain} `:""}${d.brand} ${d.name} ${d.gauge} tennis string 12m set UK`)}`,"_blank","noopener,noreferrer")}>Look up set price</button></div>:<div className="price-lookup"><div><strong>Manual customer price</strong><span>Enter the set price yourself for this string.</span></div></div>}
              <div className="cost-preview"><span>Customer price</span><strong>{gbp(d.customerPriceOverride ?? d.priceToCustomer ?? d.setCost ?? 0)}</strong></div>
              <div className="cost-preview"><span>Cost per racket</span><strong>{gbp(calculatedCost(d))}</strong></div>
              <div className="cost-preview"><span>Markup</span><strong>{calculatedCost(d)===0?"—":`${(((effectivePrice(d)-calculatedCost(d))/calculatedCost(d))*100).toFixed(1)}%`}</strong></div>
            </div>
            <div className="modal-actions">
              <button className="primary">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
