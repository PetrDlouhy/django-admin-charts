// Behaviour of the chart javascript, exercised against the markup the chart
// container template really renders (js_tests/fixtures/chart_form.html, kept in
// step with Django by AdminChartsFixtureTests).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chartPage, form, lastRequest, loadChartSource, settle, URLS } from "./helpers.mjs";

const CHART_SCRIPT =
    "function loadChartScript(){ window.chartRuns = (window.chartRuns || 0) + 1; }; loadChartScript();";

describe("no jQuery", () => {
    it("does not use jQuery", () => {
        const source = loadChartSource();
        for (const construct of ["jQuery", "$(", "$.ajax", ".serialize()", ".addClass("]) {
            assert.ok(!source.includes(construct), `${construct} is still used`);
        }
    });

    it("runs without jQuery defined", async () => {
        const win = chartPage();
        await settle();
        assert.equal(win.jQuery, undefined);
        assert.equal(win.requests.length, 1);
    });
});

describe("form serialization", () => {
    it("sends the fields the chart data view needs", async () => {
        const win = chartPage();
        await settle();

        const params = new URLSearchParams(lastRequest(win).url.split("?")[1]);
        assert.equal(params.get("graph_key"), "g1");
        assert.ok(params.has("csrfmiddlewaretoken"));
        assert.ok(params.has("time_since"));
        assert.ok(params.has("time_until"));
        assert.ok(params.has("select_box_interval"));
    });

    it("skips the load-on-change checkbox, which carries no name", async () => {
        const win = chartPage();
        await settle();
        assert.ok(!lastRequest(win).url.includes("load_on_change"));
    });
});

describe("initial load", () => {
    it("requests the chart data for every visible form once the page is ready", async () => {
        const win = chartPage();
        await settle();

        assert.equal(win.requests.length, 1);
        const { url, options } = lastRequest(win);
        assert.ok(url.startsWith(`${URLS.chartData}g1/?`), url);
        assert.ok(url.includes("time_since="), url);
        assert.equal(options.credentials, "same-origin");
    });

    it("clears the loading state when the chart arrives", async () => {
        const win = chartPage({ response: CHART_SCRIPT });
        await settle();
        assert.ok(!form(win).classList.contains("loading"));
    });
});

describe("reload buttons", () => {
    it("asks for fresh values of unfinished periods", async () => {
        const win = chartPage();
        await settle();
        win.requests.length = 0;

        win.document.getElementById("reload").click();
        await settle();

        assert.ok(lastRequest(win).url.includes("&reload=true"), lastRequest(win).url);
    });

    it("asks for all values to be recalculated", async () => {
        const win = chartPage();
        await settle();
        win.requests.length = 0;

        win.document.getElementById("reload_all").click();
        await settle();

        assert.ok(lastRequest(win).url.includes("&reload_all=true"), lastRequest(win).url);
    });
});

describe("load on change", () => {
    it("reloads the chart when a control changes and the checkbox is ticked", async () => {
        const win = chartPage();
        await settle();
        win.requests.length = 0;

        const input = win.document.querySelector('[name="time_since"]');
        input.value = "2021-01-01";
        input.dispatchEvent(new win.Event("change", { bubbles: true }));
        await settle();

        assert.equal(win.requests.length, 1);
        assert.ok(lastRequest(win).url.includes("time_since=2021-01-01"), lastRequest(win).url);
    });

    it("does nothing when the checkbox is unticked", async () => {
        const win = chartPage();
        await settle();
        win.document.getElementById("load_on_change").checked = false;
        win.requests.length = 0;

        const input = win.document.querySelector('[name="time_since"]');
        input.value = "2022-02-02";
        input.dispatchEvent(new win.Event("change", { bubbles: true }));
        await settle();

        assert.equal(win.requests.length, 0);
    });
});

describe("chart script handling", () => {
    it("runs the returned script in global scope", async () => {
        const win = chartPage({ response: CHART_SCRIPT });
        await settle();
        assert.equal(win.chartRuns, 1);
    });

    it("replays a cached chart instead of requesting it again", async () => {
        const win = chartPage({ response: CHART_SCRIPT });
        await settle();
        const input = win.document.querySelector('[name="time_since"]');
        const original = input.value;

        // away and back again: the second change repeats the first request's
        // parameters, which must come from the cache
        input.value = "2021-01-01";
        input.dispatchEvent(new win.Event("change", { bubbles: true }));
        await settle();
        win.requests.length = 0;
        const runsBefore = win.chartRuns;

        input.value = original;
        input.dispatchEvent(new win.Event("change", { bubbles: true }));
        await settle();

        assert.equal(win.requests.length, 0, "identical parameters must not be refetched");
        assert.equal(win.chartRuns, runsBefore + 1, "the cached script must run again");
    });

    it("refetches when a reload is asked for, cached or not", async () => {
        const win = chartPage({ response: CHART_SCRIPT });
        await settle();
        win.requests.length = 0;

        win.document.getElementById("reload").click();
        await settle();

        assert.equal(win.requests.length, 1);
    });

    it("does not cache the previous chart under failing parameters", async () => {
        const win = chartPage({ response: CHART_SCRIPT });
        await settle();
        assert.equal(Object.keys(win.chart_scripts).length, 1);

        // a chart whose data view fails answers with an alert and defines no
        // loadChartScript; caching the previous one here would replay the wrong
        // chart on the next identical request
        const input = win.document.querySelector('[name="time_since"]');
        input.value = "2020-01-01";
        win.nextResponse = "alert('Chart error: boom');";
        input.dispatchEvent(new win.Event("change", { bubbles: true }));
        await settle();

        assert.deepEqual(win.alerts, ["Chart error: boom"]);
        assert.equal(Object.keys(win.chart_scripts).length, 1);
    });

    it("reports a failing request and stops the spinner", async () => {
        const win = chartPage();
        win.nextStatus = 500;
        await settle();

        assert.deepEqual(win.alerts, ["Error during chart loading."]);
        assert.ok(!form(win).classList.contains("loading"));
    });
});

describe("csv download", () => {
    it("is delegated to the link's own form", async () => {
        const win = chartPage();
        await settle();

        let received = null;
        win.downloadCSV = (event, link) => {
            event.preventDefault();
            received = {
                graphKey: link.dataset.graphKey,
                params: win.serializeForm(link.closest("form.stateform")),
            };
        };
        const event = new win.MouseEvent("click", { bubbles: true, cancelable: true });
        win.document.querySelector(".download-csv").dispatchEvent(event);
        await settle();

        assert.equal(received.graphKey, "g1");
        assert.ok(received.params.includes("time_since="));
        assert.ok(event.defaultPrevented);
    });
});

describe("analytics link", () => {
    it("carries the current chart settings", async () => {
        const win = chartPage();
        await settle();

        const href = win.document.querySelector('a[href*="analytics"]').getAttribute("href");
        const params = new URLSearchParams(href.split("?")[1]);
        assert.equal(params.get("show"), "g1");
        assert.ok(params.has("g1_time_since"));
        assert.ok(!params.has("g1_csrfmiddlewaretoken"), "the csrf token must not leak into a link");
    });
});
