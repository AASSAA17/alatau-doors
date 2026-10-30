export const accountSecurityRequired = process.env.APP_MODE === 'production' || process.env.AUTH_SECURITY === 'required';
export const staffRole = (role: string) => role === 'ADMIN' || role === 'SELLER';
