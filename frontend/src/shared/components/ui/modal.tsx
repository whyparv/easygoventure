import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  showClose?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  showClose = true,
}: ModalProps) {
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
                transition={{ duration: 0.16 }}
                className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]"
              />
            </Dialog.Overlay>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 4 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className={cn(
                    'flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg outline-none',
                    className,
                  )}
                >
                  {(title || showClose) && (
                    <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
                      <div>
                        {title && (
                          <Dialog.Title className="text-base font-semibold text-foreground">
                            {title}
                          </Dialog.Title>
                        )}
                        {description && (
                          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                            {description}
                          </Dialog.Description>
                        )}
                      </div>
                      {showClose && (
                        <Dialog.Close className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <X className="size-4" />
                        </Dialog.Close>
                      )}
                    </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>
                  {footer && (
                    <div className="flex justify-end gap-2 border-t border-border px-6 py-3">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
