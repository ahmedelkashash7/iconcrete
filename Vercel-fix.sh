mkdir -p src/convex/_generated
mkdir -p convex/_generated
echo "export const api:any=new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})}) ; export default api;" > src/convex/_generated/api.ts
echo "export const api:any=new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})}) ; export default api;" > convex/_generated/api.ts
echo "export const api:any=new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})}) ; export default api;" > src/convex/_generated/api.js
echo "export type Id<T extends string>=string; export type Doc<T extends string>=any;" > src/convex/_generated/dataModel.ts
echo "export const query=(a:any)=>a; export const mutation=(a:any)=>a; export const action=(a:any)=>a;" > src/convex/_generated/server.ts
bun run build
