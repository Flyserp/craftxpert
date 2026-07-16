import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Camera, X, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LeaveReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  providerId: string;
  providerName?: string;
  onReviewSubmitted?: () => void;
 /** When provided, modal switches to edit mode and updates this review row. */
 existingReview?: {
  id: string;
  rating: number;
  comment: string | null;
 } | null;
}

function PhotoUploadSection({
  label,
  photos,
  onAdd,
  onRemove,
}: {
  label: string;
  photos: File[];
  onAdd: (files: FileList) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <p className="text-fs-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((file, i) => (
          <div key={i} className="relative w-16 h-16 rounded-sm overflow-hidden border border-border group">
            <img
              src={URL.createObjectURL(file)}
              alt=""
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute inset-0 bg-overlay opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        ))}
        {photos.length < 4 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-16 h-16 rounded-sm border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-primary transition-colors"
          >
            <ImagePlus className="w-4 h-4" />
            <span className="text-[9px]">Add</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            onAdd(e.target.files);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}

export default function LeaveReviewModal({
  open,
  onOpenChange,
  bookingId,
  providerId,
  providerName,
  onReviewSubmitted,
 existingReview,
}: LeaveReviewModalProps) {
  const { user } = useAuth();
 const isEdit = !!existingReview;
 const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [hoveredRating, setHoveredRating] = useState(0);
 const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

 // Sync when the modal is opened for a different review
 useEffect(() => {
  if (open) {
   setRating(existingReview?.rating ?? 0);
   setComment(existingReview?.comment ?? "");
  }
 }, [open, existingReview?.id]);

  const addPhotos = (
    existing: File[],
    setter: React.Dispatch<React.SetStateAction<File[]>>,
    files: FileList
  ) => {
    const newFiles = Array.from(files).filter(
      (f) => f.size <= 5 * 1024 * 1024 && f.type.startsWith("image/")
    );
    setter([...existing, ...newFiles].slice(0, 4));
  };

  const removePhoto = (
    existing: File[],
    setter: React.Dispatch<React.SetStateAction<File[]>>,
    index: number
  ) => {
    setter(existing.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (files: File[], folder: string): Promise<string[]> => {
    if (!user || files.length === 0) return [];
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("review-photos")
        .upload(path, file, { contentType: file.type });
      if (error) {
        console.error("Upload error:", error);
        continue;
      }
      const { data } = supabase.storage.from("review-photos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);

    try {
      // Upload photos in parallel
      const [beforeUrls, afterUrls] = await Promise.all([
        uploadPhotos(beforePhotos, "before"),
        uploadPhotos(afterPhotos, "after"),
      ]);

   const { error } = isEdit
    ? await supabase
      .from("reviews")
      .update({
       rating,
       comment: comment.trim() || null,
       ...(beforeUrls.length > 0 ? { before_photos: beforeUrls } : {}),
       ...(afterUrls.length > 0 ? { after_photos: afterUrls } : {}),
      })
      .eq("id", existingReview!.id)
      .eq("customer_id", user.id)
    : await supabase.from("reviews").insert({
      booking_id: bookingId,
      customer_id: user.id,
      vendor_id: providerId,
      rating,
      comment: comment.trim() || null,
      before_photos: beforeUrls.length > 0 ? beforeUrls : null,
      after_photos: afterUrls.length > 0 ? afterUrls : null,
     });

   if (error) {
        if (error.code === "23505") {
          toast.error("You've already reviewed this booking.");
        } else if (error.code === "23514") {
          toast.error("Please pick a star rating between 1 and 5.");
        } else if (error.code === "42501" || error.message?.toLowerCase().includes("row-level security")) {
          toast.error("You can only review bookings you've completed with this pro.");
        } else {
     toast.error(isEdit ? "Failed to update review. Please try again." : "Failed to submit review. Please try again.");
        }
        return;
      }

   // Send review_received notification to vendor (only on create)
   if (!isEdit) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
      const customerName = profile?.display_name || "A customer";
      const starText = `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;

      supabase.from("notifications").insert({
        user_id: providerId,
        type: "review_received",
        title: "New Review Received",
        message: `${customerName} left you a ${rating}-star review ${starText}${comment.trim() ? `: "${comment.trim().slice(0, 80)}${comment.trim().length > 80 ? "…" : ""}"` : "."}`,
        metadata: { booking_id: bookingId, customer_id: user.id, rating },
      }).then(({ error: nErr }) => {
        if (nErr) console.error("Notification error:", nErr);
      });
   }

   toast.success(isEdit ? "Review updated." : "Review submitted! Thank you for your feedback.");
      setRating(0);
      setComment("");
      setBeforePhotos([]);
      setAfterPhotos([]);
      onOpenChange(false);
      onReviewSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;
  const hasPhotos = beforePhotos.length > 0 || afterPhotos.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
      {isEdit ? "Edit your review" : "Rate your experience"}{providerName ? ` with ${providerName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Star rating */}
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                onMouseEnter={() => setHoveredRating(i)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    i <= displayRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <p className="text-center text-fs-sm text-muted-foreground">
              {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
            </p>
          )}

          {/* Comment */}
          <Textarea
            placeholder="Share your experience (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
          />

          {/* Photo uploads */}
          <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-1.5 text-fs-xs font-medium text-muted-foreground">
              <Camera className="w-3.5 h-3.5" />
              <span>Attach photos (optional, max 4 each)</span>
            </div>
            <PhotoUploadSection
              label="Before"
              photos={beforePhotos}
              onAdd={(files) => addPhotos(beforePhotos, setBeforePhotos, files)}
              onRemove={(i) => removePhoto(beforePhotos, setBeforePhotos, i)}
            />
            <PhotoUploadSection
              label="After"
              photos={afterPhotos}
              onAdd={(files) => addPhotos(afterPhotos, setAfterPhotos, files)}
              onRemove={(i) => removePhoto(afterPhotos, setAfterPhotos, i)}
            />
          </div>

          <Button
            className="w-full"
            disabled={rating === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting
              ? hasPhotos
                ? "Uploading photos…"
          : isEdit ? "Saving…" : "Submitting…"
        : isEdit ? "Save Changes" : "Submit Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
