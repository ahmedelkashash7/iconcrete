mkdir -p src/convex/_generated
mkdir -p convex/_generated
cat > src/convex/_generated/api.ts << 'EOF'
export const api:any = new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})});
export const internal:any = new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})});
export default api;
EOF
cat > convex/_generated/api.ts << 'EOF'
export const api:any = new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})});
export const internal:any = new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})});
export default api;
EOF
cat > src/convex/_generated/api.js << 'EOF'
export const api = new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})});
export const internal = new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{}})});
export default api;
EOF
cat > src/convex/_generated/dataModel.ts << 'EOF'
export type Id<T extends string = string> = string;
export type Doc<T extends string = string> = any;
export type DataModel = any;
EOF
cat > src/convex/_generated/server.ts << 'EOF'
export const query = (a:any) => a;
export const mutation = (a:any) => a;
export const action = (a:any) => a;
export const internalQuery = (a:any) => a;
export const internalMutation = (a:any) => a;
export const internalAction = (a:any) => a;
export type QueryCtx = any;
export type MutationCtx = any;
export type ActionCtx = any;
export type DatabaseReader = any;
export type DatabaseWriter = any;
EOF
bunx vite build
