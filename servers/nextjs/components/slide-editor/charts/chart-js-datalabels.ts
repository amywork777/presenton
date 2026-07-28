import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";

let registered = false;

/**
 * Register the installed data-label plugin without changing Presenton's
 * existing chart appearance. Individual charts can opt in with
 * `plugins.datalabels.display`.
 */
export function registerChartJsDataLabels(): void {
  if (registered) return;

  Chart.register(ChartDataLabels);
  const dataLabelsDefaults = Chart.defaults.plugins.datalabels;
  if (dataLabelsDefaults) {
    dataLabelsDefaults.display = false;
  }
  registered = true;
}
