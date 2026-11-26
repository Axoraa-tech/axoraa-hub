"use client";

import React from "react";
import { Keyboard } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/primitives";
import type { ViewDef } from "@/lib/views";

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {keys.map((k, i) =>
        k === "then" ? (
          <span key={i} className="px-0.5 text-[12px] text-ink-3">
            then
          </span>
        ) : (
          <Kbd key={i}>{k}</Kbd>
        )
      )}
    </span>
  );
}

/** The '?' list: global keys first, then one 'g' chord per view the viewer can open. */
export function ShortcutsDialog({
  open,
  onClose,
  views,
  primaryLabel,
  mac,
}: {
  open: boolean;
  onClose: () => void;
  views: readonly ViewDef[];
  /** The current page's primary action, e.g. 'Log work'. */
  primaryLabel?: string | null;
  mac: boolean;
}) {
  const mod = mac ? "⌘" : "Ctrl";
  const general: { keys: string[]; label: string }[] = [
    { keys: [mod, "K"], label: "Open the command bar" },
    { keys: ["/"], label: "Search this page, or open the command bar" },
    { keys: ["N"], label: primaryLabel ? `${primaryLabel} (this page's main action)` : "This page's main action, where there is one" },
    { keys: ["?"], label: "Show this list" },
    { keys: ["Esc"], label: "Close a dialog, sheet or menu" },
  ];
  const chords = views.filter((v) => v.chord);

  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" description="They work anywhere except while you are typing." icon={<Keyboard />} size="md">
      <div className="space-y-5">
        <table className="w-full border-collapse text-[13.5px]">
          <caption className="sr-only">General shortcuts</caption>
          <tbody className="divide-hair">
            {general.map((row) => (
              <tr key={row.label} className="[&>td]:py-2.5">
                <td className="pr-4 text-ink">{row.label}</td>
                <td className="text-right">
                  <Keys keys={row.keys} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {chords.length > 0 && (
          <div className="card-inset p-4">
            <div className="mb-2 text-[12px] text-ink-3">Go to a page</div>
            <table className="w-full text-[13.5px]">
              <caption className="sr-only">Go to a page</caption>
              <tbody>
                {chords.map((v) => (
                  <tr key={v.id} className="[&>td]:py-1.5">
                    <td className="pr-4 text-ink">{v.label}</td>
                    <td className="text-right">
                      <Keys keys={["G", "then", (v.chord ?? "").split(" ")[1]?.toUpperCase() ?? ""]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
