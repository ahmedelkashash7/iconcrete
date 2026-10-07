export const api:any = new Proxy({}, {get:()=>new Proxy({}, {get:()=>undefined})});
export const internal:any = api;
