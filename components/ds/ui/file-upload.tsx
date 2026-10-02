import * as React from "react";
import { CircleCheck, File as FileIcon, RotateCcw, UploadCloud, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useLatest } from '@/lib/use-latest';

// design-system.md §4.25 — dashed zone = "something goes here". Validate
// client-side BEFORE upload. Parallel uploads, max 3 concurrent. Paste (⌘V)
// uploads images from the clipboard. The whole zone is a button wrapping a
// visually-hidden file input.

export interface UploadFile {
  id: string;
  file: File;
  status: "uploading" | "done" | "error";
  progress: number; // 0–100
  error?: string;
  /** Local object URL for image thumbnails — available before upload finishes. */
  preview?: string;
}

export interface FileUploadProps {
  /** e.g. [".png",".jpg",".pdf"] or MIME prefixes ["image/"] */
  accept?: string[];
  maxSizeMB?: number;
  multiple?: boolean;
  /** Performs the upload; call onProgress(0–100); resolve on success. */
  upload: (file: File, onProgress: (pct: number) => void) => Promise<void>;
  /** Human constraints line, e.g. "PNG, JPG, PDF · up to 10 MB". */
  constraints?: string;
  /** Fires whenever the list changes (add · progress · done · error · remove).
   *  Lets a single-value caller mirror state — e.g. clear its answer when the
   *  list empties, or read the completed set. */
  onFilesChange?: (files: UploadFile[]) => void;
  className?: string;
}

const MAX_CONCURRENT = 3;

export function FileUpload({ accept, maxSizeMB = 10, multiple = true, upload, constraints, onFilesChange, className }: FileUploadProps) {
  const [files, setFiles] = React.useState<UploadFile[]>([]);
  const [drag, setDrag] = React.useState<"none" | "valid" | "invalid">("none");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const queue = React.useRef<UploadFile[]>([]);
  const activeCount = React.useRef(0);

  // Report list changes to a mirroring caller without making them re-render this
  // component: keep the latest callback in a ref and fire it from one effect.
  const onFilesChangeRef = useLatest(onFilesChange);
  const firstFilesRun = React.useRef(true);
  React.useEffect(() => {
    if (firstFilesRun.current) { firstFilesRun.current = false; return; } // skip the mount echo
    onFilesChangeRef.current?.(files);
  }, [files]);

  const matchesType = (f: File) =>
    !accept?.length ||
    accept.some((a) => (a.startsWith(".") ? f.name.toLowerCase().endsWith(a.toLowerCase()) : f.type.startsWith(a)));

  const patch = (id: string, p: Partial<UploadFile>) =>
    setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f)));

  // A NAMED function expression, so the recursive call resolves to the function
  // itself rather than to the `const pump` binding being declared. Reaching
  // outward meant referencing a variable inside its own initializer — harmless
  // at call time, since `.finally` runs later, but the compiler cannot know
  // that and refuses to optimize a component that does it.
  const pump = React.useCallback(function pump() {
    while (activeCount.current < MAX_CONCURRENT && queue.current.length) {
      const item = queue.current.shift()!;
      activeCount.current++;
      upload(item.file, (pct) => patch(item.id, { progress: pct }))
        .then(() => patch(item.id, { status: "done", progress: 100 }))
        .catch((e) => patch(item.id, { status: "error", error: e?.message ?? "Upload failed" }))
        .finally(() => {
          activeCount.current--;
          pump();
        });
    }
  }, [upload]);

  const add = (list: FileList | File[]) => {
    const next: UploadFile[] = [];
    for (const file of Array.from(list)) {
      const id = crypto.randomUUID();
      // Client-side validation FIRST — never upload 40 MB to then refuse it.
      if (!matchesType(file)) {
        next.push({ id, file, status: "error", progress: 0, error: "File type not accepted" });
        continue;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        next.push({ id, file, status: "error", progress: 0, error: `Too large: max ${maxSizeMB} MB` });
        continue;
      }
      const item: UploadFile = {
        id,
        file,
        status: "uploading",
        progress: 0,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      };
      next.push(item);
      queue.current.push(item);
    }
    setFiles((fs) => (multiple ? [...fs, ...next] : next));
    pump();
  };

  const retry = (f: UploadFile) => {
    patch(f.id, { status: "uploading", progress: 0, error: undefined });
    queue.current.push(f);
    pump();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag("none");
    if (e.dataTransfer.files.length) add(e.dataTransfer.files);
  };

  // The zone's own fill (`bg-paper-3`) is STRUCTURE and sits in the base class;
  // a state changes the edge and layers a wash over that fill — the `wash-over`
  // rule for anything with a fill of its own. Invalid swaps the fill for danger
  // (cn merges, so it wins). Valid was `bg-berry-alpha-10`, which Tailwind never
  // generated, so a valid drag REMOVED the fill: in dark the zone dropped from
  // #333333 to the page's #191919.
  const zoneState =
    drag === "valid"
      ? "border-berry-500 border-solid wash-over"
      : drag === "invalid"
        ? "border-line-danger border-solid bg-danger-100"
        : "border-line-strong hover:border-ink-300 hover:wash-over";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          const items = Array.from(e.dataTransfer.items);
          const ok = items.every((i) => !accept?.length || accept.some((a) => (a.startsWith(".") ? true : i.type.startsWith(a))));
          setDrag(ok ? "valid" : "invalid");
        }}
        onDragLeave={() => setDrag("none")}
        onDrop={onDrop}
        onPaste={(e) => {
          const imgs = Array.from(e.clipboardData.files);
          if (imgs.length) add(imgs);
        }}
        className={cn(
          "focus-ring flex w-full flex-col items-center gap-2 rounded-md border border-dashed bg-paper-3 py-8 transition-colors duration-fast",
          zoneState,
        )}
      >
        <UploadCloud className={cn("size-6", drag === "valid" ? "text-berry-500" : "text-ink-500")} aria-hidden />
        <span className="text-body text-ink-800">
          {drag === "valid" ? (
            "Drop to upload"
          ) : drag === "invalid" ? (
            "That file type isn't accepted"
          ) : (
            <>
              Drop files here or <span className="font-medium text-berry-600">browse</span>
            </>
          )}
        </span>
        {constraints && <span className="text-meta text-ink-600">{constraints}</span>}
      </button>
      {/* Outside the button — an interactive descendant inside a button is an
          a11y violation even when visually hidden. */}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept?.join(",")}
        onChange={(e) => {
          if (e.target.files?.length) add(e.target.files);
          e.target.value = "";
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li
              key={f.id}
              className={cn(
                "flex items-center gap-2 rounded-sm border border-line px-2 py-1.5",
                f.status === "error" && "border-transparent bg-danger-100",
              )}
            >
              {f.preview ? (
                <img src={f.preview} alt="" className="size-10 rounded-xs object-cover" />
              ) : (
                <FileIcon className="size-4 shrink-0 text-ink-500" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-ui text-ink-800">{f.file.name}</span>
                  <span className="shrink-0 font-mono text-caption text-ink-500">
                    {(f.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </span>
                {f.status === "uploading" && (
                  <span className="mt-1 block h-0.5 w-full overflow-hidden rounded-full bg-paper-5">
                    <span className="block h-full w-full rounded-full bg-berry-500 transition-transform duration-base ease-standard" style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, f.progress))}%)` }} />
                  </span>
                )}
                {f.status === "error" && <span className="block text-meta text-danger-600">{f.error}</span>}
              </span>
              {f.status === "done" && <CircleCheck className="size-4 shrink-0 text-success-500" aria-label="Uploaded" />}
              {f.status === "error" && (
                <button
                  type="button"
                  onClick={() => retry(f)}
                  className="focus-ring flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-meta font-medium text-danger-600 hover:bg-danger-100"
                >
                  <RotateCcw className="size-3" aria-hidden /> Retry
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove ${f.file.name}`}
                onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))}
                className="focus-ring grid size-6 shrink-0 place-items-center rounded-xs text-ink-500 hover:bg-surface-hover hover:text-ink-700"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
