function fakeRef(path: string) {
  const ref: any = {};
  // اهم سطرين - Convex بيدور على الـ Symbol ده
  ref[Symbol.for("functionName")] = path;
  ref[Symbol("functionName")] = path;
  ref["functionName"] = path;
  ref.toString = () => path;
  return new Proxy(ref, {
    get(t, p) {
      if (typeof p === "symbol") return t[p]?? path;
      return t[p]?? path;
    }
  });
}

export const api: any = new Proxy({}, {
  get(_, mod) {
    return new Proxy({}, {
      get(_, fn) {
        return fakeRef(`${String(mod)}:${String(fn)}`);
      }
    });
  }
});

export const internal: any = api;
