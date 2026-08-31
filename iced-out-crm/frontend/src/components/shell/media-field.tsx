"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { adminClient } from "@/api/clients";
import { Btn } from "@/components/shell/admin-ui";

/**
 * A photo on a record.
 *
 * The file is uploaded the moment it is chosen rather than at submit, for two
 * reasons: the operator sees whether it was accepted while they can still pick a
 * different one, and the form stays a flat map of strings — what this field
 * actually submits is the URL the server gave back, in a hidden input like any
 * other value.
 *
 * The server is the one that decides an image is an image: it sniffs the type,
 * re-encodes the bytes and caps the size. Nothing here is a security check —
 * `accept` only spares the operator a pointless round trip.
 *
 * Lives in its own module because two forms need it: the register's declarative
 * `type: "image"` field, and the product editor, which is a hand-written form
 * rather than a `RecordManager`. It was private to the register, which is why the
 * editor had no way to set a photo at all.
 */
export function MediaField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  /** Names the file input for a screen reader — the visible label is the field's. */
  label: string;
  defaultValue: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function choose(file: File | undefined) {
    if (!file) return;

    setBusy(true);
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await adminClient.post<{ data: { url: string } }>("/admin/media", body);
      setUrl(response.data.data.url);
    } catch (error) {
      /* The normaliser has already turned this into a message written to be
         shown, so it is shown rather than reworded. */
      toast.error(error instanceof Error ? error.message : "That image could not be uploaded.");
    } finally {
      setBusy(false);
      /* Cleared so picking the same file again still fires a change. */
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className="aui-photo">
      {/* What the form submits: never the file, always the stored asset. An empty
          value is meaningful — it is the operator removing the photo. */}
      <input name={name} type="hidden" value={url} />

      <span aria-hidden={url ? undefined : "true"} className="aui-photo__frame">
        {url ? (
          /* A plain <img>: the src is a runtime API URL, which the static
             export's image optimiser has no build-time way to resolve. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt="" className="aui-photo__img" src={url} />
        ) : (
          <span className="aui-photo__empty">No photo</span>
        )}
      </span>

      <span className="aui-photo__acts">
        <Btn
          disabled={busy}
          onClick={() => input.current?.click()}
          size="sm"
          type="button"
          variant="ghost"
        >
          {busy ? "Uploading…" : url ? "Replace" : "Upload"}
        </Btn>

        {url ? (
          <Btn onClick={() => setUrl("")} size="sm" type="button" variant="ghost">
            Remove
          </Btn>
        ) : null}
      </span>

      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        className="aui-photo__file"
        onChange={(event) => void choose(event.target.files?.[0])}
        ref={input}
        type="file"
      />
    </span>
  );
}
