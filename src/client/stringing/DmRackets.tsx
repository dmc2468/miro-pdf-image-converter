import { useState } from "react";
import { dmSavings, nextDmJobNumber, sortedDmJobs, type DmRacketJob } from "../../shared/dm-rackets";
import "./dm-rackets.css";

export function DmRackets({ jobs, onChange }: { jobs: DmRacketJob[]; onChange: (jobs: DmRacketJob[]) => void }) {
  const [draft, setDraft] = useState<DmRacketJob | null>(null);
  const money = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
  function add() {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    setDraft({ id: crypto.randomUUID(), jobNumber: nextDmJobNumber(jobs), date: today.toISOString().slice(0, 10), racket: "", mains: "", crosses: "", tension: "", notes: "" });
  }
  return <section className="dm-rackets">
    <div className="dm-summary">
      <article className="summary-card"><span>Money saved</span><strong>{money(dmSavings(jobs))}</strong><small>{jobs.length} racket{jobs.length === 1 ? "" : "s"} restrung × £25 saving per racket</small></article>
      <button className="primary" type="button" onClick={add}>+ Add DM job</button>
    </div>
    {jobs.length ? <div className="dm-table-wrap"><table><thead><tr><th>Job #</th><th>Date</th><th>Racket</th><th>Mains</th><th>Crosses</th><th>Tension</th><th>Notes</th><th></th></tr></thead><tbody>{sortedDmJobs(jobs).map(job => <tr key={job.id}><td>{job.jobNumber}</td><td>{new Date(`${job.date}T12:00:00`).toLocaleDateString("en-GB")}</td><td>{job.racket || "—"}</td><td>{job.mains || "—"}</td><td>{job.crosses || "—"}</td><td>{job.tension || "—"}</td><td className="dm-notes">{job.notes || "—"}</td><td><button type="button" className="edit-button" onClick={() => setDraft({ ...job })}>Edit</button></td></tr>)}</tbody></table></div> : <div className="empty-state">No DM rackets recorded yet. Add a restringing job to start tracking your savings.</div>}
    {draft ? <div className="modal-backdrop" onClick={() => setDraft(null)}><form className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="dm-job-title" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") setDraft(null); }} onSubmit={event => {
      event.preventDefault();
      onChange(jobs.some(job => job.id === draft.id) ? jobs.map(job => job.id === draft.id ? draft : job) : [...jobs, draft]);
      setDraft(null);
    }}><div className="edit-head"><div><h2 id="dm-job-title">DM job #{draft.jobNumber}</h2><small>Record a completed restringing job.</small></div><button type="button" aria-label="Close" onClick={() => setDraft(null)}>×</button></div><div className="edit-grid">
      <label>Date<input autoFocus required type="date" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
      <label>Racket<input value={draft.racket} onChange={event => setDraft({ ...draft, racket: event.target.value })} /></label>
      <label>Mains string type<input required value={draft.mains} onChange={event => setDraft({ ...draft, mains: event.target.value })} /></label>
      <label>Crosses string type<input required value={draft.crosses} onChange={event => setDraft({ ...draft, crosses: event.target.value })} /></label>
      <label>Tension<input placeholder="e.g. 52 / 50 lbs" value={draft.tension} onChange={event => setDraft({ ...draft, tension: event.target.value })} /></label>
      <label className="wide">Notes<textarea value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
    </div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setDraft(null)}>Cancel</button><button className="primary">Save job</button></div></form></div> : null}
  </section>;
}
