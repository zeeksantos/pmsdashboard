import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_BUCKET, formatBytes } from "@/lib/employees";
import { formatDateTime } from "@/lib/format";
import { UploadForm } from "./UploadForm";
import { DeleteDocumentButton } from "./DeleteDocumentButton";

export async function Documents({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employee_documents")
    .select("id, doc_type, file_path, file_name, size_bytes, uploaded_at")
    .eq("employee_id", employeeId)
    .order("uploaded_at", { ascending: false });
  const docs = data ?? [];

  // Short-lived links, created with the viewer's own permissions.
  const urls = new Map<string, string>();
  if (docs.length) {
    const { data: signed } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrls(docs.map((d) => d.file_path), 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-base font-semibold">Documents</h2>

      {canEdit && (
        <div className="mb-5 border-b border-border pb-5">
          <UploadForm employeeId={employeeId} />
        </div>
      )}

      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">File</th>
            <th className="py-2 pr-4 font-medium">Size</th>
            <th className="py-2 pr-4 font-medium">Uploaded</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const url = urls.get(d.file_path);
            return (
              <tr key={d.id} className="border-t border-border">
                <td className="py-2 pr-4">{d.doc_type}</td>
                <td className="py-2 pr-4">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {d.file_name ?? d.file_path.split("/").pop()}
                    </a>
                  ) : (
                    d.file_name ?? "—"
                  )}
                </td>
                <td className="py-2 pr-4">{formatBytes(d.size_bytes)}</td>
                <td className="py-2 pr-4">{formatDateTime(d.uploaded_at)}</td>
                <td className="py-2 text-right">
                  {canEdit && <DeleteDocumentButton id={d.id} employeeId={employeeId} />}
                </td>
              </tr>
            );
          })}
          {!docs.length && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-muted">No documents yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
