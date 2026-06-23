export const schedules = {
  syncGscPerformance: "0 2 * * *",
  inspectCoreUrls: "0 3 * * *",
  syncGa4Traffic: "0 */3 * * *",
  syncGa4Realtime: "*/5 * * * *",
  runPageSpeedChecks: "0 4 * * *",
  crawlTechnicalSeo: "0 5 * * *",
  parseBotLogs: "*/15 * * * *",
  runGeoQueryTests: "0 6 * * *",
  generateWeeklyReport: "0 8 * * 1",
};
