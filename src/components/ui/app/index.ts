/**
 * Centralized App* UI library.
 *
 * Thin, opinionated wrappers around shadcn primitives so feature code can
 * import a single consistent surface:
 *
 *   import { PrimaryButton, AppInput, AppCard, LoadingSpinner } from "@/components/ui/app";
 *
 * Naming convention:
 * - PrimaryButton / SecondaryButton / DangerButton — semantic CTAs
 * - App*  — generic primitives (Input, Select, Card, Badge, Modal, Table)
 * - Standalone names for utilities (LoadingSpinner, EmptyState, ConfirmDialog)
 */
export { PrimaryButton } from "./PrimaryButton";
export { SecondaryButton } from "./SecondaryButton";
export { DangerButton } from "./DangerButton";
export { SuccessButton } from "./SuccessButton";
export { WarningButton } from "./WarningButton";
export { InfoButton } from "./InfoButton";
export { AppInput, type AppInputProps } from "./AppInput";
export { AppTextarea, type AppTextareaProps } from "./AppTextarea";
export { AppSelect, type AppSelectProps, type AppSelectOption } from "./AppSelect";
export { AppCheckbox, type AppCheckboxProps } from "./AppCheckbox";
export { AppRadio, type AppRadioProps, type AppRadioOption } from "./AppRadio";
export { AppDatePicker, type AppDatePickerProps } from "./AppDatePicker";
export { AppCard, type AppCardProps } from "./AppCard";
export { AppBadge, type AppBadgeProps } from "./AppBadge";
export { StatusBadge, type StatusBadgeProps, type StatusKind } from "./StatusBadge";
export { SponsoredBadge, type SponsoredBadgeProps } from "./SponsoredBadge";
export { AppModal, type AppModalProps } from "./AppModal";
export { AppTable, type AppTableColumn, type AppTableProps } from "./AppTable";
export { LoadingSpinner, type LoadingSpinnerProps } from "./LoadingSpinner";
export { LoadingState, type LoadingStateProps, type LoadingStateVariant } from "./LoadingState";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { EmptyState } from "./EmptyState";
export { AppFileUpload, type AppFileUploadProps, type UploadedFile, type AppFileKind } from "./AppFileUpload";
export {
  Heading,
  type HeadingProps,
  type HeadingLevel,
  type HeadingVisual,
} from "./Heading";

// Domain card variants — all built on AppCard
export * from "./cards";