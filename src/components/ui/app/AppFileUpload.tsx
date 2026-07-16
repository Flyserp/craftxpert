import { useCallback, useRef, useState } from "react";
import { Upload, X, File as FileIcon, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AppFileKind ="image" |"pdf" |"document";

const KIND_MIME: Record<AppFileKind, string[]> = {
  image: ["image/png","image/jpeg","image/jpg","image/webp","image/gif"],
  pdf: ["application/pdf"],
  document: [
   "application/msword",
   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
   "application/vnd.ms-excel",
   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
   "text/plain","text/csv",
  ],
};

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  path: string;
  url: string;
}

export interface AppFileUploadProps {
  bucket: string;
  /** Path prefix in bucket. Final path = `${pathPrefix}/${uuid}-${filename}` */
  pathPrefix?: string;
  /** Allowed kinds. Defaults to all three. */
  accept?: AppFileKind[];
  /** Max size in MB. Default 10. */
  maxSizeMB?: number;
  /** Max number of files. Default 5. */
  maxFiles?: number;
  /** Return signed URL (private bucket) instead of public URL. */
  signed?: boolean;
  /** Signed URL TTL seconds. Default 3600. */
  signedTtl?: number;
  value?: UploadedFile[];
  onChange?: (files: UploadedFile[]) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  helperText?: string;
}

function kindIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  return FileIcon;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Centralized file upload with drag & drop, validation, progress, preview,
 * and secure storage in a Supabase bucket. Supports public or signed URLs.
 */
export function AppFileUpload({
  bucket,
  pathPrefix ="",
  accept = ["image","pdf","document"],
  maxSizeMB = 10,
  maxFiles = 5,
  signed = false,
  signedTtl = 3600,
  value = [],
  onChange,
  disabled,
  className,
  label ="Upload files",
  helperText,
}: AppFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const allowedMime = accept.flatMap((k) => KIND_MIME[k]);
  const maxBytes = maxSizeMB * 1024 * 1024;

  const validate = useCallback(
    (file: File): string | null => {
      if (!allowedMime.includes(file.type)) return `${file.name}: unsupported file type`;
      if (file.size > maxBytes) return `${file.name}: exceeds ${maxSizeMB} MB`;
      return null;
    },
    [allowedMime, maxBytes, maxSizeMB],
  );

  const resolveUrl = useCallback(
    async (path: string): Promise<string> => {
      if (signed) {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, signedTtl);
        if (error) throw error;
        return data.signedUrl;
      }
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
    [bucket, signed, signedTtl],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (disabled) return;
      const files = Array.from(fileList);
      const room = maxFiles - value.length;
      if (room <= 0) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        return;
      }
      const queue = files.slice(0, room);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ??"anon";

      setUploading(true);
      setProgress(0);
      const uploaded: UploadedFile[] = [];
      try {
        for (let i = 0; i < queue.length; i++) {
          const file = queue[i];
          const err = validate(file);
          if (err) {
            toast.error(err);
            continue;
          }
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
          const path = `${pathPrefix ? pathPrefix +"/" :""}${userId}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await supabase.storage.from(bucket).upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });
          if (error) {
            toast.error(`${file.name}: ${error.message}`);
            continue;
          }
          const url = await resolveUrl(path);
          uploaded.push({ name: file.name, size: file.size, type: file.type, path, url });
          setProgress(Math.round(((i + 1) / queue.length) * 100));
        }
        if (uploaded.length) {
          onChange?.([...value, ...uploaded]);
          toast.success(`Uploaded ${uploaded.length} file${uploaded.length === 1 ?"" :"s"}`);
        }
      } finally {
        setUploading(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value ="";
      }
    },
    [bucket, disabled, maxFiles, onChange, pathPrefix, resolveUrl, validate, value],
  );

  const removeFile = useCallback(
    async (file: UploadedFile) => {
      const { error } = await supabase.storage.from(bucket).remove([file.path]);
      if (error) {
        toast.error(`Failed to remove: ${error.message}`);
        return;
      }
      onChange?.(value.filter((f) => f.path !== file.path));
    },
    [bucket, onChange, value],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-6 text-center transition-colors",
          dragOver ?"border-primary bg-primary/5" :"border-border bg-muted/30",
          disabled ?"cursor-not-allowed opacity-60" :"cursor-pointer hover:bg-muted/50",
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">
          Drag & drop or click. {accept.join(", ")} · up to {maxSizeMB} MB · max {maxFiles} files
        </div>
        {helperText ? <div className="text-xs text-muted-foreground">{helperText}</div> : null}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={allowedMime.join(",")}
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {uploading ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading… {progress}%
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      ) : null}

      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((f) => {
            const Icon = kindIcon(f.type);
            const isImage = f.type.startsWith("image/");
            return (
              <li
                key={f.path}
                className="flex items-center gap-3 rounded-sm border border-border bg-card p-2"
              >
                {isImage ? (
                  <img
                    src={f.url}
                    alt={f.name}
                    className="h-10 w-10 rounded-sm object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {f.name}
                  </a>
                  <div className="text-xs text-muted-foreground">{formatSize(f.size)}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(f)}
                  disabled={disabled}
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default AppFileUpload;