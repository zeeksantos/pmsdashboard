"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_BUCKET,
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  documentTypes,
  formatBytes,
} from "@/lib/employees";

const input =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function UploadForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    const docType = String(fd.get("doc_type") ?? "");

    if (!(file instanceof File) || file.size === 0) return setError("Choose a file.");
    if (file.size > MAX_DOCUMENT_BYTES) {
      return setError(`File is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_DOCUMENT_BYTES)}.`);
    }
    if (!DOCUMENT_MIME_TYPES.includes(file.type)) {
      return setError("Only PDF, JPG, PNG, WEBP, DOC and DOCX files are allowed.");
    }

    setBusy(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${employeeId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setBusy(false);
      return setError(uploadError.message);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: rowError } = await supabase.from("employee_documents").insert({
      employee_id: employeeId,
      doc_type: docType,
      file_path: path,
      file_name: file.name,
      size_bytes: file.size,
      mime_type: file.type,
      uploaded_by: user?.id ?? null,
    });
    if (rowError) {
      // Don't leave an untracked file behind.
      await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
      setBusy(false);
      return setError(rowError.message);
    }

    formRef.current?.reset();
    setBusy(false);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="mb-1.5 block text-sm text-muted">Type</label>
        <select name="doc_type" className={input}>
          {documentTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm text-muted">File (PDF, image or Word, up to 10 MB)</label>
        <input name="file" type="file" accept={DOCUMENT_ACCEPT} required className={input} />
      </div>
      <div className="sm:col-span-3">
        <button
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </form>
  );
}
