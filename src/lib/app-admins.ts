export const APP_ADMIN_EMAILS = [
  "fanharrison4@gmail.com",
  "fanhaipeng@gmail.com",
] as const;

export function isAppAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return APP_ADMIN_EMAILS.includes(email.toLowerCase() as (typeof APP_ADMIN_EMAILS)[number]);
}
