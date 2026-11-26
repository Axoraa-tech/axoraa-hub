"use client";

import React, { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const ROOT_ID = "print-root";

function ensurePrintRoot(): HTMLElement {
  let el = document.getElementById(ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = ROOT_ID;
    document.body.appendChild(el);
  }
  return el;
}

const noopSubscribe = () => () => {};

/**
 * Shows the document on screen and keeps a copy in #print-root (a direct child of <body>). When
 * printNow() runs, print CSS hides everything except #print-root, so only the document prints.
 */
export function PrintArea({ children }: { children: React.ReactNode }) {
  const root = useSyncExternalStore(noopSubscribe, ensurePrintRoot, () => null);
  return (
    <>
      <div className="print-preview">{children}</div>
      {root && createPortal(<div className="paper">{children}</div>, root)}
    </>
  );
}

/** Prints only the PrintArea document. Clears the print mode once the dialog closes. */
export function printNow(): void {
  const html = document.documentElement;
  html.dataset.printing = "doc";
  const clear = () => {
    delete html.dataset.printing;
    window.removeEventListener("afterprint", clear);
  };
  window.addEventListener("afterprint", clear);
  window.print();
}
