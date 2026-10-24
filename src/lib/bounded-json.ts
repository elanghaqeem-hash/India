export class RequestBodyError extends Error {constructor(message:string,public status:number){super(message);}}
/** Limit bytes while streaming, including chunked requests without Content-Length. */
export async function readBoundedJSON(req:Request,maxBytes:number):Promise<Record<string,unknown>>{
 const length=Number(req.headers.get('content-length'));
 if(Number.isFinite(length)&&length>maxBytes)throw new RequestBodyError('Payload terlalu besar',413);
 if(!req.body)throw new RequestBodyError('JSON wajib',400);
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){void reader.cancel().catch(()=>{});throw new RequestBodyError('Payload terlalu besar',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 try{const x=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!x||typeof x!=='object'||Array.isArray(x))throw Error();return x;}catch{throw new RequestBodyError('JSON harus object UTF-8 yang valid',400);}
}
