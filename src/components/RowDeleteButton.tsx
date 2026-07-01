import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { softDelete, type SoftDeleteTable } from '@/lib/soft-delete';

interface Props {
  table: SoftDeleteTable;
  id: string;
  label?: string;
  onDeleted?: () => void;
  size?: 'sm' | 'icon';
}

export default function RowDeleteButton({ table, id, label, onDeleted, size = 'icon' }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    const { error } = await softDelete({ table, id, label });
    setBusy(false);
    setOpen(false);
    if (error) return toast.error(error.message);
    toast.success(`${label ?? 'Item'} moved to Recently Deleted`);
    onDeleted?.();
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={size === 'icon' ? 'icon' : 'sm'}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              disabled={busy}
              aria-label="Move to Recently Deleted"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Move to Recently Deleted</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        itemLabel={label}
        onConfirm={handleConfirm}
      />
    </>
  );
}
