import { useState } from 'react'
import { api } from '../api.js'
import { useMutation } from '../useMutation.js'

export default function ServiceForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', owner: '', tier: '2' })
  const [error, setError] = useState(null)
  const { pending, run } = useMutation(setError)
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  function submit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.owner.trim()) return
    run(async () => {
      setError(null)
      const service = await api.createService({ name: form.name.trim(), owner: form.owner.trim(), tier: Number(form.tier) })
      onCreated(service)
    })
  }
  return (
    <section className="card report" aria-labelledby="service-title">
      <h2 id="service-title">Adaugă un serviciu</h2>
      <form className="report-form" onSubmit={submit}>
        <label className="field">Nume serviciu<input name="name" value={form.name} onChange={change} maxLength={100} required disabled={pending} /></label>
        <label className="field">Echipă responsabilă<input name="owner" value={form.owner} onChange={change} maxLength={100} required disabled={pending} /></label>
        <label className="field">Nivel<select name="tier" value={form.tier} onChange={change} disabled={pending}><option value="1">1 – critic</option><option value="2">2 – important</option><option value="3">3 – standard</option></select></label>
        <div className="actions">
          <button type="submit" className="button" disabled={pending || !form.name.trim() || !form.owner.trim()}>Salvează serviciul</button>
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={pending}>Anulează</button>
        </div>
      </form>
      {error && <div className="notice notice-error" role="alert"><p>{error}</p></div>}
    </section>
  )
}
