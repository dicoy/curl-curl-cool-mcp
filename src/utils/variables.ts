export function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(
    /\{\{([^}]+)\}\}/g,
    (match, key: string) => variables[key.trim()] ?? match,
  );
}
