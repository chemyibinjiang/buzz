import { CodexSharedRuntimePanel } from "./CodexSharedRuntimePanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export function CodexSharedRuntimeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"
        data-testid="codex-shared-runtime-dialog"
      >
        <DialogHeader>
          <DialogTitle>Codex shared runtime</DialogTitle>
          <DialogDescription>
            Check the computer-level app-server, open Codex Desktop on it, or
            resolve a private runtime conflict.
          </DialogDescription>
        </DialogHeader>
        <CodexSharedRuntimePanel enabled={open} />
      </DialogContent>
    </Dialog>
  );
}
