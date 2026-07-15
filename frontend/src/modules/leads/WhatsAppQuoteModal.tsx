import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '@shared/components/ui/modal';
import { Button } from '@shared/components/ui/button';
import { buildWhatsAppQuote, whatsappDeepLink } from '@shared/lib/whatsapp';
import { leadsService } from '@shared/services/leads.service';
import type { Lead } from '@shared/types/domain';

/**
 * Preview + share the generated WhatsApp quote for a lead. Saves the generated
 * message as a WHATSAPP_MESSAGE activity when the user copies or opens it.
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
  const [copied, setCopied] = useState(false);
  const message = buildWhatsAppQuote(lead);

  const saveActivity = useMutation({
    mutationFn: () =>
      leadsService.addActivity(lead.id, {
        type: 'WHATSAPP_MESSAGE',
        description: 'WhatsApp quote generated',
        metadata: { message },
      }),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      saveActivity.mutate();
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="WhatsApp Message"
      description="Copy this into WhatsApp, or open a chat pre-filled with it."
      className="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button asChild>
            <a
              href={whatsappDeepLink(lead.phone, message)}
              target="_blank"
              rel="noreferrer"
              onClick={() => saveActivity.mutate()}
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
