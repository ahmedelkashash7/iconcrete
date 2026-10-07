export const api:any = new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})});
export const internal:any = api;
