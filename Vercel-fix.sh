mkdir -p src/convex/_generated
# رجع اي import باظ
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|mockConvex|convex/react|g' {} \; 2>/dev/null || true

cat > src/convex/_generated/api.ts << 'EOF'
export const api:any = new Proxy({}, {get:()=>new Proxy({}, {get:()=>({})})});
export const internal:any = new Proxy({}, {get:()=>new Proxy({}, {get:()=>({})})});
export default api;
EOF
cat > src/convex/_generated/dataModel.ts << 'EOF'
export type Id<T extends string = string> = string;
export type Doc<T extends string = string> = any;
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
EOF
cat > src/mockConvex.ts << 'EOF'
export const useQuery = () => undefined;
export const useMutation = () => () => Promise.resolve(null);
export const useAction = () => () => Promise.resolve(null);
export const useConvex = () => ({});
EOF
rm -rf node_modules/.vite
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'convex/react': path.resolve(__dirname, './src/mockConvex.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
EOF
bunx vite build
