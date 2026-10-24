/** Bounded RFC 5322 import. HTML is never rendered or fetched. Attachments remain in the source mailbox. */
const addresses=(s:string)=>Array.from(new Set((s.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(x=>x.toLowerCase())));
const decode=(s:string,encoding:string)=>{
 if(/base64/i.test(encoding)){try{return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),x=>x.charCodeAt(0)));}catch{throw Error('Base64 email tidak valid');}}
 if(/quoted-printable/i.test(encoding))return new TextDecoder().decode(Uint8Array.from(s.replace(/=\r?\n/g,'').replace(/=([a-f0-9]{2})/gi,(_,x)=>String.fromCharCode(parseInt(x,16))),x=>x.charCodeAt(0)));
 return s;
};
const headerText=(s:string)=>s.replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi,(_,kind,value)=>decode(kind.toLowerCase()==='q'?value.replace(/_/g,' '):value,kind.toLowerCase()==='b'?'base64':'quoted-printable'));
function parts(raw:string){
 const split=/\r?\n\r?\n/.exec(raw);if(!split||split.index>40000)throw Error('Header EML tidak valid atau terlalu besar');
 const h:Record<string,string>={};
 for(const line of raw.slice(0,split.index).replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/)){
  const i=line.indexOf(':');if(i<1)throw Error('Header EML tidak valid');const k=line.slice(0,i).toLowerCase();
  if(h[k]&&['message-id','from','date','subject'].includes(k))throw Error('Header EML ambigu');
  h[k]=(h[k]?h[k]+', ':'')+line.slice(i+1).trim();
 }
 return {h,body:raw.slice(split.index+split[0].length)};
}
export function parseOpportunityEmail(raw:string){
 if(new TextEncoder().encode(raw).length>1024*1024)throw Error('EML maksimum 1 MB');
 const {h,body}=parts(raw),sender=addresses(h.from||''),recipients=addresses((h.to||'')+','+(h.cc||''));
 const messageId=h['message-id']||'',subject=headerText(h.subject||'').trim(),sent=new Date(h.date||'');
 if(sender.length!==1||!recipients.length||recipients.length>50||!/^<[^\s<>]{3,240}>$/.test(messageId)||!subject||subject.length>400||!Number.isFinite(sent.getTime())||sent.getTime()>Date.now()+300000)throw Error('From, To, Message-ID, Subject dan Date EML wajib valid');
 let excerpt='';const ct=h['content-type']||'text/plain';
 if(/^text\/plain\b/i.test(ct))excerpt=decode(body,h['content-transfer-encoding']||'');
 else if(/^multipart\//i.test(ct)){
  const boundary=/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(ct);const b=boundary?.[1]||boundary?.[2];
  if(b&&b.length<=200)for(const part of body.split('--'+b).slice(1,31)){
   try{const p=parts(part.replace(/^\r?\n/,''));if(/^text\/plain\b/i.test(p.h['content-type']||'')&&!/attachment/i.test(p.h['content-disposition']||'')){excerpt=decode(p.body,p.h['content-transfer-encoding']||'');break;}}catch{/* unsupported MIME part: import header only */}
  }
 }
 return {message_id:messageId,in_reply_to:(h['in-reply-to']||'').slice(0,250),subject,sender_email:sender[0],recipient_emails:recipients,sent_at:sent.toISOString(),excerpt:excerpt.replace(/\u0000/g,'').trim().slice(0,20000)};
}
