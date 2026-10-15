import type { Workflow } from "@/shared/api/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

type WorkflowDeleteDialogProps = {
  isDeleting: boolean;
  open: boolean;
  workflow: Workflow | null;
  onConfirm: (workflow: Workflow) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function WorkflowDeleteDialog({
  isDeleting,
  open,
  workflow,
  onConfirm,
  onOpenChange,
}: WorkflowDeleteDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
          <AlertDialogDescription>
            {workflow
              ? `Delete "${workflow.name}". This will stop all future triggers and remove the workflow permanently.`
              : "Delete this workflow."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild disabled={isDeleting}>
            <Button disabled={isDeleting} type="button" variant="outline">
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            disabled={isDeleting}
            onClick={() => {
              if (!isDeleting) {
                if (workflow) {
                  void onConfirm(workflow);
                }
              }
            }}
            type="button"
            variant="destructive"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
