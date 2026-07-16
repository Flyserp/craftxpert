import { useSortable } from"@dnd-kit/sortable";
import { CSS } from"@dnd-kit/utilities";
import { Loader2, Trash2, GripVertical, FileText, Film, Pencil } from"lucide-react";
import { useState } from "react";
import { cn } from"@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface PortfolioItem {
 id: string;
 image_url: string;
 caption: string | null;
 sort_order: number;
 media_type: "image" | "video" | "pdf";
 title: string | null;
 description: string | null;
}

interface Props {
 item: PortfolioItem;
 deletingId: string | null;
 onDelete: (item: PortfolioItem) => void;
 onCaptionUpdate: (id: string, caption: string) => void;
 onDescriptionUpdate: (id: string, title: string, description: string) => void | Promise<void>;
}

export default function SortablePortfolioItem({ item, deletingId, onDelete, onCaptionUpdate, onDescriptionUpdate }: Props) {
 const {
 attributes,
 listeners,
 setNodeRef,
 transform,
 transition,
 isDragging,
 } = useSortable({ id: item.id });

 const style = {
 transform: CSS.Transform.toString(transform),
 transition,
 };

 const [editOpen, setEditOpen] = useState(false);
 const [title, setTitle] = useState(item.title || "");
 const [description, setDescription] = useState(item.description || "");

 return (
 <div
 ref={setNodeRef}
 style={style}
 className={cn(
"group relative",
 isDragging &&"z-50 opacity-80 scale-[1.03]"
 )}
 >
 <div className="aspect-[4/3] rounded-lg overflow-hidden ring-1 ring-border/40 bg-muted relative">
 {item.media_type === "image" && (
 <img
 src={item.image_url}
 alt={item.title || item.caption ||"Portfolio"}
 className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
 loading="lazy"
 draggable={false}
 />
 )}
 {item.media_type === "video" && (
 <video
 src={item.image_url}
 className="w-full h-full object-cover"
 muted
 playsInline
 preload="metadata"
 />
 )}
 {item.media_type === "pdf" && (
 <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
 <FileText className="w-10 h-10" />
 <span className="text-fs-xs font-medium px-2 truncate max-w-full">{item.title || "PDF"}</span>
 </div>
 )}
 {item.media_type !== "image" && (
 <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-1">
 {item.media_type === "video" ? <Film className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
 {item.media_type.toUpperCase()}
 </span>
 )}
 </div>

 {/* Drag handle */}
 <button
 {...attributes}
 {...listeners}
 className="absolute top-1.5 left-1.5 w-7 h-7 rounded-sm bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
 aria-label="Drag to reorder"
 >
 <GripVertical className="w-3.5 h-3.5 text-foreground/70" />
 </button>

 {/* Hover overlay */}
 <div className="absolute inset-0 rounded-lg bg-foreground/0 group-hover:bg-foreground/40 transition-all duration-200 flex items-end justify-between p-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
 <input
 type="text"
 defaultValue={item.caption ||""}
 placeholder="Add caption…"
 onBlur={(e) => onCaptionUpdate(item.id, e.target.value)}
 onClick={(e) => e.stopPropagation()}
 className="flex-1 mr-2 px-2 py-1 rounded text-fs-xs bg-background/90 border-0 truncate"
 />
 <Dialog open={editOpen} onOpenChange={setEditOpen}>
 <DialogTrigger asChild>
 <button
 className="shrink-0 w-7 h-7 rounded-sm bg-background/90 hover:bg-background flex items-center justify-center transition-colors active:scale-95 mr-1"
 aria-label="Edit project description"
 >
 <Pencil className="w-3.5 h-3.5 text-foreground/80" />
 </button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Project details</DialogTitle>
 </DialogHeader>
 <div className="space-y-3">
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="Project title"
 maxLength={80}
 />
 <Textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe the project, your role, results…"
 rows={5}
 maxLength={800}
 />
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
 <Button
 onClick={async () => {
 await onDescriptionUpdate(item.id, title.trim(), description.trim());
 setEditOpen(false);
 }}
 >Save</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 <button
 onClick={() => onDelete(item)}
 disabled={deletingId === item.id}
 className="shrink-0 w-7 h-7 rounded-sm bg-destructive/90 hover:bg-destructive flex items-center justify-center transition-colors active:scale-95"
 aria-label="Delete item"
 >
 {deletingId === item.id ? (
 <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
 ) : (
 <Trash2 className="w-3.5 h-3.5 text-white" />
 )}
 </button>
 </div>

 {/* Caption display */}
 {(item.title || item.caption) && (
 <p className="text-fs-xs text-muted-foreground mt-1.5 truncate px-0.5 group-hover:opacity-0 transition-opacity">
 {item.title || item.caption}
 </p>
 )}
 </div>
 );
}
