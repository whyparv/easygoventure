import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@shared/utils/cn';

export const Dropdown = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;

export function DropdownContent({
  className,
  align = 'end',
  children,
}: {
  className?: string;
  align?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-md',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function DropdownItem({
  className,
  destructive,
  ...props
}: DropdownMenu.DropdownMenuItemProps & { destructive?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors',
        'focus:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground',
        destructive && 'text-danger focus:bg-danger/10 [&_svg]:text-danger',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}
