import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type Category, type Listing } from '../api'
import Icon from '../components/Icon'
import { Check, Field, SelectField, Submit, TextArea } from '../components/form'
import { ErrorBox, Spinner } from '../components/ui'

const MAX = 6
const HANDOVER: [string, string][] = [['meetup', 'Remise en main propre'], ['campus', 'Sur le campus'], ['delivery', 'Livraison possible']]

export default function ListingForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [cats, setCats] = useState<Category[]>([])
  const [existing, setExisting] = useState<Listing | null>(null)
  const [loaded, setLoaded] = useState(!id)
  const [files, setFiles] = useState<File[]>([])
  const [removed, setRemoved] = useState<number[]>([])
  const [handover, setHandover] = useState<string[]>(['meetup'])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews])

  useEffect(() => {
    api<Category[]>('/market/categories/').then(setCats)
    if (id) api<Listing>(`/listings/${id}/`).then((l) => { setExisting(l); setHandover(l.handover); setLoaded(true) }).catch(() => setErr('Annonce introuvable.'))
  }, [id])

  if (!loaded) return <div className="py-10"><Spinner /></div>
  const kept = (existing?.images ?? []).filter((i) => !removed.includes(i.id))

  function pick(list: FileList | null) {
    const room = MAX - kept.length
    const next = [...files, ...Array.from(list ?? [])]
    setErr(next.length > room ? `${MAX} photos maximum.` : '')
    setFiles(next.slice(0, room))
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const draft = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-draft') === '1'
    const fd = new FormData(e.currentTarget)
    handover.forEach((h) => fd.append('handover', h))
    files.forEach((f) => fd.append('images', f))
    removed.forEach((r) => fd.append('remove_images', String(r)))
    fd.set('negotiable', fd.get('negotiable') ? 'true' : 'false')
    if (draft) fd.set('draft', 'true')
    setBusy(true); setErr('')
    try {
      const l = await api<Listing>(id ? `/listings/${id}/` : '/listings/', { method: id ? 'PATCH' : 'POST', body: fd })
      nav(`/marketplace/${l.id}`, { replace: true })
    } catch (x) { setErr(x instanceof ApiError ? x.text : 'Serveur injoignable.') } finally { setBusy(false) }
  }

  const v = existing
  return (
    <form onSubmit={submit} className="space-y-3 pt-6">
      <h1 className="text-2xl font-bold">{id ? "Modifier l'annonce" : 'Vendre un article'}</h1>
      <Field name="title" label="Nom du produit" icon="tag" maxLength={120} defaultValue={v?.title} placeholder="Ex. Nike Air Force 1" required />
      <TextArea name="description" label="Description" icon="notebook" maxLength={3000} defaultValue={v?.description} placeholder="État, accessoires, raison de la vente…" required />
      <SelectField name="category" label="Catégorie" icon="bag" defaultValue={v?.category.id ?? ''} required>
        <option value="" disabled>Choisir une catégorie</option>
        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <Field name="price" label="Prix (FCFA)" icon="dollar" inputMode="numeric" pattern="[0-9]*" defaultValue={v?.price} placeholder="25000" required />
        <Field name="quantity" label="Quantité" type="number" min={1} max={999} defaultValue={v?.quantity ?? 1} required />
      </div>
      <SelectField name="condition" label="État" icon="verified" defaultValue={v?.condition ?? 'used'}>
        <option value="used">Occasion</option><option value="new">Neuf</option>
      </SelectField>
      <Field name="location" label="Lieu de rencontre / zone" icon="pin" maxLength={120} defaultValue={v?.location} placeholder="Campus EIG, bloc A" />
      <fieldset className="card space-y-3 p-4">
        <legend className="px-1 text-xs font-semibold text-muted">Modes de remise</legend>
        {HANDOVER.map(([k, label]) => (
          <Check key={k} checked={handover.includes(k)} onChange={(e) => setHandover(e.target.checked ? [...handover, k] : handover.filter((h) => h !== k))}>{label}</Check>
        ))}
        <div className="border-t border-line pt-3"><Check name="negotiable" defaultChecked={v?.negotiable}>Prix négociable (accepter les offres)</Check></div>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        {kept.map((i) => (
          <div key={i.id} className="relative"><img src={i.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <button type="button" aria-label="Retirer la photo" onClick={() => setRemoved([...removed, i.id])} className="absolute right-1 top-1 h-6 w-6 rounded-full bg-fg/70 text-xs text-bg"><Icon name="close" bold size={16} /></button></div>
        ))}
        {previews.map((u, i) => (
          <div key={u} className="relative"><img src={u} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <button type="button" aria-label="Retirer la photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 h-6 w-6 rounded-full bg-fg/70 text-xs text-bg"><Icon name="close" bold size={16} /></button></div>
        ))}
      </div>
      <label className="btn-outline flex cursor-pointer items-center justify-center gap-2"><Icon name="gallery" size={20} /> Ajouter des photos ({kept.length + files.length}/{MAX})
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      </label>
      <ErrorBox>{err}</ErrorBox>
      <Submit busy={busy} icon="send">{id ? 'Enregistrer' : 'Publier'}</Submit>
      {!id && <button data-draft="1" className="w-full py-2 text-sm text-muted" disabled={busy}>Enregistrer comme brouillon</button>}
    </form>
  )
}
