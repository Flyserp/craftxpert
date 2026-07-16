import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImagePlus, Loader2, Images, FileText, Film } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import SortablePortfolioItem from "./portfolio/SortablePortfolioItem";
import { Heading } from "@/components/ui/app";

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  media_type: "image" | "video" | "pdf";
  title: string | null;
  description: string | null;
}

const MAX_ITEMS = 12;
const MAX_SIZE_MB = 25;

function detectMediaType(file: File): "image" | "video" | "pdf" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  return null;
}

export default function ProviderPortfolioManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!user) return;
    const fetchItems = async () => {
      const { data } = await supabase
        .from("vendor_portfolio")
        .select("id, image_url, caption, sort_order, media_type, title, description")
        .eq("vendor_id", user.id)
        .order("sort_order", { ascending: true });
      setItems((data as PortfolioItem[]) || []);
      setLoading(false);
    };
    fetchItems();
  }, [user]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);

      // Optimistic update
      setItems(reordered);

      // Persist new sort_order values
      const results = await Promise.all(
        reordered.map((item, idx) =>
          supabase.from("vendor_portfolio").update({ sort_order: idx }).eq("id", item.id)
        )
      );
      const error = results.find((r) => r.error)?.error;
      if (error) {
        toast.error("Failed to save new order");
        setItems(items);
      }
    },
    [items, user]
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;

    const remaining = MAX_ITEMS - items.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_ITEMS} items allowed`);
      return;
    }

    const validFiles = files.slice(0, remaining).filter((f) => {
      if (!detectMediaType(f)) {
        toast.error(`${f.name}: unsupported (images, videos, PDF only)`);
        return false;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name} exceeds ${MAX_SIZE_MB}MB limit`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;
    setUploading(true);

    const newItems: PortfolioItem[] = [];

    for (const file of validFiles) {
      const mediaType = detectMediaType(file)!;
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("portfolio")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("portfolio")
        .getPublicUrl(filePath);

      const { data: inserted, error: insertError } = await supabase
        .from("vendor_portfolio")
        .insert({
          vendor_id: user.id,
          image_url: urlData.publicUrl,
          sort_order: items.length + newItems.length,
          media_type: mediaType,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        })
        .select()
        .single();

      if (insertError) {
        toast.error(`Failed to save ${file.name}`);
      } else if (inserted) {
        newItems.push(inserted as PortfolioItem);
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      toast.success(`${newItems.length} item${newItems.length > 1 ? "s" : ""} added!`);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (item: PortfolioItem) => {
    if (!user) return;
    setDeletingId(item.id);

    const urlParts = item.image_url.split("/portfolio/");
    const storagePath = urlParts[urlParts.length - 1];

    await supabase.storage.from("portfolio").remove([storagePath]);

    const { error } = await supabase
      .from("vendor_portfolio")
      .delete()
      .eq("id", item.id);

    setDeletingId(null);

    if (error) {
      toast.error("Failed to delete item");
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Item removed");
    }
  };

  const handleCaptionUpdate = async (id: string, caption: string) => {
    const { error } = await supabase
      .from("vendor_portfolio")
      .update({ caption: caption || null })
      .eq("id", id);
    if (!error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, caption: caption || null } : i)));
    }
  };

  const handleDescriptionUpdate = async (id: string, title: string, description: string) => {
    const { error } = await supabase
      .from("vendor_portfolio")
      .update({ title: title || null, description: description || null })
      .eq("id", id);
    if (error) {
      toast.error("Failed to save");
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, title: title || null, description: description || null } : i
      )
    );
    toast.success("Saved");
  };

  return (
    <div className="bg-card rounded-sm border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <Heading level={3}  className="flex items-center gap-2">
            <Images className="w-5 h-5 text-primary" />
            Portfolio
          </Heading>
          <p className="text-fs-xs text-muted-foreground mt-0.5">
            Showcase your best work — images, video, PDF ({items.length}/{MAX_ITEMS})
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || items.length >= MAX_ITEMS}
          className="gap-1.5"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          {uploading ? "Uploading…" : "Add Media"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/3] bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-12 rounded-sm border-2 border-dashed border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-colors flex flex-col items-center gap-2 text-muted-foreground"
        >
          <ImagePlus className="w-8 h-8" />
          <span className="text-fs-sm font-medium">Upload your first portfolio item</span>
          <span className="text-fs-xs flex items-center gap-2">
            <Images className="w-3 h-3" /> Images
            <Film className="w-3 h-3" /> Video
            <FileText className="w-3 h-3" /> PDF — up to {MAX_SIZE_MB}MB each
          </span>
        </button>
      ) : (
        <>
          <p className="text-[10px] text-muted-foreground mb-2">
            Drag items to reorder
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((item) => (
                  <SortablePortfolioItem
                    key={item.id}
                    item={item}
                    deletingId={deletingId}
                    onDelete={handleDelete}
                    onCaptionUpdate={handleCaptionUpdate}
                    onDescriptionUpdate={handleDescriptionUpdate}
                  />
                ))}

                {/* Add more slot */}
                {items.length < MAX_ITEMS && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-[4/3] rounded-lg border-2 border-dashed border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground"
                  >
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-5 h-5" />
                    )}
                    <span className="text-[10px] font-medium">Add More</span>
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
