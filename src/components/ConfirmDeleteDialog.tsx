import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemLabel?: string;
  /** "permanent" replaces the standard recoverable copy with a destructive warning. */
  variant?: 'soft' | 'permanent';
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDeleteDialog({
  open, onOpenChange, itemLabel, variant = 'soft', onConfirm,
}: Props) {
  const isPermanent = variant === 'permanent';
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {isPermanent ? 'Permanently delete?' : 'Move to Recently Deleted?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isPermanent ? (
              <>This permanently removes <strong>{itemLabel ?? 'this item'}</strong>. This action cannot be undone.</>
            ) : (
              <>
                <strong>{itemLabel ?? 'This item'}</strong> will be moved to Recently Deleted.
                You can restore it within 30 days before it&rsquo;s archived.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={isPermanent ? 'bg-destructive hover:bg-destructive/90' : ''}
            onClick={onConfirm}
          >
            {isPermanent ? 'Delete forever' : 'Move to Recently Deleted'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
