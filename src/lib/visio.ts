const sanitizeId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function buildVisioPairRoom(
  roleA: "athlete" | "pro",
  idA: string,
  roleB: "athlete" | "pro",
  idB: string,
) {
  const pair = [
    `${roleA}-${sanitizeId(idA)}`,
    `${roleB}-${sanitizeId(idB)}`,
  ].sort();

  return `tuatha-${pair.join("-")}`;
}

export function buildVisioGroupRoom(groupId: string) {
  return `tuatha-group-${sanitizeId(groupId)}`;
}

export function openVisioRoom(room: string) {
  const url = `/visio?room=${encodeURIComponent(room)}`;

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return url;
}
