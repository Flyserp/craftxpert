import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { GripVertical, Save, RotateCcw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useHomepageContent,
  DEFAULT_HOMEPAGE,
  type HomepageSection,
  type HomepageSectionType,
} from "@/hooks/useHomepageContent";
import { SECTION_META } from "@/components/landing/HomepageSections";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/app";

const ALL_TYPES: HomepageSectionType[] = [
  "featured_services",
  "sponsored_services",
  "verified_providers",
  "popular_categories",
  "recent_services",
];

function SortableRow({ section, onToggle, onRemove }: {
  section: HomepageSection;
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  } as const;
  const meta = SECTION_META[section.type];
  return (
    <Card ref={setNodeRef} style={style} className="flex items-center gap-3 p-4 rounded-sm">
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{meta?.label ?? section.type}</div>
        <div className="text-description-sm truncate">{meta?.description}</div>
      </div>
      <Switch
        checked={section.enabled}
        onCheckedChange={(v) => onToggle(section.id, !!v)}
        aria-label={`Toggle ${meta?.label}`}
      />
      <Button variant="ghost" size="icon" onClick={() => onRemove(section.id)} aria-label="Remove">
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}

export default function HomepageSectionsPage() {
  const { content, loading, save } = useHomepageContent();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [addType, setAddType] = useState<HomepageSectionType | "">("");

  useEffect(() => { setSections(content.sections); }, [content.sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      return oldIdx < 0 || newIdx < 0 ? prev : arrayMove(prev, oldIdx, newIdx);
    });
  };

  const toggle = (id: string, enabled: boolean) =>
    setSections((p) => p.map((s) => (s.id === id ? { ...s, enabled } : s)));

  const remove = (id: string) => setSections((p) => p.filter((s) => s.id !== id));

  const availableToAdd = useMemo(
    () => ALL_TYPES.filter((t) => !sections.some((s) => s.type === t)),
    [sections],
  );

  const addSection = () => {
    if (!addType) return;
    setSections((p) => [...p, { id: `${addType}_${Date.now()}`, type: addType, enabled: true }]);
    setAddType("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ ...content, sections });
      toast.success("Homepage sections saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setSections(DEFAULT_HOMEPAGE.sections);

  if (loading) return <AdminPage title="Homepage Sections"><LoadingState /></AdminPage>;

  return (
    <AdminPage
      title="Homepage Sections"
      subtitle="Choose which dynamic sections appear on the public homepage, toggle them on or off, and drag to reorder."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} className="rounded-sm">
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-sm">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 max-w-3xl">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sections.map((s) => (
                <SortableRow key={s.id} section={s} onToggle={toggle} onRemove={remove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {availableToAdd.length > 0 && (
          <Card className="p-4 rounded-sm flex items-center gap-3">
            <Select value={addType} onValueChange={(v) => setAddType(v as HomepageSectionType)}>
              <SelectTrigger className="rounded-sm">
                <SelectValue placeholder="Add a section..." />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((t) => (
                  <SelectItem key={t} value={t}>{SECTION_META[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addSection} disabled={!addType} className="rounded-sm">
              <Plus className="h-4 w-4 mr-2" /> Add
            </Button>
          </Card>
        )}
      </div>
    </AdminPage>
  );
}