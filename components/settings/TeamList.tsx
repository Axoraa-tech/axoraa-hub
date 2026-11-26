"use client";

import React from "react";
import { KeyRound, Users } from "lucide-react";
import { PEOPLE, type Person } from "@/lib/people";
import { Avatar, CardHeader } from "@/components/ui/primitives";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Code } from "./IntegrationRow";

const CATEGORY_LABEL: Record<Person["category"], string> = {
  admin: "Administrator",
  founder: "Founder",
  marketing: "Marketing",
  developer: "Developer",
};

const CATEGORY_CHIP: Record<Person["category"], string> = {
  admin: "chip-ink",
  founder: "chip-lime",
  marketing: "chip-amber",
  developer: "",
};

const columns: TableColumn<Person>[] = [
  {
    id: "name",
    header: "Name",
    sortValue: (p) => p.name,
    cell: (p) => (
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={p.name} size={28} />
        <span className="truncate font-medium text-ink">{p.name}</span>
      </span>
    ),
  },
  { id: "username", header: "Username", mono: true, sortValue: (p) => p.id, cell: (p) => p.id, hideBelow: "sm" },
  {
    id: "category",
    header: "Role",
    sortValue: (p) => CATEGORY_LABEL[p.category],
    cell: (p) => <span className={`chip ${CATEGORY_CHIP[p.category]}`}>{CATEGORY_LABEL[p.category]}</span>,
  },
  { id: "title", header: "Title", truncate: true, hideBelow: "lg", sortValue: (p) => p.title, cell: (p) => <span className="text-ink-2">{p.title}</span> },
  {
    id: "email",
    header: "Email",
    hideBelow: "md",
    sortValue: (p) => p.email ?? "",
    cell: (p) =>
      p.email ? (
        <a href={`mailto:${p.email}`} className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink" onClick={(e) => e.stopPropagation()}>
          {p.email}
        </a>
      ) : null,
  },
];

export function TeamList() {
  return (
    <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="team-title">
      <CardHeader icon={<Users />} title={<span id="team-title">Team</span>} subtitle={`${PEOPLE.length} accounts, read only`} />
      <div className="mt-5">
        <DataTable<Person>
          caption="Team accounts"
          rows={PEOPLE}
          columns={columns}
          rowKey={(p) => p.id}
          mobileCard={(p) => (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={p.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{p.name}</span>
                  <span className={`chip ${CATEGORY_CHIP[p.category]}`}>{CATEGORY_LABEL[p.category]}</span>
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{p.title}</p>
                <p className="mt-0.5 truncate font-mono text-[12px] text-ink-2">{p.id}</p>
                {p.email && (
                  <a href={`mailto:${p.email}`} className="mt-0.5 block truncate text-[12.5px] text-ink underline underline-offset-2">
                    {p.email}
                  </a>
                )}
              </div>
            </div>
          )}
        />
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
        <KeyRound aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
        <p>
          Accounts and passwords are managed in the server environment (<Code>AUTH_HASH_*</Code>). To add a person or reset a password, ask whoever runs the deployment.
        </p>
      </div>
    </section>
  );
}
