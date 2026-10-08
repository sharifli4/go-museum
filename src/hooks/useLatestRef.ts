"use client";

import { useEffect, useRef } from "react";

/** Keeps a ref pointing at the latest value, for stable-identity event listeners. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
