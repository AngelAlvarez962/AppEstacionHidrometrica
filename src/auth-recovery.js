// Recovery must survive INITIAL_SESSION, SIGNED_IN and TOKEN_REFRESHED after
// PASSWORD_RECOVERY. Only a completed password change or sign-out ends it.
export class RecoveryFlow {
  constructor(search='') { this.pending=new URLSearchParams(search).has('recovery'); }
  event(event,session) {
    if(event==='SIGNED_OUT'){this.pending=false;return 'login';}
    if(event==='PASSWORD_RECOVERY')this.pending=true;
    if(!session)return this.pending?'retry':'login';
    return this.pending?'password':'app';
  }
  complete() { this.pending=false; }
}
