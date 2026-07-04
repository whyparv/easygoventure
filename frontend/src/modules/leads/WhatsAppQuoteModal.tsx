import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Modal } from '@shared/components/ui/modal';
import { Button } from '@shared/components/ui/button';
import { buildWhatsAppQuote, whatsappDeepLink } from '@shared/lib/whatsapp';
import type { Lead } from '@shared/types/domain';

/**
 * Preview + share the generated WhatsApp quote for a lead. The message is built
 * purely from the lead record (travel info, services, hotel options, validity,
 * preparedBy) — no AI round-trip required for the manual workflow.
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
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
            <a href={whatsappDeepLink(lead.phone, message)} target="_blank" rel="noreferrer">
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
