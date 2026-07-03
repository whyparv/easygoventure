import { useState } from 'react';
import { FileText, Eye, FileCheck2 } from 'lucide-react';
import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Modal } from '@shared/components/ui/modal';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useProposalDocuments } from '@shared/queries/operations.queries';
import { useGenerateDocument } from '@shared/mutations/operations.mutations';
import { formatDateTime } from '@shared/lib/format';
import { titleCase } from '@shared/lib/format';
import { DocumentType } from '@shared/types/ops-domain';

export function DocumentsTab({ proposalId }: { proposalId: string }) {
  const { data: docs, isLoading } = useProposalDocuments(proposalId);
  const generate = useGenerateDocument();
  const [preview, setPreview] = useState<{ title: string; content: unknown } | null>(null);

  const run = (type: (typeof DocumentType)[number]) => {
    generate.mutate(
      { proposalId, type },
      { onSuccess: (res) => setPreview({ title: res.document.title, content: res.content }) },
    );
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Generate a document</p>
        <div className="flex flex-wrap gap-2">
          {DocumentType.map((t) => (
            <Button
              key={t}
              variant="secondary"
              size="sm"
              loading={generate.isPending && generate.variables?.type === t}
              onClick={() => run(t)}
            >
              <FileText /> {titleCase(t)}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Documents are assembled from the proposal snapshot, travelers and bookings. Only metadata is stored — the file is generated on demand.
        </p>
      </Card>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Generation history</p>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !docs || docs.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={FileCheck2} title="No documents yet" description="Generate a voucher, itinerary or manifest above." />
          </Card>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <Card key={d.id} className="flex items-center gap-3 p-3.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {titleCase(d.type)} · {formatDateTime(d.createdAt)}
                    {d.checksum ? ` · ${d.checksum.slice(0, 8)}` : ''}
                  </p>
                </div>
                <Badge tone="neutral">{d.format}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview?.title ?? 'Document'}
        description="Live preview — assembled from current proposal data."
        footer={
          <Button variant="secondary" onClick={() => window.print()}>
            <Eye /> Print / Save PDF
          </Button>
        }
      >
        <pre className="max-h-[52vh] overflow-auto rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
          {preview ? JSON.stringify(preview.content, null, 2) : ''}
        </pre>
      </Modal>
    </div>
  );
}
