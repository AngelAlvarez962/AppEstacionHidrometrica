// Tokens stay in the current tab. Only the short-lived PKCE verifier is shared
// so a confirmation/recovery email can open in another tab of the same browser.
export function authStorage(tabStorage,sharedStorage) {
  const slot=key=>key.endsWith('-code-verifier')?'hi-kits-pkce-v1':key.endsWith('-user')?'hi-kits-user-v1':'hi-kits-session-v1';
  const store=key=>key.endsWith('-code-verifier')?sharedStorage:tabStorage;
  return {getItem:key=>store(key).getItem(slot(key)),setItem:(key,value)=>store(key).setItem(slot(key),value),removeItem:key=>store(key).removeItem(slot(key))};
}
