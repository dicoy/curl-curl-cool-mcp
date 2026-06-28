import { InvalidJsonError } from "../../errors/index.js";

export function inferTypes(jsonStr: string, rootName: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new InvalidJsonError(err instanceof Error ? err.message : String(err));
  }

  const emitter = new TypeEmitter();
  emitter.emit(parsed, rootName);
  return emitter.render();
}

class TypeEmitter {
  // Insertion-order map: last definition of a name wins (handles repeated keys)
  private interfaces = new Map<string, string[]>();

  emit(value: unknown, name: string): string {
    if (value === null) return "null";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return "number";
    if (typeof value === "string") return "string";

    if (Array.isArray(value)) {
      if (value.length === 0) return "unknown[]";
      return `${this.emit(value[0], singularize(name))}[]`;
    }

    if (typeof value === "object") {
      const typeName = capitalize(name);
      const props = Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        const nullable = v === null;
        const propType = nullable ? "string | null" : this.emit(v, k);
        return `  ${k}${nullable ? "?" : ""}: ${propType};`;
      });
      this.interfaces.set(typeName, props);
      return typeName;
    }

    return "unknown";
  }

  render(): string {
    return [...this.interfaces.entries()]
      .map(([name, props]) =>
        props.length === 0 ? `interface ${name} {}` : `interface ${name} {\n${props.join("\n")}\n}`,
      )
      .join("\n\n");
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function singularize(s: string): string {
  if (s.endsWith("ies")) return `${s.slice(0, -3)}y`;
  if (s.endsWith("ses") || s.endsWith("xes") || s.endsWith("zes")) return s.slice(0, -2);
  if (s.endsWith("s") && s.length > 2) return s.slice(0, -1);
  return s;
}
