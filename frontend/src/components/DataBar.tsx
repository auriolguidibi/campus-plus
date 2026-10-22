import { useState } from 'react'
import { useDataMode } from '../dataMode'
import Icon from './Icon'

/** "Mode payant ? [Changer de mode]" bar (like Facebook Lite). Free mode saves mobile data: photos load only when tapped. */
export default function DataBar() {
  const { free, setFree } = useDataMode()
  const [help, setHelp] = useState(false)
  return (
    <div className="bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-lg font-bold">
          {free ? 'Mode gratuit' : 'Mode payant'}
          <button onClick={() => setHelp(!help)} aria-expanded={help} aria-label="Qu'est-ce que c'est ?" className="text-fg"><Icon name="help" bold size={22} /></button>
        </p>
        <button onClick={() => setFree(!free)} className="rounded-xl bg-soft px-4 py-2.5 text-[15px] font-bold">Changer de mode</button>
      </div>
      {help && (
        <p className="mt-3 rounded-xl bg-soft p-3 text-sm text-muted" role="note">
          {free
            ? "Mode gratuit : les photos ne se téléchargent pas automatiquement (touche une photo pour l'afficher). Les messages, publications et notifications restent disponibles et consomment très peu de données."
            : 'Mode payant : toutes les photos, stories et images se chargent automatiquement. Passe en mode gratuit pour économiser tes données mobiles.'}
        </p>
      )}
    </div>
  )
}
