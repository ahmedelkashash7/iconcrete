export const query = (a:any) => a
export const mutation = (a:any) => a
export const action = (a:any) => a
export const internalQuery = query
export const internalMutation = mutation
export const internalAction = action
export const httpAction = (f:any) => f
export const httpRouter = () => ({ route: ()=>{}, getRoutes: ()=>[] })

export type QueryCtx = any
export type MutationCtx = any
export type ActionCtx = any
export type DatabaseReader = any
export type DatabaseWriter = any
export type GenericQueryCtx = any
export type GenericMutationCtx = any
export type GenericActionCtx = any
export type Doc = any
export type Id<T extends string = string> = string
