
var html_string = '<svg style="width:100%;height:400px"></svg>';
var html_string_analytics = '<svg style="width:100%;height:100%"></svg>';
var chart_scripts = {};

function isVisible(element) {
   return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function visibleForms(root) {
   return Array.prototype.filter.call(root.querySelectorAll('form.stateform'), isVisible);
}

function serializeForm(form) {
   return new URLSearchParams(new FormData(form)).toString();
}

function runScript(source) {
   // the chart data view answers with javascript that defines loadChartScript()
   // and calls it; appending a <script> runs it in global scope
   const script = document.createElement('script');
   script.text = source;
   document.head.appendChild(script);
   document.head.removeChild(script);
}

function cleanupChart(graph_key) {
   d3.selectAll('.nvtooltip').remove();

   const containerId = 'chart_container_' + graph_key;
   const container = document.getElementById(containerId);
   if (container) {
      const svg = container.querySelector('svg');
      if (svg) {
         d3.select(svg).on('.zoom', null);
         d3.select(svg).selectAll('*').on('.nv', null);
      }
   }

   if (window.nv && window.nv.graphs) {
      window.nv.graphs = window.nv.graphs.filter(function(g) {
         if (!g || !g.generate) {
            return true;
         }
         const chart = typeof g.generate === 'function' ? g.generate() : g.generate;
         if (!chart || !chart.container) {
            return true;
         }
         const chartContainer = typeof chart.container === 'function' ? chart.container() : chart.container;
         return chartContainer !== container;
      });
   }
}

function getChartParamsFromUrl(graph_key) {
   const urlParams = new URLSearchParams(window.location.search);
   const params = {};
   const prefix = graph_key + '_';

   for (const [key, value] of urlParams.entries()) {
      if (key.startsWith(prefix)) {
         const paramName = key.substring(prefix.length);
         if (paramName.startsWith('select_box_') || paramName.startsWith('time_')) {
            params[paramName] = value;
         }
      }
   }

   return params;
}

function buildChartUrlParams(formData, graph_key) {
   const formParams = new URLSearchParams(formData);
   const urlParams = new URLSearchParams();
   urlParams.set('show', graph_key);

   for (const [key, value] of formParams.entries()) {
      if (key !== 'csrfmiddlewaretoken' && key !== 'graph_key' &&
          (key.startsWith('select_box_') || key.startsWith('time_'))) {
         urlParams.set(graph_key + '_' + key, value);
      }
   }

   return urlParams;
}

function updateUrlWithChartParams(graph_key, formData) {
   const urlParams = new URLSearchParams(window.location.search);
   const prefix = graph_key + '_';

   const keysToDelete = [];
   for (const [key, value] of urlParams.entries()) {
      if (key.startsWith(prefix)) {
         keysToDelete.push(key);
      }
   }
   keysToDelete.forEach(key => urlParams.delete(key));

   const chartParams = buildChartUrlParams(formData, graph_key);
   chartParams.forEach((value, key) => {
      if (key !== 'show') {
         urlParams.set(key, value);
      }
   });

   const newUrl = window.location.pathname + '?' + urlParams.toString();
   window.history.replaceState({}, '', newUrl);
}

function populateFormFromUrl(form, graph_key) {
   if (!form) {
      return;
   }
   const params = getChartParamsFromUrl(graph_key);

   for (const [key, value] of Object.entries(params)) {
      const input = form.querySelector('[name="' + key + '"]');
      if (input) {
         input.value = value;
      }
   }
}

function updateAnalyticsLink(form, graph_key) {
   if (!form) {
      return;
   }
   const analyticsLink = form.querySelector('a[href*="analytics"]');

   if (analyticsLink) {
      const urlParams = buildChartUrlParams(serializeForm(form), graph_key);
      const baseUrl = analyticsLink.getAttribute('href').split('?')[0];
      analyticsLink.setAttribute('href', baseUrl + '?' + urlParams.toString());
   }
}

function loadChart(form, graph_key, reload, is_analytics){
   const data_str = serializeForm(form);

   if(is_analytics) {
      updateUrlWithChartParams(graph_key, data_str);
   }

   if(!reload && data_str in chart_scripts){
      form.classList.remove("loading");
      console.log("run " + data_str);
      chart_scripts[data_str]();
      return;
   }

   const url = "{% url 'chart-data' %}" + graph_key + "/";
   const reload_str = reload ? "&" + reload + "=true" : "";

   fetch(url + "?" + data_str + reload_str, {credentials: "same-origin"})
      .then(function(response) {
         if (!response.ok) {
            throw new Error("HTTP " + response.status);
         }
         return response.text();
      })
      .then(function(source) {
         // an errored chart answers with an alert() and defines no
         // loadChartScript; caching the previous chart's one would replay it
         window.loadChartScript = undefined;
         runScript(source);
         form.classList.remove("loading");
         console.log("call " + data_str);
         if (typeof window.loadChartScript === 'function') {
            chart_scripts[data_str] = window.loadChartScript;
         }
      })
      .catch(function() {
         alert("Error during chart loading.");
         form.classList.remove("loading");
      });
}

function loadHtml(element, url, callback) {
   fetch(url, {credentials: "same-origin"})
      .then(function(response) {
         return response.text();
      })
      .then(function(html) {
         element.innerHTML = html;
         callback();
      });
}

function defer(method) {
    if (window.d3 && window.nv) {
        method();
    } else {
        setTimeout(function() { defer(method) }, 50);
    }
}

function loadAnchor(element){
   const reload = (element.id === 'reload' || element.id === 'reload_all') ? element.id : false;
   const form = element.matches('form.stateform') ? element : element.closest('form.stateform');
   if (!form) {
      return;
   }
   form.classList.add("loading");
   const graph_key_input = form.querySelector(".hidden_graph_key");
   const graph_key = graph_key_input ? graph_key_input.value : null;
   const is_analytics = !!form.closest('.chrt_flex');

   cleanupChart(graph_key);
   const container = document.getElementById("chart_container_" + graph_key);
   if (container) {
      container.innerHTML = is_analytics ? html_string_analytics : html_string;
   }

   updateAnalyticsLink(form, graph_key);
   loadChart(form, graph_key, reload, is_analytics);
}

function loadChartForms(chartElement, chart_key){
   visibleForms(chartElement).forEach(function(form) {
      populateFormFromUrl(form, chart_key);
      updateAnalyticsLink(form, chart_key);
      loadAnchor(form);
   });
}

function loadAnalyticsChart(chart_key){
   const chartElement = document.getElementById("chart_element_" + chart_key);
   if (!chartElement) {
      return;
   }

   document.querySelectorAll('.admin_charts').forEach(function(element) {
      element.style.display = 'none';
   });

   if(chartElement.classList.contains("notloaded")) {
      document.body.classList.add("loading");
      const url = "{% url "chart-analytics-without-key" %}" + chart_key + "?analytics_chart=true";
      loadHtml(chartElement, url, function(){
         chartElement.classList.remove('notloaded');
         chartElement.classList.add('loaded');
         chartElement.style.display = '';

         loadChartForms(chartElement, chart_key);
         document.body.classList.remove("loading");
      });
   } else {
      loadChartForms(chartElement, chart_key);
   }

   chartElement.style.display = '';
}

function loadAdminChart(chart_key){
   const chartElement = document.getElementById("chart_element_" + chart_key);
   if (!chartElement) {
      return;
   }

   if (chartElement.classList.contains("notloaded")) {
      const url = "{% url "chart-analytics-without-key" %}" + chart_key;
      loadHtml(chartElement, url, function(){
         chartElement.classList.remove('notloaded');
         chartElement.classList.add('loaded');

         loadChartForms(chartElement, chart_key);
      });
   }
   chartElement.style.display = '';
}

function downloadCSV(event, link){
   event.preventDefault();
   const graph_key = link.dataset.graphKey;
   const form = link.closest('form.stateform');
   const baseUrl = "{% url 'chart-csv' 'PLACEHOLDER' %}".replace('PLACEHOLDER', graph_key);
   window.location.href = baseUrl + '?' + serializeForm(form);
}

function onReady(callback) {
   if (document.readyState !== 'loading') {
      callback();
   } else {
      document.addEventListener('DOMContentLoaded', callback);
   }
}

defer( function(){
   onReady(function() {

      document.body.addEventListener('change', function(event) {
         if (event.target.matches('#load_on_change:checked ~ .chart-input')) {
            loadAnchor(event.target);
         }
      });

      document.body.addEventListener('click', function(event) {
         const reloadButton = event.target.closest('.reload');
         if (reloadButton) {
            loadAnchor(reloadButton);
            return;
         }
         const csvLink = event.target.closest('.download-csv');
         if (csvLink) {
            downloadCSV(event, csvLink);
         }
      });

      visibleForms(document).forEach(function(form) {
         loadAnchor(form);
      });
   });
});
