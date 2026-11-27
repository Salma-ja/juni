/** User-facing copy for API error codes (handoff §9.3). */
const copy: Record<string, string> = {
  NOT_VERIFIED: 'Verify your student account to book.',
  PREF_MISMATCH: "This group's rule doesn't match your profile. Choose another group.",
  ALREADY_BOOKED: 'You already have a seat in this group.',
  GROUP_NOT_OPEN: 'This group is no longer taking bookings.',
  GROUP_FULL: 'That seat was just booked. You were not charged.',
  QUOTE_STALE: 'This group changed. Review the updated details.',
  TOO_SOON: 'Pickup is less than 60 minutes away. Choose a later class time.',
  FARE_OVER_CAP: "This group can't fit another fare under its cap.",
  HOLD_EXPIRED: 'Your 5-minute hold ended. The seat was released.',
  CANCEL_NOT_ALLOWED: 'The trip has started. Use Safety for help.',
  CAPTAIN_INELIGIBLE: 'Captain failed licence or vehicle checks. The group stays pending.',
  CAPTAIN_BUSY: 'Captain is unavailable at that time.',
  NO_GROUPS_AT_TIME: 'No groups arrive near that class time yet.',
  NO_SEATS: 'Groups at that time are full.',
  PREF_NONE: 'No groups match that preference at this time.',
  ROUTE_INFEASIBLE: 'No group can add your pickup without delaying others.',
  BOOKING_OVERLAP: 'You already have a ride around that time.',
  DEMO_ONLY: 'Demo controls are only available in demo mode.',
};

export const errorCopy = (code: string) => copy[code] ?? 'Something went wrong. Try again.';
