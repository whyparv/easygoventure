import { Construction } from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Card } from '@shared/components/ui/card';

export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={`The ${title} module is on the roadmap.`} />
      <Card>
        <EmptyState
          icon={Construction}
          title={`${title} is coming soon`}
          description="This module isn't part of the current backend yet. It will light up here once the API is available — no placeholder data is shown."
        />
      </Card>
    </div>
  );
}
