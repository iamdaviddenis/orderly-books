import { appStateSchema, type AppState } from '../domain/schema'
import { supabase } from './supabaseClient'

export type RemoteUserState = {
  state: AppState
  clientUpdatedAt: string
  serverUpdatedAt: string
}

type RemoteRow = {
  user_id: string
  state: unknown
  client_updated_at: string
  server_updated_at: string
}

export async function fetchRemoteUserState(userId: string): Promise<RemoteUserState | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_states')
    .select('user_id, state, client_updated_at, server_updated_at')
    .eq('user_id', userId)
    .maybeSingle<RemoteRow>()

  if (error) throw new Error(error.message)
  if (!data) return null

  const parsed = appStateSchema.safeParse(data.state)
  if (!parsed.success) return null

  return {
    state: parsed.data,
    clientUpdatedAt: data.client_updated_at,
    serverUpdatedAt: data.server_updated_at,
  }
}

export async function upsertRemoteUserState(userId: string, state: AppState) {
  if (!supabase) return
  const payload = {
    user_id: userId,
    state,
    client_updated_at: state.updatedAt,
  }
  const { error } = await supabase.from('user_states').upsert(payload, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}

export async function deleteRemoteUserState(userId: string) {
  if (!supabase) return
  const { error } = await supabase.from('user_states').delete().eq('user_id', userId)
  if (error) throw new Error(error.message)
}

