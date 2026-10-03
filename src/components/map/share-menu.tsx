"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Copy, Share2, Trash2 } from "lucide-react";
import { deleteSaved, loadSaved, saveMap, type SavedMap } from "@/lib/share/saved";

type Props = {
  /** The link to hand out (built from the current map state when asked). */
  getUrl: () => string;
  /** The map's query string, stored by "Save". */
  getQuery: () => string;
  /** What the link carries, one short line each. */
  summary: string[];
};

const dateLabel = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** "Share" pill in the top-right corner: copy a link that reopens this exact view, or save it on this device. */
export function ShareMenu({ getUrl, getQuery, summary }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<SavedMap[]>([]);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const urlField = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const toggle = () => {
    if (open) return setOpen(false);
    setUrl(getUrl());
    setName(`Kraków picks · ${dateLabel()}`);
    setSaved(loadSaved());
    setSaveNote(null);
    setCopied(false);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: select the text so Ctrl/Cmd+C works.
      urlField.current?.select();
    }
  };

  const save = () => {
    const r = saveMap({ name, query: getQuery() });
    setSaved(r.list);
    setSaveNote(r.ok ? "Saved on this device." : "Your browser blocked saving here, so use the link instead.");
  };

  return (
    <div ref={root} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-4 text-sm font-medium shadow-lg shadow-black/5 backdrop-blur ${
          open ? "border-emerald-700 bg-emerald-700 text-white" : "border-border/70 bg-white/90 hover:bg-white"
        }`}
      >
        <Share2 className="size-4" />
        Share
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share this map"
          className="absolute left-1/2 top-full z-20 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-2xl border border-border/70 bg-white/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:right-0 sm:translate-x-0"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">The link reopens</div>
          <ul className="mt-1.5 space-y-0.5 text-sm text-slate-700">
            {summary.map((line) => (
              <li key={line} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              ref={urlField}
              readOnly
              value={url}
              aria-label="Link to this map"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-full border border-border/70 bg-muted/60 px-3 py-1.5 text-xs text-slate-600"
            />
            <button
              type="button"
              onClick={copy}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          {canShare && (
            <button
              type="button"
              onClick={() => navigator.share({ title: "Kraków matched to me", url }).catch(() => {})}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-border/70 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Share2 className="size-4" />
              Share…
            </button>
          )}

          <div className="mt-4 border-t border-border/70 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Save on this device</div>
            <div className="mt-1.5 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                aria-label="Name of the saved map"
                className="min-w-0 flex-1 rounded-full border border-border/70 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={save}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 px-3.5 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <Bookmark className="size-4" />
                Save
              </button>
            </div>
            {saveNote && (
              <p role="status" className="mt-1.5 text-[11px] text-muted-foreground">
                {saveNote}
              </p>
            )}
            {saved.length === 0 ? (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Saved maps appear here and on the start page, so you can come back to your picks. They stay in this browser only.
              </p>
            ) : (
              <ul className="mt-2 space-y-0.5">
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center gap-1">
                    <Link href={`/map?${s.query}`} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-sm hover:bg-muted">
                      {s.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSaved(deleteSaved(s.id))}
                      aria-label={`Delete ${s.name}`}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
