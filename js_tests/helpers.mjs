// Test harness for admin_charts.js.
//
// The chart javascript is a Django template, so it is loaded here with the
// handful of {% url %} tags it contains substituted for fixed test URLs. The
// substitution is strict: an unhandled template tag fails the run rather than
// reaching the parser as syntax noise.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

const here = path.dirname(fileURLToPath(import.meta.url));

export const URLS = {
    chartData: "/admin_tools_stats/chart_data/",
    analyticsChart: "/admin_tools_stats/analytics/chart/",
    chartCsv: "/admin_tools_stats/chart_csv/PLACEHOLDER/",
};

export function loadChartSource() {
    const template = path.join(
        here, "..", "admin_tools_stats", "templates", "admin_tools_stats", "admin_charts.js"
    );
    const source = fs
        .readFileSync(template, "utf8")
        .replaceAll(/\{%\s*url ['"]chart-data['"]\s*%\}/g, URLS.chartData)
        .replaceAll(/\{%\s*url ['"]chart-analytics-without-key['"]\s*%\}/g, URLS.analyticsChart)
        .replaceAll(/\{%\s*url ['"]chart-csv['"] ['"]PLACEHOLDER['"]\s*%\}/g, URLS.chartCsv);

    assert.ok(
        !source.includes("{%"),
        "unhandled Django template tag in admin_charts.js: " +
            (source.match(/\{%[^%]*%\}/) || [""])[0]
    );
    return source;
}

export function loadFixture(name) {
    return fs.readFileSync(path.join(here, "fixtures", name), "utf8");
}

/**
 * A page with the chart markup, the chart javascript evaluated in it, and the
 * browser pieces the javascript talks to replaced by recording stubs.
 */
export function chartPage({ body = loadFixture("chart_form.html"), response = "" } = {}) {
    const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
        url: "https://example.com/admin_tools_stats/analytics/",
        runScripts: "dangerously",
    });
    const win = dom.window;

    // d3/nvd3 stand-ins: the chart code only ever clears tooltips and handlers
    const selection = { remove() {}, on() {}, selectAll() { return selection; } };
    win.d3 = { selectAll: () => selection, select: () => selection };
    win.nv = { graphs: [] };

    win.alerts = [];
    win.alert = (message) => win.alerts.push(message);

    win.requests = [];
    win.nextResponse = response;
    // set win.holdFetch = true to keep requests pending; each entry in
    // win.pendingFetches then carries a resolve() to answer it manually
    win.pendingFetches = [];
    win.fetch = (url, options) => {
        const request = { url, options };
        win.requests.push(request);
        return new Promise((resolve, reject) => {
            const answer = () => resolve({
                ok: win.nextStatus === undefined || win.nextStatus < 400,
                status: win.nextStatus || 200,
                text: () => Promise.resolve(win.nextResponse),
            });
            const signal = options && options.signal;
            if (signal) {
                signal.addEventListener("abort", () => {
                    const error = new Error("aborted");
                    error.name = "AbortError";
                    reject(error);
                });
            }
            if (win.holdFetch) {
                win.pendingFetches.push({ request, resolve: answer });
            } else {
                answer();
            }
        });
    };

    // jsdom does no layout, so every element reports zero size; treat anything
    // not explicitly display:none as visible
    Object.defineProperty(win.HTMLElement.prototype, "getClientRects", {
        configurable: true,
        value() {
            return this.style.display === "none" ? [] : [{ width: 1, height: 1 }];
        },
    });

    win.eval(loadChartSource());
    return win;
}

/** Let the fetch promise chain settle. */
export function settle() {
    return new Promise((resolve) => setTimeout(resolve, 10));
}

export function form(win) {
    return win.document.querySelector("form.stateform");
}

export function lastRequest(win) {
    return win.requests[win.requests.length - 1] || {};
}
