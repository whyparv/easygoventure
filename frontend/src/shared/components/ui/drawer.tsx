import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  widthClass?: string;
}

/**
 * Right-side sheet (~40% viewport) with focus trapping via Radix Dialog and a
 * subtle slide animation. Used for the Lead detail panel.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  header,
  footer,
  children,
  widthClass = 'w-full sm:w-[44vw] sm:min-w-[560px] sm:max-w-[760px]',
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.3 }}
                className={cn(
                  'fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-card shadow-lg outline-none',
                  widthClass,
                )}
              >
                <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
                  <div className="min-w-0">
                    {title && (
                      <Dialog.Title className="truncate text-base font-semibold text-foreground">
                        {title}
                      </Dialog.Title>
                    )}
                    {description && (
                      <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                        {description}
                      </Dialog.Description>
                    )}
                    {header}
                  </div>
                  <Dialog.Close className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
                {footer && <div className="border-t border-border px-6 py-3">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
