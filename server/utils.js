export function nowIso() {
  return new Date().toISOString();
}

export function truncate(value, max = 120) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function messageToTaskTitle(body) {
  if (!body) return 'New task';
  const singleLine = body.replace(/\s+/g, ' ').trim();
  if (!singleLine) return 'New task';
  const [sentence] = singleLine.split(/[.!?]/);
  return truncate(sentence || singleLine, 80);
}

export function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
