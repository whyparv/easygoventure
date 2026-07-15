import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@shared/api/http';
import {
  aiService,
  type ChatInput,
  type GenerateQuoteInput,
  type LeadChatInput,
  type LeadIntakeChatInput,
  type FollowupSuggestionInput,
  type NextActionInput,
  type ProposalDraftInput,
  type ProposalSummaryInput,
} from '@shared/services/ai.service';

const onError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : 'AI request failed');

export function useParseInquiry() {
  return useMutation({ mutationFn: (text: string) => aiService.parseInquiry(text), onError });
}

export function useFollowupSuggestion() {
  return useMutation({
    mutationFn: (input: FollowupSuggestionInput) => aiService.followupSuggestion(input),
    onError,
  });
}

export function useProposalSummary() {
  return useMutation({
    mutationFn: (input: ProposalSummaryInput) => aiService.proposalSummary(input),
    onError,
  });
}

export function useAiChat() {
  return useMutation({ mutationFn: (input: ChatInput) => aiService.chat(input), onError });
}

export function useAiNextAction() {
  return useMutation({ mutationFn: (input: NextActionInput) => aiService.nextAction(input), onError });
}

export function useProposalDraft() {
  return useMutation({ mutationFn: (input: ProposalDraftInput) => aiService.proposalDraft(input), onError });
}

export function useLeadChat() {
  return useMutation({ mutationFn: (input: LeadChatInput) => aiService.leadChat(input), onError });
}

export function useLeadIntakeChat() {
  return useMutation({
    mutationFn: (input: LeadIntakeChatInput) => aiService.leadIntakeChat(input),
    onError,
  });
}

export function useGenerateQuote() {
  return useMutation({
    mutationFn: (input: GenerateQuoteInput) => aiService.generateQuote(input),
    onError,
  });
}
