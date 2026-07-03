/**
 * The bookable service lines a DMC prices and packages. Shared across the
 * commercial domain (VendorRate.rateType, PackageItem.type) so the taxonomy is
 * defined once.
 */
export enum ServiceLineType {
  HOTEL = 'HOTEL',
  ACTIVITY = 'ACTIVITY',
  TRANSFER = 'TRANSFER',
  VISA = 'VISA',
  FLIGHT = 'FLIGHT',
  CUSTOM = 'CUSTOM',
}
