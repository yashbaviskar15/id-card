/**
 * The exact data the identity card renders. It is a projection of the owner's
 * profile plus the primary public contact fields — never a sensitive value, and
 * nothing beyond the fields listed below.
 */
export interface CardData {
  slug: string;
  fullName: string;
  dob: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
}
