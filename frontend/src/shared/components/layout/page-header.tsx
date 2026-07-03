import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@shared/utils/cn';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {item.to && !last ? (
              <Link to={item.to} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={cn(last && 'font-medium text-foreground')}>{item.label}</span>
            )}
            {!last && <ChevronRight className="size-3" />}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
