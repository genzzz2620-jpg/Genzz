export function validateProductionEnvironment(
  env?: Record<string, string | undefined>,
  cwd?: string,
): { errors: string[]; warnings: string[] };
