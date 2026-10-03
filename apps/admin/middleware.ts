import{NextResponse}from"next/server";

export function middleware(req:Request){
  const bytes=new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce=btoa(String.fromCharCode(...bytes));
  const csp="default-src 'self'; script-src 'self' 'nonce-"+nonce+"' 'strict-dynamic'; style-src 'self' 'nonce-"+nonce+"'; img-src 'self' data:; connect-src 'self' wss://admin.lingostore.example; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none';"+(process.env.NODE_ENV==="production"?" upgrade-insecure-requests":"");
  const requestHeaders=new Headers(req.headers);
  requestHeaders.set("x-nonce",nonce);
  requestHeaders.set("x-original-uri",new URL(req.url).pathname);
  const res=NextResponse.next({request:{headers:requestHeaders}});
  res.headers.set("Content-Security-Policy",csp);
  return res;
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
