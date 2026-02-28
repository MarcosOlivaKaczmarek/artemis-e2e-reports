import { XMLParser } from "fast-xml-parser";

export interface TestCase {
  suiteName: string;
  testName: string;
  classname: string;
  status: "passed" | "failed" | "skipped" | "error";
  durationMs: number;
  failureMessage?: string;
  failureDetails?: string;
}

export interface JUnitResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
  testCases: TestCase[];
}

export function parseJUnitXml(xml: string): JUnitResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "testsuite" || name === "testcase",
  });

  const parsed = parser.parse(xml);

  const testCases: TestCase[] = [];
  let totalDurationMs = 0;

  const testsuites = parsed.testsuites?.testsuite || parsed.testsuite || [];
  const suiteArray = Array.isArray(testsuites) ? testsuites : [testsuites];

  for (const suite of suiteArray) {
    if (!suite) continue;

    const suiteName = suite["@_name"] || "Unknown Suite";
    const cases = suite.testcase || [];
    const caseArray = Array.isArray(cases) ? cases : [cases];

    for (const tc of caseArray) {
      if (!tc) continue;

      const durationSec = parseFloat(tc["@_time"] || "0");
      const durationMs = Math.round(durationSec * 1000);
      totalDurationMs += durationMs;

      let status: TestCase["status"] = "passed";
      let failureMessage: string | undefined;
      let failureDetails: string | undefined;

      if (tc.failure) {
        status = "failed";
        const failure = Array.isArray(tc.failure) ? tc.failure[0] : tc.failure;
        failureMessage = failure?.["@_message"] || "";
        failureDetails = typeof failure === "string" ? failure : failure?.["#text"] || "";
      } else if (tc.error) {
        status = "error";
        const error = Array.isArray(tc.error) ? tc.error[0] : tc.error;
        failureMessage = error?.["@_message"] || "";
        failureDetails = typeof error === "string" ? error : error?.["#text"] || "";
      } else if (tc.skipped !== undefined) {
        status = "skipped";
      }

      testCases.push({
        suiteName,
        testName: tc["@_name"] || "Unknown Test",
        classname: tc["@_classname"] || suiteName,
        status,
        durationMs,
        failureMessage,
        failureDetails,
      });
    }
  }

  const passed = testCases.filter((t) => t.status === "passed").length;
  const failed = testCases.filter((t) => t.status === "failed" || t.status === "error").length;
  const skipped = testCases.filter((t) => t.status === "skipped").length;

  return {
    totalTests: testCases.length,
    passedTests: passed,
    failedTests: failed,
    skippedTests: skipped,
    durationMs: totalDurationMs,
    testCases,
  };
}
