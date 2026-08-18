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

describe("chart type icon", () => {
    function iconGroups(win) {
        var groups = {};
        win.document.querySelectorAll(".chart-type-icon g").forEach(function (g) {
            groups[g.getAttribute("data-icon")] = g.style.display;
        });
        return groups;
    }

    it("shows the selected type's icon on load", async () => {
        const win = chartPage();
        await settle();
        // the fixture's chart defaults to discreteBarChart
        // the stylesheet hides every group, so the visible one must carry an
        // explicit inline display - an empty string would fall back to hidden
        const groups = iconGroups(win);
        assert.equal(groups.bar, "inline");
        assert.equal(groups.line, "none");
        assert.equal(groups.area, "none");
        assert.equal(groups.pie, "none");
    });

    it("follows a chart type change", async () => {
        const win = chartPage();
        await settle();

        const select = win.document.querySelector(".select_box_chart_type");
        select.value = "stackedAreaChart";
        select.dispatchEvent(new win.Event("change", { bubbles: true }));
        await settle();

        const groups = iconGroups(win);
        assert.equal(groups.area, "inline");
        assert.equal(groups.bar, "none");
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

describe("searchable filter select", () => {
    function chipSelect(win) {
        return win.document.querySelector(".chart-filter-removable select");
    }
    function grow(win, count) {
        const select = chipSelect(win);
        for (let i = 0; i < count; i++) {
            const option = win.document.createElement("option");
            option.value = "org" + i;
            option.textContent = "Organization " + i;
            select.appendChild(option);
        }
        return select;
    }
    function mousedown(win, el) {
        el.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    }

    it("keeps the native select while the options stay navigable", async () => {
        const win = chartPage();
        await settle();
        mousedown(win, chipSelect(win));
        assert.equal(win.document.querySelector(".chart-select-search"), null);
    });

    it("swaps a long select for a searchable panel", async () => {
        const win = chartPage();
        await settle();
        const select = grow(win, 30);
        mousedown(win, select);

        const panel = win.document.querySelector(".chart-select-search");
        assert.ok(panel, "search panel must open");
        assert.ok(panel.querySelector("input[type=search]"));
        assert.equal(
            panel.querySelectorAll(".chart-select-search-option").length,
            select.options.length
        );
    });

    it("filters as you type and picking an option reloads the chart", async () => {
        const win = chartPage();
        await settle();
        const select = grow(win, 30);
        mousedown(win, select);
        win.requests.length = 0;

        const input = win.document.querySelector(".chart-select-search input");
        input.value = "Organization 12";
        input.dispatchEvent(new win.Event("input", { bubbles: true }));
        const options = win.document.querySelectorAll(".chart-select-search-option");
        assert.equal(options.length, 1);

        options[0].click();
        await settle();

        assert.equal(select.value, "org12");
        assert.equal(win.document.querySelector(".chart-select-search"), null);
        assert.ok(
            lastRequest(win).url.includes("select_box_dynamic_1=org12"),
            lastRequest(win).url
        );
    });

    it("closes on Escape without changing the value", async () => {
        const win = chartPage();
        await settle();
        const select = grow(win, 30);
        const before = select.value;
        mousedown(win, select);
        win.document.dispatchEvent(
            new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
        assert.equal(win.document.querySelector(".chart-select-search"), null);
        assert.equal(select.value, before);
    });
});

describe("chart html loading", () => {
    // what BlenderKit's "site is busy" page looks like to the fetch: a full
    // document carrying its own stylesheets
    const BUSY_PAGE =
        '<!DOCTYPE html><html><head><link rel="stylesheet" href="/static/homepage.css">' +
        "</head><body>Site is busy</body></html>";

    function targetElement(win) {
        const el = win.document.createElement("div");
        win.document.body.appendChild(el);
        return el;
    }

    it("injects a fragment and runs the callback", async () => {
        const win = chartPage();
        await settle();
        const el = targetElement(win);
        win.nextResponse = '<form class="stateform">fragment</form>';
        let called = false;
        win.loadHtml(el, "/chart/", () => { called = true; });
        await settle();

        assert.ok(called);
        assert.ok(el.innerHTML.includes("stateform"));
    });

    it("refuses an error page: its stylesheets must not enter the admin (HTTP 503)", async () => {
        const win = chartPage();
        await settle();
        const el = targetElement(win);
        win.nextStatus = 503;
        win.nextResponse = BUSY_PAGE;
        let called = false;
        let failed = false;
        win.loadHtml(el, "/chart/", () => { called = true; }, () => { failed = true; });
        await settle();

        assert.equal(called, false);
        assert.ok(failed, "the error callback must run");
        assert.equal(el.querySelector("link"), null, "no foreign stylesheet in the page");
        assert.ok(el.querySelector(".chart-load-error").textContent.includes("HTTP 503"));
    });

    it("refuses a full document even on HTTP 200 (login page after session expiry)", async () => {
        const win = chartPage();
        await settle();
        const el = targetElement(win);
        win.nextResponse = BUSY_PAGE;
        win.loadHtml(el, "/chart/", () => { throw new Error("must not run"); });
        await settle();

        assert.ok(el.querySelector(".chart-load-error"));
        assert.equal(el.querySelector("link"), null);
    });

    it("reports a network failure instead of staying silent", async () => {
        const win = chartPage();
        await settle();
        const el = targetElement(win);
        win.fetch = () => Promise.reject(new Error("connection lost"));
        win.loadHtml(el, "/chart/", () => { throw new Error("must not run"); });
        await settle();

        assert.ok(el.querySelector(".chart-load-error").textContent.includes("connection lost"));
    });

    it("clears the page loading state when an analytics chart fails to load", async () => {
        const win = chartPage();
        await settle();
        const chartEl = win.document.createElement("div");
        chartEl.id = "chart_element_g2";
        chartEl.className = "admin_charts notloaded";
        win.document.body.appendChild(chartEl);
        win.nextStatus = 503;
        win.nextResponse = BUSY_PAGE;

        win.loadAnalyticsChart("g2");
        await settle();

        assert.ok(!win.document.body.classList.contains("loading"),
            "a failed load must not leave the page frozen behind pointer-events:none");
        assert.ok(chartEl.querySelector(".chart-load-error"));
        assert.ok(chartEl.classList.contains("notloaded"), "kept for retry on next show");
    });
});

describe("lazy chart loading", () => {
    function chartElement(win, key) {
        const el = win.document.createElement("div");
        el.id = "chart_element_" + key;
        el.className = "admin_charts admin_charts_dynamic notloaded";
        el.dataset.chartKey = key;
        win.document.body.appendChild(el);
        return el;
    }

    it("loads a chart only once it scrolls near the viewport", async () => {
        const win = chartPage();
        await settle();
        const el = chartElement(win, "g2");
        win.requests.length = 0;

        const observed = [];
        let intersect = null;
        const unobserved = [];
        win.IntersectionObserver = class {
            constructor(callback) { intersect = callback; }
            observe(target) { observed.push(target); }
            unobserve(target) { unobserved.push(target); }
        };

        win.lazyLoadAdminCharts();
        await settle();
        assert.deepEqual(observed, [el]);
        assert.equal(win.requests.length, 0, "off-screen charts must not load");

        intersect([{ target: el, isIntersecting: false }]);
        await settle();
        assert.equal(win.requests.length, 0, "not intersecting yet");

        intersect([{ target: el, isIntersecting: true }]);
        await settle();
        assert.equal(win.requests.length, 1);
        assert.ok(win.requests[0].url.startsWith(URLS.analyticsChart + "g2"), win.requests[0].url);
        assert.deepEqual(unobserved, [el], "a loaded chart must not load twice");
    });

    it("falls back to loading everything when IntersectionObserver is missing", async () => {
        const win = chartPage();
        await settle();
        chartElement(win, "g3");
        win.requests.length = 0;
        assert.equal(win.IntersectionObserver, undefined);

        win.lazyLoadAdminCharts();
        await settle();

        assert.equal(win.requests.length, 1);
        assert.ok(win.requests[0].url.startsWith(URLS.analyticsChart + "g3"), win.requests[0].url);
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
