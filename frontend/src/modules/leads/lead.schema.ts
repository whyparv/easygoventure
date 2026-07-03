import { z } from 'zod';
import { InquiryType, LeadSource } from '@shared/types/domain';

export const createLeadSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(5, 'Phone is required'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  companyName: z.string().optional(),
  source: z.enum(LeadSource),
  inquiryType: z.enum(InquiryType),
  notes: z.string().optional(),
  rawInquiry: z.string().optional(),
});

export type CreateLeadFormValues = z.infer<typeof createLeadSchema>;

export const STEP_FIELDS: (keyof CreateLeadFormValues)[][] = [
  ['name', 'phone', 'email', 'companyName'],
  ['source', 'inquiryType', 'rawInquiry', 'notes'],
  [],
];
