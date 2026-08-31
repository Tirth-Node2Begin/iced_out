"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { adminClient } from "@/api/clients";
import { Btn } from "@/components/shell/admin-ui";

/**
 * The other photographs of a piece — the ones the product page pages through.
 *
 * The single `MediaField` beside it stays the PRIMARY, and the split is not
 * cosmetic: one picture has to stand for the piece on a card, in the bag and in
 * search, and a component that had to choose one out of a list would let two
 * cards of the same product show different things. So the primary is answered
 * once, and everything else lives here in the order it should be looked at.
 *
 * Like `MediaField`, each file is uploaded the moment it is chosen rather than
 * at submit: the operator finds out whether it was accepted while they can still
 * pick a different one, and what this field actually submits is a comma-joined
 * list of the URLs the server gave back — so the record stays the flat map of
 * strings the whole console is built on. A media URL never contains a comma.
 *
 * The order is the arrangement, so it is editable: the arrows move a shot along
 * the run rather than making the operator delete and re-upload to fix a sequence.
 */
export function MediaGalleryField({
  name,
  label,
  defaultValue,
  /** Refused past this, because the product page is a gallery and not an album. */
  max = 12,
}: {
  name: string;
  /** Names the file input for a screen reader — the visible label is the field's. */
  label: string;
  defaultValue: string;
  max?: number;
}) {
  const [urls, setUrls] = useState(() => splitList(defaultValue));
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const room = max - urls.length;

  async function choose(files: FileList | null) {
    if (!files || files.length === 0) return;

    /* Trimmed to what is left rather than refusing the whole selection: an
       operator who drags in fifteen shots meant to add photographs, and taking
       the first twelve with a note is closer to that than taking none. */
    const chosen = Array.from(files).slice(0, Math.max(0, room));

    if (chosen.length < files.length) {
      toast.warning(`Only ${max} photos fit in a gallery`, {
        description: `${files.length - chosen.length} were left out.`,
      });
    }

    if (chosen.length === 0) return;

    setBusy(true);

    try {
      /* One at a time, in the order they were picked. `Promise.all` would be
         quicker and would land them in whatever order the server finished in —
         which is the one thing this field is not allowed to get wrong. */
      for (const file of chosen) {
        const body = new FormData();
        body.append("file", file);
        const response = await adminClient.post<{ data: { url: string } }>("/admin/media", body);
        const url = response.data.data.url;
        setUrls((current) => (current.includes(url) ? current : [...current, url]));
      }
    } catch (error) {
      /* The normaliser has already turned this into a message written to be
         shown, so it is shown rather than reworded. Whatever uploaded before the
         failure is kept — it is already stored, and dropping it would make the
         operator do that work twice. */
      toast.error(error instanceof Error ? error.message : "That image could not be uploaded.");
    } finally {
      setBusy(false);
      /* Cleared so picking the same file again still fires a change. */
      if (input.current) input.current.value = "";
    }
  }

  function move(from: number, by: number) {
    setUrls((current) => {
      const to = from + by;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }

  return (
    <span className="aui-gallery">
      {/* What the form submits: never the files, always the stored assets. An
          empty value is meaningful — it is the operator clearing the gallery. */}
      <input name={name} type="hidden" value={urls.join(", ")} />

      {urls.length > 0 && (
        <span className="aui-gallery__grid">
          {urls.map((url, index) => (
            <span className="aui-gallery__cell" key={url}>
              {/* A plain <img>: the src is a runtime API URL, which the static
                  export's image optimiser has no build-time way to resolve. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="aui-gallery__img" src={url} />

              <span aria-hidden className="aui-gallery__index">
                {index + 2}
              </span>

              <span className="aui-gallery__acts">
                <button
                  aria-label={`Move photo ${index + 1} earlier`}
                  className="aui-gallery__act"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  type="button"
                >
                  <ArrowLeft aria-hidden size={13} strokeWidth={1.8} />
                </button>
                <button
                  aria-label={`Move photo ${index + 1} later`}
                  className="aui-gallery__act"
                  disabled={index === urls.length - 1}
                  onClick={() => move(index, 1)}
                  type="button"
                >
                  <ArrowRight aria-hidden size={13} strokeWidth={1.8} />
                </button>
                <button
                  aria-label={`Remove photo ${index + 1}`}
                  className="aui-gallery__act aui-gallery__act--danger"
                  onClick={() => setUrls((current) => current.filter((entry) => entry !== url))}
                  type="button"
                >
                  <X aria-hidden size={13} strokeWidth={1.9} />
                </button>
              </span>
            </span>
          ))}
        </span>
      )}

      <span className="aui-gallery__foot">
        <Btn
          disabled={busy || room <= 0}
          onClick={() => input.current?.click()}
          size="sm"
          type="button"
          variant="ghost"
        >
          {busy ? "Uploading…" : urls.length ? "Add more" : "Upload photos"}
        </Btn>

        <small className="aui-gallery__count">
          {urls.length === 0
            ? `Up to ${max}. The primary photo above stays first.`
            : `${urls.length} of ${max} · shown after the primary, in this order`}
        </small>
      </span>

      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        className="aui-photo__file"
        multiple
        onChange={(event) => void choose(event.target.files)}
        ref={input}
        type="file"
      />
    </span>
  );
}

/** A comma-joined field back into its parts, ignoring stray spacing. */
function splitList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
