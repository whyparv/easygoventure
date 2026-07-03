import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { MarkupType, Package, PackageItem, ServiceLineType } from '@shared/types/ops-domain';

export interface CreatePackageInput {
  name: string;
  inquiryId?: string;
  destination?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  numberOfTravelers?: number;
  currency?: string;
  notes?: string;
}

export interface CreatePackageItemInput {
  type: ServiceLineType;
  description: string;
  quantity?: number;
  unitCost: number;
  markupType?: MarkupType;
  markupValue?: number;
  vendorRateId?: string;
}
export type UpdatePackageItemInput = Partial<CreatePackageItemInput>;

export const packagesService = {
  list: (params: ListParams) => http.get<Paginated<Package>>('/packages', params),
  get: (id: string) => http.get<Package>(`/packages/${id}`),
  create: (input: CreatePackageInput) => http.post<Package>('/packages', input),
  update: (id: string, input: Partial<CreatePackageInput>) =>
    http.patch<Package>(`/packages/${id}`, input),
  items: (id: string) => http.get<PackageItem[]>(`/packages/${id}/items`),
  addItem: (id: string, input: CreatePackageItemInput) =>
    http.post<PackageItem>(`/packages/${id}/items`, input),
  updateItem: (id: string, itemId: string, input: UpdatePackageItemInput) =>
    http.patch<PackageItem>(`/packages/${id}/items/${itemId}`, input),
  removeItem: (id: string, itemId: string) =>
    http.delete<{ id: string }>(`/packages/${id}/items/${itemId}`),
};
