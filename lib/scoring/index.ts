const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));

export function calculateSeoScore(input: { index: number; keyword: number; technical: number; speed: number; content: number; internalLinks: number }) {
  return Math.round(clamp(input.index, 25) + clamp(input.keyword, 20) + clamp(input.technical, 20) + clamp(input.speed, 15) + clamp(input.content, 10) + clamp(input.internalLinks, 10));
}

export function calculateGeoScore(input: { botAccess: number; brandMention: number; domainCitation: number; referral: number; entityClarity: number; faq: number; schema: number }) {
  return Math.round(clamp(input.botAccess, 20) + clamp(input.brandMention, 20) + clamp(input.domainCitation, 20) + clamp(input.referral, 10) + clamp(input.entityClarity, 15) + clamp(input.faq, 10) + clamp(input.schema, 5));
}
