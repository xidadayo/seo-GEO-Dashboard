import { describe, expect, it } from "vitest";
import { calculateGeoScore, calculateSeoScore } from "./index";
describe("visibility scoring", () => {
  it("caps SEO score at 100", () => expect(calculateSeoScore({ index: 99, keyword: 99, technical: 99, speed: 99, content: 99, internalLinks: 99 })).toBe(100));
  it("calculates GEO weighted score", () => expect(calculateGeoScore({ botAccess: 20, brandMention: 10, domainCitation: 10, referral: 5, entityClarity: 10, faq: 5, schema: 5 })).toBe(65));
});
