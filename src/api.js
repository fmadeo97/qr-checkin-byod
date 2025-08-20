import { supabase } from './supabaseClient';

export async function listSites(orgId) {
  const { data, error } = await supabase
    .from('sites').select('*')
    .eq('org_id', orgId).eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listUsers(orgId) {
  const { data, error } = await supabase
    .from('users').select('*')
    .eq('org_id', orgId).eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getLastEvent(orgId, userId, siteId) {
  const { data, error } = await supabase
    .from('events').select('*')
    .eq('org_id', orgId).eq('user_id', userId).eq('site_id', siteId)
    .order('ts', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function insertEvent(evt) {
  const { data, error } = await supabase
    .from('events').insert(evt).select().single();
  if (error) throw error;
  return data;
}

export async function uploadSelfie(file, orgId, userId) {
  const bucket = import.meta.env.VITE_SELFIE_BUCKET || 'selfies';
  const path = `${orgId}/${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket).upload(path, file, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
