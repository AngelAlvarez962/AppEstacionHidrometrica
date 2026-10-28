// Sessions stay per tab unless the user explicitly chooses Remember me.
// Passwords are never stored. PKCE verifiers can cross tabs for email links.
export function authStorage(tabStorage,sharedStorage) {
  const slot=key=>key.endsWith('-code-verifier')?'hi-kits-pkce-v1':key.endsWith('-user')?'hi-kits-user-v1':'hi-kits-session-v1';
  const saved=key=>'remember-'+slot(key),pkce=key=>key.endsWith('-code-verifier');
  let remember=sharedStorage.getItem('hi-kits-remember-v1')==='true';
  return {
   get remembered(){return remember},
   setRemember(value){remember=!!value;if(remember)sharedStorage.setItem('hi-kits-remember-v1','true');else{sharedStorage.removeItem('hi-kits-remember-v1');sharedStorage.removeItem('remember-hi-kits-session-v1');sharedStorage.removeItem('remember-hi-kits-user-v1')}},
   getItem(key){return pkce(key)?sharedStorage.getItem(slot(key)):tabStorage.getItem(slot(key))??(remember?sharedStorage.getItem(saved(key)):null)},
   setItem(key,value){if(pkce(key)){sharedStorage.setItem(slot(key),value);return}tabStorage.setItem(slot(key),value);if(remember)sharedStorage.setItem(saved(key),value)},
   removeItem(key){if(pkce(key)){sharedStorage.removeItem(slot(key));return}tabStorage.removeItem(slot(key));sharedStorage.removeItem(saved(key))}
  };
}
