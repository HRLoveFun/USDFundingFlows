/**
 * time-selector.js — Date dropdown + range slider.
 * Triggers callback on change with the selected quarter-end date string.
 */

import { TIMING } from "./config.js";

const { SLIDER_DEBOUNCE_MS } = TIMING;

export function initTimeSelector(container, dates, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "time-selector";

  // Label
  const label = document.createElement("span");
  label.textContent = "Quarter: ";
  label.className = "time-label";
  wrapper.appendChild(label);

  // Dropdown
  const select = document.createElement("select");
  select.id = "date-select";
  dates.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = formatQuarter(d);
    if (i === dates.length - 1) opt.selected = true;
    select.appendChild(opt);
  });
  wrapper.appendChild(select);

  // Range slider
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = dates.length - 1;
  slider.value = dates.length - 1;
  slider.id = "date-slider";
  wrapper.appendChild(slider);

  // Sync events
  select.addEventListener("change", () => {
    const idx = dates.indexOf(select.value);
    if (idx >= 0) slider.value = idx;
    onChange(select.value);
  });

  // Slider with debounce (50ms) to avoid excessive re-renders during drag
  let sliderTimer = null;
  slider.addEventListener("input", () => {
    const date = dates[slider.value];
    select.value = date;
    // Debounce: coalesce rapid slider events
    clearTimeout(sliderTimer);
    sliderTimer = setTimeout(() => onChange(date), SLIDER_DEBOUNCE_MS);
  });

  container.appendChild(wrapper);

  // Return current date
  return dates[dates.length - 1];
}

function formatQuarter(dateStr) {
  const [y, m] = dateStr.split("-");
  const q = Math.ceil(parseInt(m) / 3);
  return `Q${q} ${y}`;
}
