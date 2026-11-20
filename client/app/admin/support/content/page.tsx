"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Btn, FilterChips, Loading, OpsNote, Panel } from "@/components/admin/ui";
import { RichText, TextArea } from "@/components/sfx/kit";
import { Alert, Field } from "@/components/sfx/ui";
import { getAdminPageContent, PageContentRecord, PageSlug, updateAdminPageContent } from "@/services/admin.service";

type Faq = { q: string; a: string };
const SLUGS: Array<{ value: PageSlug; label: string; where: string }> = [
  { value: "support", label: "Support", where: "Profile → Support" },
  { value: "faq", label: "FAQ", where: "Profile → FAQ" },
  { value: "help", label: "Help", where: "Profile → Help" },
  { value: "about", label: "About", where: "Profile → About" },
];
const parseFaq = (raw: string): Faq[] => {
  try {
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p)) return p.map((x) => ({ q: String(x?.q ?? ""), a: String(x?.a ?? "") }));
  } catch {
    // not JSON yet
  }
  return [];
};
const errText = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

/**
 * Figma: ADMIN / Support. The client-facing help content (Support, FAQ, Help, About).
 * There is no ticket system in the API; clients reach support through the contact
 * details published here.
 */
export default function AdminSupportPage() {
  const [slug, setSlug] = useState<PageSlug>("support");
  const [pages, setPages] = useState<Partial<Record<PageSlug, PageContentRecord>>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.allSettled(SLUGS.map((s) => getAdminPageContent(s.value))).then((res) => {
      if (!alive) return;
      const next: Partial<Record<PageSlug, PageContentRecord>> = {};
      res.forEach((r, i) => {
        next[SLUGS[i].value] = r.status === "fulfilled" ? r.value : { slug: SLUGS[i].value, title: "", content: "" };
      });
      setPages(next);
      if (res.every((r) => r.status === "rejected")) setError("Couldn’t load page content.");
    });
    return () => {
      alive = false;
    };
  }, []);

  const current = pages[slug];
  const meta = SLUGS.find((s) => s.value === slug)!;

  return (
    <>
      {error && <Alert className="mb-4">{error}</Alert>}
      <Panel title="Client help content" aside={`Shown in ${meta.where}`}>
        <FilterChips value={slug} onChange={setSlug} options={SLUGS.map((s) => ({ value: s.value, label: s.label }))} label="Page" />
        <div className="mt-4">
          {!current ? (
            <Loading rows={3} />
          ) : slug === "faq" ? (
            <FaqEditor key="faq" initial={current} onSaved={(p) => setPages((x) => ({ ...x, faq: p }))} />
          ) : (
            <TextEditor key={slug} slug={slug} initial={current} onSaved={(p) => setPages((x) => ({ ...x, [slug]: p }))} />
          )}
        </div>
      </Panel>
      <OpsNote>Publish a support email or phone number on the Support page — clients use it to reach your team. Changes go live as soon as you save.</OpsNote>
    </>
  );
}

function TextEditor({ slug, initial, onSaved }: { slug: PageSlug; initial: PageContentRecord; onSaved: (p: PageContentRecord) => void }) {
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const dirty = title !== initial.title || content !== initial.content;

  const save = async () => {
    if (!title.trim()) return setMsg({ tone: "danger", text: "Add a page title." });
    setBusy(true);
    setMsg(null);
    try {
      const p = await updateAdminPageContent(slug, { title: title.trim(), content });
      onSaved(p);
      setMsg({ tone: "success", text: "Saved and live." });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Couldn’t save.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Field label="Page title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <TextArea label="Content" value={content} onChange={(e) => setContent(e.target.value)} rows={14} />
        <p className="-mt-2 text-[12px] text-sfx-muted">Blank line = new paragraph. Links and email addresses become clickable.</p>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Btn loading={busy} disabled={!dirty} onClick={save} className="self-end">
          Save changes
        </Btn>
      </div>
      <Preview title={title}>{content.trim() ? <RichText text={content} /> : <p className="text-[13px] text-sfx-muted">Nothing here yet.</p>}</Preview>
    </div>
  );
}

function FaqEditor({ initial, onSaved }: { initial: PageContentRecord; onSaved: (p: PageContentRecord) => void }) {
  const [title, setTitle] = useState(initial.title || "Frequently asked questions");
  const [items, setItems] = useState<Faq[]>(() => {
    const p = parseFaq(initial.content);
    return p.length ? p : [{ q: "", a: "" }];
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const set = (i: number, k: keyof Faq, v: string) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = xs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    const clean = items.map((x) => ({ q: x.q.trim(), a: x.a.trim() })).filter((x) => x.q || x.a);
    if (clean.some((x) => !x.q || !x.a)) return setMsg({ tone: "danger", text: "Every question needs an answer (and vice versa)." });
    setBusy(true);
    setMsg(null);
    try {
      const p = await updateAdminPageContent("faq", { title: title.trim() || "FAQ", content: JSON.stringify(clean) });
      onSaved(p);
      setMsg({ tone: "success", text: `Saved ${clean.length} question${clean.length === 1 ? "" : "s"}.` });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Couldn’t save.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Page title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <ol className="flex flex-col gap-3">
        {items.map((x, i) => (
          <li key={i} className="rounded-[16px] border border-sfx-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-sfx-muted">Question {i + 1}</span>
              <div className="flex gap-1">
                <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={14} />
                </IconBtn>
                <IconBtn label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={14} />
                </IconBtn>
                <IconBtn label="Remove question" onClick={() => setItems((xs) => (xs.length === 1 ? [{ q: "", a: "" }] : xs.filter((_, j) => j !== i)))}>
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Question" value={x.q} onChange={(e) => set(i, "q", e.target.value)} maxLength={200} />
              <TextArea label="Answer" value={x.a} onChange={(e) => set(i, "a", e.target.value)} rows={3} />
            </div>
          </li>
        ))}
      </ol>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap justify-between gap-2">
        <Btn variant="secondary" onClick={() => setItems((xs) => [...xs, { q: "", a: "" }])}>
          <Plus size={15} /> Add question
        </Btn>
        <Btn loading={busy} onClick={save}>
          Save FAQ
        </Btn>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-sfx-muted hover:bg-sfx-surface-2 hover:text-sfx-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Preview({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-sfx-line bg-sfx-bg/60 p-5">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted">Client preview</p>
      <h3 className="mb-4 text-[20px] font-bold text-sfx-text">{title || "Untitled"}</h3>
      {children}
    </div>
  );
}
