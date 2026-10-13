const {URL}=require('node:url');

function cloudUrl(value){
  if(value===null||value===undefined||value==='')return null;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.')||/^(localhost|127\.|0\.|\[)/i.test(url.hostname))throw Error('La dirección pública debe ser HTTPS y apuntar al inicio de la aplicación.');
  return url.origin+'/';
}

function sameOrigin(value,trusted){
  try{return new URL(value).origin===new URL(trusted).origin;}catch{return false;}
}

module.exports={cloudUrl,sameOrigin};
