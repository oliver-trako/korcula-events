const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXmlEntities(text) {
  return String(text ?? "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const codePoint = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    const key = code.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : match;
  });
}

export function stripCdata(text) {
  const match = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(String(text ?? "").trim());
  return match ? match[1] : text;
}

export function extractTagText(block, tagName) {
  const match = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(block);
  if (!match) return null;
  return decodeXmlEntities(stripCdata(match[1]).trim()) || null;
}

export function extractTagAttribute(block, tagName, attributeName) {
  const match = new RegExp(`<${tagName}\\s+[^>]*\\b${attributeName}=["']([^"']*)["']`, "i").exec(block);
  return match ? decodeXmlEntities(match[1]) : null;
}
