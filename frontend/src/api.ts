const TOKEN_KEY = 'campus-token'

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* storage blocked */ }
}

export class ApiError extends Error {
  constructor(public status: number, public data: any) {
    super(typeof data?.detail === 'string' ? data.detail : 'Erreur')
  }
  /** Flattens DRF field errors into one readable string. */
  get text() {
    const d = this.data
    if (!d || typeof d !== 'object') return this.message
    return Object.entries(d)
      .map(([k, v]) => (k === 'detail' || k === 'non_field_errors' ? '' : `${k} : `) + [v].flat().join(' '))
      .join('\n')
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown | FormData } = {}): Promise<T> {
  const token = getToken()
  const res = await fetch('/api' + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      ...(opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: !opts.body ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export interface User {
  id: number; username: string; first_name: string; last_name: string; email: string; school: string
  field_of_study: string; promotion: string; bio: string; theme: 'light' | 'dark' | 'auto'
  verification: 'pending' | 'verified' | 'rejected'
}
export interface PublicUser { id: number; username: string; first_name: string; last_name: string; field_of_study: string; promotion: string }
export interface Post {
  id: number; author: PublicUser; text: string; created_at: string; reaction_count: number
  comment_count: number; reacted: boolean; favorited: boolean
  community: number | null; community_name: string | null; media: string[]
}
export type Relation = 'self' | 'none' | 'friends' | 'request_sent' | 'request_received'
export interface Profile extends PublicUser {
  school: string; bio: string; relation: Relation; friends_count: number; posts_count: number
}
export type Role = 'creator' | 'admin' | 'moderator' | 'member'
export interface Community {
  id: number; name: string; description: string; rules: string; category: string
  member_count: number; my_role: Role | null
}
export interface Member extends PublicUser { role: Role }
export interface Comment { id: number; author: PublicUser; parent: number | null; text: string; created_at: string }
export interface Page<T> { count: number; next: string | null; results: T[] }

export interface Category { id: number; name: string }
export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'declined' | 'withdrawn'
export interface Offer {
  id: number; listing: number; listing_title: string; listing_price: number; buyer: PublicUser
  conversation: number | null; amount: number; counter_amount: number | null; status: OfferStatus; created_at: string
}
export interface Seller extends PublicUser { rating: { avg: number | null; count: number }; sales: number }
export type ListingStatus = 'draft' | 'pending' | 'published' | 'reserved' | 'sold' | 'rejected' | 'archived'
export interface Listing {
  id: number; seller: Seller; category: Category; title: string; description: string; price: number
  condition: 'new' | 'used'; quantity: number; location: string; handover: string[]; negotiable: boolean
  status: ListingStatus; images: { id: number; url: string }[]; favorited: boolean; my_offer: Offer | null; bought_by_me: boolean; created_at: string
}
export interface ChatMessage { id: number; sender: number | null; text: string; is_system: boolean; created_at: string }
export interface ConversationSummary {
  id: number; other: PublicUser; listing: { id: number; title: string } | null
  last_message: ChatMessage | null; unread: number; updated_at: string
}
export const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
