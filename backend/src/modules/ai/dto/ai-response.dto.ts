import { ApiProperty } from '@nestjs/swagger';

export class ParsedInquiryResponseDto {
  @ApiProperty({ nullable: true, example: 'Dubai' })
  destination!: string | null;

  @ApiProperty({ nullable: true, example: 'Visa' })
  service!: string | null;

  @ApiProperty({ nullable: true, example: 2 })
  travelers!: number | null;

  @ApiProperty({ nullable: true, example: '2026-07-15' })
  travelDate!: string | null;
}

export class FollowupSuggestionResponseDto {
  @ApiProperty({ example: 'Hi, just following up on the Dubai package we shared…' })
  message!: string;
}

export class ProposalSummaryResponseDto {
  @ApiProperty({ example: 'A 4-night Dubai getaway for two including hotel, transfers and visa.' })
  summary!: string;
}

export class ChatResponseDto {
  @ApiProperty({
    example:
      'For a 5-day Dubai package for two, I’d include the tourist visa, a 4-star hotel with breakfast, airport transfers, a desert safari and a city tour…',
  })
  reply!: string;
}

export class NextActionResponseDto {
  @ApiProperty({
    example: 'The proposal expires in 5 days with no reply — schedule a follow-up to confirm.',
    description: 'Why this action is recommended.',
  })
  summary!: string;

  @ApiProperty({
    description:
      'A ready-to-apply action the agent can confirm. `type` is one of create_followup, ' +
      'add_note, update_status, create_proposal, none; other keys depend on the type.',
    example: {
      type: 'create_followup',
      scheduledDate: '2026-07-05',
      remarks: 'Confirm travel dates and request passport copies.',
      nextAction: 'Send visa application once documents received.',
    },
  })
  action!: Record<string, unknown>;
}
