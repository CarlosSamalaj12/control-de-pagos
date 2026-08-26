/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '@sqlite.org/sqlite-wasm' {
  type SqlValue = string | number | bigint | Buffer | Uint8Array | null;
  type BindingSpec = readonly SqlValue[] | Record<string, SqlValue>;

  export interface Sqlite3Module {
    oo1: {
      DB: any;
      OpfsDb: any;
    };
    selectValue: (sql: string, bind?: BindingSpec) => SqlValue;
    selectArray: (sql: string, bind?: BindingSpec) => SqlValue[] | undefined;
    selectArrays: (sql: string, bind?: BindingSpec) => SqlValue[][];
    exec: (options: {
      sql: string;
      bind?: BindingSpec;
      rowMode?: 'object' | 'array' | 'stmt' | 'scalar';
      returnValue?: 'resultRows' | 'this' | 'saveSql';
    }) => any;
  }
  const sqlite3InitModule: (options?: { print?: (...args: any[]) => void; printErr?: (...args: any[]) => void }) => Promise<Sqlite3Module>;
  export default sqlite3InitModule;
}
