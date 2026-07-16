/**
 * Reusable Supabase mock — a Proxy that returns itself for any method call,
 * so any `.from().select().eq().eq().limit()...` chain works. Awaiting the
 * chain resolves to `{ data: [], error: null, count: 0 }`.
 */
export function makeSupabaseMock() {
  const result = { data: [], error: null, count: 0 };
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make the chain awaitable.
        return (resolve: (v: any) => any) => resolve(result);
      }
      if (prop === Symbol.toPrimitive) return undefined;
      return chainable;
    },
    apply() {
      return chainable;
    },
  };
  const chainable: any = new Proxy(function () {}, handler);

  return {
    from: () => chainable,
    rpc: () => chainable,
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    removeChannel: () => {},
    storage: { from: () => chainable },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  };
}
