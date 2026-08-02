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

    it("skips the folded-away filters only by their empty value, not their fields", async () => {
        const win = chartPage();
        await settle();
        // the empty filter is folded away visually but still submits its
        // (empty) field, so the chart data view sees a stable parameter set
        const params = new URLSearchParams(lastRequest(win).url.split("?")[1]);
        assert.equal(params.get("select_box_dynamic_1"), "");
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

describe("direct editing", () => {
    it("reloads the chart as soon as a control changes", async () => {
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
});

describe("filter chips", () => {
    function chip(win) {
        return win.document.querySelector(".chart-filter-removable");
    }
    function addButton(win) {
        return win.document.querySelector(".chart-add-filter-btn");
    }
    function dropdown(win) {
        return win.document.querySelector(".chart-add-filter-dropdown");
    }

    it("folds an empty filter away behind the add button on load", async () => {
        const win = chartPage();
        await settle();

        assert.equal(chip(win).style.display, "none");
        const options = dropdown(win).querySelectorAll(".chart-add-filter-option");
        assert.equal(options.length, 1);
        assert.equal(options[0].textContent, "active");
    });

    it("adds a filter back with its first real choice and reloads the chart", async () => {
        const win = chartPage();
        await settle();
        win.requests.length = 0;

        addButton(win).click();
        assert.ok(dropdown(win).classList.contains("show"));
        assert.equal(addButton(win).getAttribute("aria-expanded"), "true");

        dropdown(win).querySelector(".chart-add-filter-option").click();
        await settle();

        assert.equal(chip(win).style.display, "");
        assert.equal(chip(win).querySelector("select").value, "True");
        assert.ok(!dropdown(win).classList.contains("show"));
        assert.ok(
            lastRequest(win).url.includes("select_box_dynamic_1=True"),
            lastRequest(win).url
        );
        // nothing left to add: the button folds away too
        assert.equal(addButton(win).closest(".chart-add-filter").style.display, "none");
    });

    it("removes a filter: clears its value, hides the chip and reloads", async () => {
        const win = chartPage();
        await settle();
        const select = chip(win).querySelector("select");
        chip(win).style.display = "";
        select.value = "True";
        win.requests.length = 0;

        chip(win).querySelector(".chart-filter-remove-btn").click();
        await settle();

        assert.equal(select.value, "");
        assert.equal(chip(win).style.display, "none");
        assert.equal(win.requests.length, 1);
        assert.ok(
            lastRequest(win).url.includes("select_box_dynamic_1=&"),
            lastRequest(win).url
        );
        assert.equal(dropdown(win).querySelectorAll(".chart-add-filter-option").length, 1);
    });

    it("does not reload when removing a filter that was already empty", async () => {
        const win = chartPage();
        await settle();
        chip(win).style.display = "";
        win.requests.length = 0;

        chip(win).querySelector(".chart-filter-remove-btn").click();
        await settle();

        assert.equal(win.requests.length, 0);
        assert.equal(chip(win).style.display, "none");
    });

    it("closes the dropdown on an outside click and on Escape", async () => {
        const win = chartPage();
        await settle();

        addButton(win).click();
        assert.ok(dropdown(win).classList.contains("show"));
        win.document.body.click();
        assert.ok(!dropdown(win).classList.contains("show"));
        assert.equal(addButton(win).getAttribute("aria-expanded"), "false");

        addButton(win).click();
        assert.ok(dropdown(win).classList.contains("show"));
        win.document.dispatchEvent(
            new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
        assert.ok(!dropdown(win).classList.contains("show"));
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
