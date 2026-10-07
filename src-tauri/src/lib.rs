//! iConcrete System — desktop shell.
//!
//! The shell adds nothing but the offline database: the interface, the domain
//! rules and the sync engine all live in the shared web bundle (`../src`), so the
//! Windows build and the Vercel deployment always behave the same way.
//!
//! The offline schema is defined once, in TypeScript, at
//! `src/lib/offline/schema.ts`. It runs `CREATE TABLE IF NOT EXISTS` as soon as
//! the app opens the database, so there is no second copy of the DDL to drift.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running iConcrete System");
}
