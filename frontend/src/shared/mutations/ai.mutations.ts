import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@shared/api/http';
import {
  aiService,
  type ChatInput,
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
