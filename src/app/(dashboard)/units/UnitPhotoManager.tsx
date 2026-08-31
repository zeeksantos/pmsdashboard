"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addUnitPhoto, deleteUnitPhoto } from "./actions";

type Photo = {
  id: string;
  storage_path: string;
  sort_order: number;
  url: string;
};

export function UnitPhotoManager({ unitId }: { unitId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadPhotos() {
    const supabase = createClient();
    const { data } = await supabase
      .from("unit_photos")
      .select("id, storage_path, sort_order")
      .eq("unit_id", unitId)
      .order("sort_order", { ascending: true });

    setPhotos(
      (data ?? []).map((p) => ({
        ...p,
        url: supabase.storage.from("unit-photos").getPublicUrl(p.storage_path).data.publicUrl,
      }))
    );
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch-on-mount, not a render loop
    loadPhotos().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);

    const supabase = createClient();
    let nextSortOrder = photos.length;

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${unitId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("unit-photos")
          .upload(path, file, { contentType: file.type || undefined });
        if (uploadErr) throw new Error(uploadErr.message);

        await addUnitPhoto(unitId, path, nextSortOrder);
        nextSortOrder += 1;
      }
      await loadPhotos();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload photo(s).");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDelete(photo: Photo) {
    if (!confirm("Delete this photo? This cannot be undone.")) return;
    setDeletingId(photo.id);
    startTransition(() => {
      deleteUnitPhoto(photo.id, unitId, photo.storage_path)
        .then(() => setPhotos((prev) => prev.filter((p) => p.id !== photo.id)))
        .catch((err) => {
          alert(err instanceof Error ? err.message : "Failed to delete photo");
        })
        .finally(() => setDeletingId(null));
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Photos {photos.length > 0 && <span className="text-sm font-normal text-muted">({photos.length})</span>}
        </h2>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {isUploading ? "Uploading…" : "Add photos"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={isUploading}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>

      {uploadError && <p className="mt-2 text-sm text-danger">{uploadError}</p>}

      {isLoading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading photos…
        </div>
      ) : photos.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
          No photos yet. Add at least a few so guests and staff can see this unit.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-raised"
            >
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(max-width: 640px) 33vw, 25vw"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => handleDelete(photo)}
                disabled={deletingId === photo.id}
                aria-label="Delete photo"
                className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100 disabled:opacity-60"
              >
                {deletingId === photo.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
