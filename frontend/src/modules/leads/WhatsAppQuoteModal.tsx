import { useState } from 'react';
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@shared/components/ui/modal';
import { Button } from '@shared/components/ui/button';
import { buildWhatsAppQuote, whatsappDeepLink } from '@shared/lib/whatsapp';
import { leadsService } from '@shared/services/leads.service';
import { queryKeys } from '@shared/api/query-keys';
import type { Lead } from '@shared/types/domain';

/**
 * Preview + share the WhatsApp quote for a lead.
 *
 * Shows the saved `lead.whatsappMessage` if it exists (written on lead creation
 * or after the last Recreate). The Recreate button recomputes from current lead
 * data and saves back to the lead document.
 */
export function WhatsAppQuoteModal({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}) {
  const queryClient = useQueryClient();

  // Active message: starts from saved, overwritten when recreated
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const message = activeMessage ?? lead.whatsappMessage ?? buildWhatsAppQuote(lead);

  const [copied, setCopied] = useState(false);

  const saveActivity = useMutation({
    mutationFn: (msg: string) =>
      leadsService.addActivity(lead.id, {
        type: 'WHATSAPP_MESSAGE',
        description: 'WhatsApp quote generated',
        metadata: { message: msg },
      }),
  });

  const saveMessage = useMutation({
    mutationFn: (msg: string) => leadsService.update(lead.id, { whatsappMessage: msg }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(lead.id) });
    },
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      saveActivity.mutate(message);
    } catch {
      setCopied(false);
    }
  };

  const recreate = () => {
    const fresh = buildWhatsAppQuote(lead);
    setActiveMessage(fresh);
    saveMessage.mutate(fresh);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        // Reset local override when modal closes
        if (!v) setActiveMessage(null);
        onOpenChange(v);
      }}
      title="WhatsApp Message"
      description="Copy this into WhatsApp, or open a chat pre-filled with it."
      className="max-w-md"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={recreate}
            disabled={saveMessage.isPending}
            title="Recompute from current lead data and save"
          >
            <RefreshCw className={`size-4 ${saveMessage.isPending ? 'animate-spin' : ''}`} />
            Recreate
          </Button>
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button asChild>
            <a
              href={whatsappDeepLink(lead.phone, message)}
              target="_blank"
              rel="noreferrer"
              onClick={() => saveActivity.mutate(message)}
            >
              <ExternalLink className="size-4" /> Open in WhatsApp
            </a>
          </Button>
        </>
      }
    >
      <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-4 font-sans text-sm leading-relaxed text-foreground">
        {message}
      </pre>
    </Modal>
  );
}
