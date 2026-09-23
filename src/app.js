(function () {
  "use strict";

  const form = document.getElementById("calculator-form");
  const error = document.getElementById("form-error");
  const resultError = document.getElementById("result-error");
  const downloadButton = document.getElementById("download-report");
  const printButton = document.getElementById("print-report");
  const countrySelect = form.elements.namedItem("country");
  const marketplaceSelect = form.elements.namedItem("marketplace");
  const productImageInput = document.getElementById("product-image-input");
  const productImage = document.getElementById("product-image");
  const reportProductImage = document.getElementById("report-product-image");
  const productImagePlaceholder = document.getElementById("product-image-placeholder");
  const productImageError = document.getElementById("product-image-error");
  const removeProductImageButton = document.getElementById("remove-product-image");
  const customSelects = new WeakMap();
  let latestResult = null;
  let updateTimer = null;

  const marketplacesByCountry = {
    "Россия": ["Wildberries", "Ozon", "Яндекс Маркет", "Мегамаркет"],
    "Казахстан": ["Kaspi.kz", "Wildberries", "Satu.kz"],
    "Узбекистан": ["Uzum Market", "Olcha.uz", "Sello"]
  };
  const allMarketplaces = Array.from(new Set(Object.values(marketplacesByCountry).flat()));

  const productExamples = [
    { product: "Набор конфет", category: "Продукты питания", minPrice: 800, maxPrice: 2500 },
    { product: "Термокружка", category: "Дом и кухня", minPrice: 900, maxPrice: 3200 },
    { product: "Органайзер для косметики", category: "Дом и кухня", minPrice: 700, maxPrice: 2800 },
    { product: "Футболка оверсайз", category: "Одежда и обувь", minPrice: 1000, maxPrice: 3500 },
    { product: "Настольная лампа", category: "Электроника", minPrice: 1400, maxPrice: 5000 },
    { product: "Крем для рук", category: "Красота и уход", minPrice: 500, maxPrice: 1800 },
    { product: "Детский конструктор", category: "Детские товары", minPrice: 900, maxPrice: 4500 },
    { product: "Гантели 2 кг", category: "Спорт", minPrice: 1000, maxPrice: 4000 },
    { product: "Автомобильный держатель", category: "Автотовары", minPrice: 600, maxPrice: 2500 },
    { product: "Корм для кошек", category: "Зоотовары", minPrice: 700, maxPrice: 3000 },
    { product: "Блокнот в твёрдой обложке", category: "Канцтовары", minPrice: 400, maxPrice: 1600 },
    { product: "Чехол для смартфона", category: "Электроника", minPrice: 500, maxPrice: 2200 }
  ];

  const costDefinitions = [
    { key: "costOfGoods", label: "Себестоимость", color: "navy" },
    { key: "packaging", label: "Упаковка", color: "blue" },
    { key: "commission", label: "Комиссия", color: "violet" },
    { key: "logistics", label: "Логистика", color: "cyan" },
    { key: "fulfillment", label: "Обработка заказа", color: "teal" },
    { key: "storage", label: "Хранение", color: "green" },
    { key: "payment", label: "Эквайринг", color: "lime" },
    { key: "returns", label: "Возвраты", color: "amber" },
    { key: "advertising", label: "Реклама", color: "orange" },
    { key: "tax", label: "Налог", color: "red" },
    { key: "other", label: "Прочее", color: "gray" }
  ];

  const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function roundMoney(value) {
    return value < 0 ? -Math.round(Math.abs(value)) : Math.round(value);
  }

  function formatMoney(value) {
    return value === null || !Number.isFinite(value) ? "-" : `${money.format(roundMoney(value))} ₽`;
  }

  function formatPercent(value) {
    return `${percent.format(value * 100)}%`;
  }

  function readForm() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function closeCustomSelect(instance, returnFocus = false) {
    instance.menu.hidden = true;
    instance.root.classList.remove("is-open");
    instance.trigger.setAttribute("aria-expanded", "false");
    instance.menu.querySelectorAll('[role="option"]').forEach((item) => {
      item.tabIndex = -1;
    });
    if (returnFocus) instance.trigger.focus();
  }

  function closeAllCustomSelects(except = null) {
    document.querySelectorAll(".custom-select.is-open").forEach((root) => {
      if (root !== except?.root) closeCustomSelect(root.customSelectInstance);
    });
  }

  function openCustomSelect(instance, focusLast = false) {
    closeAllCustomSelects(instance);
    instance.menu.hidden = false;
    instance.root.classList.add("is-open");
    instance.trigger.setAttribute("aria-expanded", "true");
    const items = Array.from(instance.menu.querySelectorAll('[role="option"]'));
    const selected = items.find((item) => item.getAttribute("aria-selected") === "true");
    const target = focusLast ? items.at(-1) : selected || items[0];
    if (target) {
      target.tabIndex = 0;
      target.focus();
    }
  }

  function handleCustomSelectKeydown(event, instance, item) {
    const items = Array.from(instance.menu.querySelectorAll('[role="option"]'));
    const index = items.indexOf(item);
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, items.length - 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      closeCustomSelect(instance, true);
      return;
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      item.click();
      return;
    } else if (event.key === "Tab") {
      closeCustomSelect(instance);
      return;
    } else {
      return;
    }
    event.preventDefault();
    items.forEach((option) => { option.tabIndex = -1; });
    items[nextIndex].tabIndex = 0;
    items[nextIndex].focus();
  }

  function refreshCustomSelect(select) {
    const instance = customSelects.get(select);
    if (!instance) return;
    const selectedOption = select.selectedOptions[0] || select.options[0];
    instance.value.textContent = selectedOption?.textContent || "";
    instance.menu.replaceChildren();

    Array.from(select.options).forEach((option) => {
      const item = document.createElement("div");
      item.className = "custom-select__option";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.selected));
      item.dataset.value = option.value;
      item.tabIndex = -1;
      item.textContent = option.textContent;
      item.addEventListener("click", () => {
        select.value = option.value;
        refreshCustomSelect(select);
        closeCustomSelect(instance, true);
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      item.addEventListener("keydown", (event) => handleCustomSelectKeydown(event, instance, item));
      instance.menu.append(item);
    });
  }

  function refreshAllCustomSelects() {
    document.querySelectorAll("select[data-custom-select]").forEach(refreshCustomSelect);
  }

  function initializeCustomSelects() {
    document.querySelectorAll("select[data-custom-select]").forEach((select, index) => {
      const root = document.createElement("div");
      const trigger = document.createElement("button");
      const value = document.createElement("span");
      const menu = document.createElement("div");
      const labelId = select.getAttribute("aria-labelledby") || "";
      const menuId = `custom-select-menu-${index + 1}`;
      const valueId = `custom-select-value-${index + 1}`;

      root.className = "custom-select";
      trigger.className = "custom-select__trigger";
      trigger.type = "button";
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-controls", menuId);
      trigger.setAttribute("aria-labelledby", `${labelId} ${valueId}`.trim());
      value.id = valueId;
      value.className = "custom-select__value";
      menu.id = menuId;
      menu.className = "custom-select__menu";
      menu.setAttribute("role", "listbox");
      menu.hidden = true;

      select.before(root);
      root.append(select, trigger, menu);
      trigger.append(value);
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");

      const instance = { root, trigger, value, menu, select };
      root.customSelectInstance = instance;
      customSelects.set(select, instance);
      refreshCustomSelect(select);

      trigger.addEventListener("click", () => {
        if (root.classList.contains("is-open")) closeCustomSelect(instance);
        else openCustomSelect(instance);
      });
      trigger.addEventListener("keydown", (event) => {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          openCustomSelect(instance, event.key === "ArrowUp");
        }
      });
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".custom-select")) closeAllCustomSelects();
    });
  }

  function updateMarketplaceOptions(preferredValue = "") {
    const options = countrySelect.value ? marketplacesByCountry[countrySelect.value] || [] : allMarketplaces;
    marketplaceSelect.replaceChildren(new Option("Не выбран", ""));
    options.forEach((marketplace) => marketplaceSelect.add(new Option(marketplace, marketplace)));
    marketplaceSelect.add(new Option("Другая площадка", "Другая площадка"));
    marketplaceSelect.value = Array.from(marketplaceSelect.options).some((option) => option.value === preferredValue)
      ? preferredValue
      : "";
    refreshCustomSelect(marketplaceSelect);
  }

  function clearProductImage() {
    productImageInput.value = "";
    productImage.removeAttribute("src");
    productImage.alt = "";
    productImage.hidden = true;
    reportProductImage.removeAttribute("src");
    reportProductImage.alt = "";
    reportProductImage.hidden = true;
    productImagePlaceholder.hidden = false;
    productImageError.hidden = true;
    productImageError.textContent = "";
    removeProductImageButton.hidden = true;
  }

  function loadProductImage() {
    const file = productImageInput.files[0];
    productImageError.hidden = true;
    productImageError.textContent = "";
    if (!file) {
      clearProductImage();
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      clearProductImage();
      productImageError.textContent = "Выберите файл JPG, PNG или WebP.";
      productImageError.hidden = false;
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      clearProductImage();
      productImageError.textContent = "Размер файла не должен превышать 5 МБ.";
      productImageError.hidden = false;
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const alt = `Фото товара: ${form.elements.namedItem("product").value || file.name}`;
      productImage.src = reader.result;
      productImage.alt = alt;
      productImage.hidden = false;
      reportProductImage.src = reader.result;
      reportProductImage.alt = alt;
      reportProductImage.hidden = false;
      productImagePlaceholder.hidden = true;
      removeProductImageButton.hidden = false;
    });
    reader.readAsDataURL(file);
  }

  function statusFor(value) {
    if (value > 0) return { label: "Прибыль", className: "status status--success" };
    if (value === 0) return { label: "В ноль", className: "status status--warning" };
    return { label: "Убыток", className: "status status--danger" };
  }

  function renderCostBreakdown(result) {
    const { input, base } = result;
    const scale = Math.max(input.salePrice, base.totalVariableCosts, 1);
    const segments = costDefinitions
      .filter((item) => base.costs[item.key] > 0)
      .map((item) => {
        const width = base.costs[item.key] / scale * 100;
        return `<span class="cost-segment cost-segment--${item.color}" style="width:${width}%" title="${item.label}: ${formatMoney(base.costs[item.key])}"></span>`;
      });

    if (base.profitPerOrder > 0) {
      segments.push(`<span class="cost-segment cost-segment--profit" style="width:${base.profitPerOrder / scale * 100}%" title="Прибыль: ${formatMoney(base.profitPerOrder)}"></span>`);
    }
    document.getElementById("cost-strip").innerHTML = segments.join("");

    const rows = [
      `<div class="calculation-row calculation-row--price"><span>Цена продажи</span><strong>${formatMoney(input.salePrice)}</strong></div>`,
      ...costDefinitions
        .filter((item) => base.costs[item.key] > 0)
        .map((item) => `<div class="calculation-row"><span><i class="legend-dot legend-dot--${item.color}"></i>${item.label}</span><strong>- ${formatMoney(base.costs[item.key])}</strong></div>`),
      `<div class="calculation-row calculation-row--total"><span>Всего расходов на заказ</span><strong>- ${formatMoney(base.totalVariableCosts)}</strong></div>`,
      `<div class="calculation-row calculation-row--result ${base.profitPerOrder < 0 ? "is-negative" : ""}"><span>Прибыль с заказа</span><strong>${formatMoney(base.profitPerOrder)}</strong></div>`
    ];
    document.getElementById("calculation-list").innerHTML = rows.join("");
  }

  function renderScenarioChart(scenarios) {
    const max = Math.max(...scenarios.map((item) => Math.abs(item.result.profitPerOrder)), 1);
    document.getElementById("scenario-chart").innerHTML = scenarios.map((item) => {
      const value = item.result.profitPerOrder;
      const width = Math.max(1.5, Math.abs(value) / max * 48);
      const style = value >= 0 ? `left:50%;width:${width}%` : `left:${50 - width}%;width:${width}%`;
      return `<div class="scenario-row">
        <span class="scenario-row__label">${item.name}</span>
        <div class="scenario-track" aria-hidden="true"><span class="scenario-bar ${value >= 0 ? "scenario-bar--positive" : "scenario-bar--negative"}" style="${style}"></span></div>
        <strong class="scenario-row__value ${value < 0 ? "negative" : ""}">${formatMoney(value)}</strong>
      </div>`;
    }).join("");
  }

  function renderScenarioTable(scenarios) {
    document.getElementById("scenario-table").innerHTML = scenarios.map((item) => {
      const status = statusFor(Math.sign(item.result.profitPerOrder));
      return `<tr>
        <th scope="row"><span>${item.name}</span><small>${item.note}</small></th>
        <td class="${item.result.profitPerOrder < 0 ? "negative" : ""}">${formatMoney(item.result.profitPerOrder)}</td>
        <td>${formatPercent(item.result.marginRate)}</td>
        <td><span class="${status.className}">${status.label}</span></td>
      </tr>`;
    }).join("");
  }

  function renderSensitivity(items) {
    const max = Math.max(...items.map((item) => Math.abs(item.impact)), 1);
    document.getElementById("sensitivity-chart").innerHTML = items.map((item, index) => {
      const width = Math.max(3, Math.abs(item.impact) / max * 100);
      return `<div class="sensitivity-row">
        <div class="sensitivity-row__heading"><span><b>${index + 1}</b>${item.name}</span><strong>${formatMoney(item.impact)}</strong></div>
        <div class="sensitivity-track"><span style="width:${width}%"></span></div>
        <small>${item.note}</small>
      </div>`;
    }).join("");
  }

  function assessmentFor(result) {
    const { base, sensitivity, scenarios } = result;
    const moderate = scenarios.find((item) => item.id === "moderate").result;
    const stress = scenarios.find((item) => item.id === "combined").result;
    const mainRisk = sensitivity[0];
    let status;
    let action;

    if (base.profitPerOrder <= 0) {
      status = "Текущая модель убыточна";
      action = "До запуска нужно изменить цену или расходы.";
    } else if (moderate.profitPerOrder <= 0) {
      status = "Прибыль есть только при текущих условиях";
      action = "Для старта нужен дополнительный запас по цене или расходам.";
    } else if (stress.profitPerOrder < 0) {
      status = "Есть прибыль, но запас ограничен";
      action = "Тестовая партия возможна, но скидки и рост расходов требуют нового расчёта.";
    } else {
      status = "Есть запас прочности";
      action = "Расчёт остаётся положительным в обоих стресс-сценариях.";
    }

    return {
      status,
      text: `Сейчас заказ даёт ${formatMoney(base.profitPerOrder)} прибыли при марже ${formatPercent(base.marginRate)}. Умеренный стресс даёт ${formatMoney(moderate.profitPerOrder)}, сильный стресс: ${formatMoney(stress.profitPerOrder)}. Наибольшее влияние оказывает сценарий «${mainRisk.name}»: ${formatMoney(mainRisk.impact)} с заказа. ${action}`,
      moderate,
      stress
    };
  }

  function renderAssessment(result) {
    const assessment = assessmentFor(result);
    setText("assessment-status", assessment.status);
    setText("assessment-base", formatMoney(result.base.profitPerOrder));
    setText("assessment-base-note", `${formatPercent(result.base.marginRate)} маржи`);
    setText("assessment-moderate", formatMoney(assessment.moderate.profitPerOrder));
    setText("assessment-stress", formatMoney(assessment.stress.profitPerOrder));
    setText("assessment-text", assessment.text);

    [
      ["assessment-base", result.base.profitPerOrder],
      ["assessment-moderate", assessment.moderate.profitPerOrder],
      ["assessment-stress", assessment.stress.profitPerOrder]
    ].forEach(([id, value]) => document.getElementById(id).classList.toggle("negative", value < 0));
  }

  function render(result) {
    latestResult = result;
    const { input, base } = result;

    setText("metric-profit", formatMoney(base.profitPerOrder));
    setText("metric-margin", formatPercent(base.marginRate));
    setText("metric-monthly", formatMoney(base.monthlyProfit));
    setText("metric-monthly-note", `При ${money.format(input.monthlyOrders)} заказах и после постоянных расходов`);
    setText("metric-break-even-price", formatMoney(base.breakEvenPrice));
    setText("metric-max-ad", formatMoney(base.maxAdvertisingCost));
    setText("metric-max-ad-note", base.maxAdvertisingCost < 0
      ? "Заказ убыточен даже при нулевых расходах на рекламу"
      : "При большем расходе заказ станет убыточным");
    setText("metric-safety", formatMoney(base.safetyMargin));
    setText("metric-break-even-orders", base.breakEvenOrders === null ? "Не достигается" : money.format(base.breakEvenOrders));
    setText("metric-cost-share", formatPercent(base.totalVariableCosts / input.salePrice));
    setText("total-cost", `Всего расходов: ${formatMoney(base.totalVariableCosts)}`);
    const context = [input.product, input.category, input.brand, input.marketplace, input.country].filter(Boolean).join(", ");
    setText("result-context", context);
    document.getElementById("result-context").hidden = !context;
    document.getElementById("metric-profit").classList.toggle("negative", base.profitPerOrder < 0);
    document.getElementById("metric-monthly").classList.toggle("negative", base.monthlyProfit < 0);

    renderCostBreakdown(result);
    renderScenarioChart(result.scenarios);
    renderScenarioTable(result.scenarios);
    renderSensitivity(result.sensitivity);
    renderAssessment(result);
  }

  function clearFieldErrors() {
    form.querySelectorAll(".field--invalid").forEach((field) => field.classList.remove("field--invalid"));
    form.querySelectorAll(".field-validation").forEach((message) => message.remove());
    form.querySelectorAll("[aria-invalid='true']").forEach((input) => input.removeAttribute("aria-invalid"));
  }

  function validationMessage(input) {
    if (input.validity.valueMissing) return "Укажите значение.";
    if (input.validity.badInput) return "Введите число.";
    if (input.validity.rangeOverflow) return `Максимальное значение: ${input.max}.`;
    if (input.validity.rangeUnderflow) return `Минимальное значение: ${input.min}.`;
    if (input.validity.stepMismatch) return "Введите значение с допустимой точностью.";
    return "Проверьте значение.";
  }

  function validateFields() {
    clearFieldErrors();
    const invalidInputs = Array.from(form.querySelectorAll("input")).filter((input) => !input.validity.valid);

    invalidInputs.forEach((input) => {
      const field = input.closest(".field");
      if (!field) return;
      field.classList.add("field--invalid");
      input.setAttribute("aria-invalid", "true");
      const message = document.createElement("span");
      message.className = "field-validation";
      message.textContent = validationMessage(input);
      field.appendChild(message);
    });

    return invalidInputs;
  }

  function setInvalidState(message) {
    latestResult = null;
    error.textContent = message;
    error.hidden = false;
    resultError.textContent = "Исправьте ошибку во входных данных. Показатели ниже не обновлены.";
    resultError.classList.remove("result-error--empty");
    resultError.hidden = false;
    document.querySelector(".results").classList.add("is-invalid");
    downloadButton.disabled = true;
    printButton.disabled = true;
  }

  function setValidState() {
    error.hidden = true;
    resultError.classList.remove("result-error--empty");
    resultError.hidden = true;
    document.querySelector(".results").classList.remove("is-invalid");
    downloadButton.disabled = false;
    printButton.disabled = false;
  }

  function calculate() {
    const invalidInputs = validateFields();
    if (invalidInputs.length) {
      const label = invalidInputs[0].closest(".field")?.querySelector("span")?.textContent.trim() || "Поле";
      setInvalidState(`${label}: ${validationMessage(invalidInputs[0])}`);
      return false;
    }

    try {
      const result = window.MarketplaceCalculator.calculate(readForm());
      setValidState();
      render(result);
      return true;
    } catch (exception) {
      setInvalidState(exception.message);
      return false;
    }
  }

  function randomStep(min, max, step) {
    const steps = Math.floor((max - min) / step);
    return Number((min + Math.floor(Math.random() * (steps + 1)) * step).toFixed(2));
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function roundedCost(value, step = 5) {
    return Math.max(0, Math.round(value / step) * step);
  }

  function exampleValues(mode = "random") {
    const example = randomItem(productExamples);
    const country = randomItem(Object.keys(marketplacesByCountry));
    const marketplace = randomItem(marketplacesByCountry[country]);
    const salePrice = randomStep(example.minPrice, example.maxPrice, 50);
    const common = {
      product: example.product,
      category: example.category,
      brand: randomItem(["Без бренда", "Собственное производство", "Контрактное производство"]),
      country,
      marketplace,
      salePrice
    };

    if (mode === "random") {
      return Object.assign(common, {
        costOfGoods: randomStep(salePrice * 0.2, salePrice * 0.55, 10),
        packagingCost: randomStep(0, 120, 5),
        commissionRate: randomStep(10, 35, 0.5),
        logisticsCost: randomStep(100, 600, 10),
        fulfillmentCost: randomStep(0, 150, 5),
        storageCost: randomStep(0, 100, 5),
        paymentRate: randomItem([0, 1, 1.5, 2, 2.5]),
        returnRate: randomStep(0, 20, 1),
        returnCost: randomStep(100, 800, 10),
        advertisingCost: randomStep(0, salePrice * 0.3, 10),
        taxRate: randomItem([0, 4, 6, 7]),
        otherVariableCost: randomStep(0, 200, 10),
        monthlyOrders: randomStep(50, 800, 10),
        fixedMonthlyCosts: randomStep(0, 150000, 5000)
      });
    }

    const profiles = {
      positive: { margin: [0.12, 0.22], cost: [0.22, 0.34], commission: [10, 18], logistics: [0.04, 0.08] },
      balanced: { margin: [0.02, 0.08], cost: [0.32, 0.42], commission: [16, 24], logistics: [0.06, 0.1] },
      negative: { margin: [-0.18, -0.05], cost: [0.38, 0.48], commission: [20, 28], logistics: [0.08, 0.12] }
    };
    const profile = profiles[mode];
    const costOfGoods = randomStep(salePrice * profile.cost[0], salePrice * profile.cost[1], 10);
    const packagingCost = randomStep(0, salePrice * 0.015, 5);
    const commissionRate = randomStep(profile.commission[0], profile.commission[1], 0.5);
    const logisticsCost = roundedCost(randomStep(salePrice * profile.logistics[0], salePrice * profile.logistics[1], 5));
    const fulfillmentCost = randomStep(0, salePrice * 0.015, 5);
    const storageCost = randomStep(0, salePrice * 0.01, 5);
    const paymentRate = randomItem([1, 1.5, 2, 2.5]);
    const returnRate = randomStep(2, 8, 1);
    const returnCost = randomStep(salePrice * 0.05, salePrice * 0.15, 10);
    const taxRate = randomItem([4, 6]);
    const otherVariableCost = randomStep(0, salePrice * 0.01, 5);
    const targetMargin = randomStep(profile.margin[0], profile.margin[1], 0.01);
    const costsWithoutAdvertising = costOfGoods + packagingCost + salePrice * commissionRate / 100
      + logisticsCost + fulfillmentCost + storageCost + salePrice * paymentRate / 100
      + returnRate / 100 * returnCost + salePrice * taxRate / 100 + otherVariableCost;
    const advertisingCost = roundedCost(salePrice - costsWithoutAdvertising - salePrice * targetMargin, 5);
    const monthlyOrders = randomStep(100, 800, 10);
    const profitPerOrder = salePrice - costsWithoutAdvertising - advertisingCost;
    let fixedMonthlyCosts;
    if (mode === "positive") fixedMonthlyCosts = roundedCost(profitPerOrder * monthlyOrders * randomStep(0.15, 0.6, 0.05), 1000);
    else if (mode === "balanced") fixedMonthlyCosts = roundedCost(profitPerOrder * monthlyOrders * randomStep(0.7, 1.1, 0.05), 1000);
    else fixedMonthlyCosts = randomStep(10000, 150000, 5000);

    return Object.assign(common, {
      costOfGoods,
      packagingCost,
      commissionRate,
      logisticsCost,
      fulfillmentCost,
      storageCost,
      paymentRate,
      returnRate,
      returnCost,
      advertisingCost,
      taxRate,
      otherVariableCost,
      monthlyOrders,
      fixedMonthlyCosts
    });
  }

  function loadExample(mode = "random") {
    const values = exampleValues(mode);
    clearProductImage();
    countrySelect.value = values.country;
    refreshCustomSelect(countrySelect);
    updateMarketplaceOptions(values.marketplace);
    Object.entries(values).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    });
    refreshAllCustomSelects();
    calculate();
  }

  function clearForm() {
    Array.from(form.elements).forEach((field) => {
      if (field instanceof HTMLInputElement && field.type !== "file") field.value = "";
      if (field instanceof HTMLSelectElement) field.value = "";
    });
    updateMarketplaceOptions();
    refreshAllCustomSelects();
    clearProductImage();
    clearFieldErrors();
    latestResult = null;
    error.hidden = true;
    setText("result-context", "");
    document.getElementById("result-context").hidden = true;
    resultError.textContent = "Заполните цену и расходы, чтобы получить расчёт.";
    resultError.classList.add("result-error--empty");
    resultError.hidden = false;
    document.querySelector(".results").classList.add("is-invalid");
    downloadButton.disabled = true;
    printButton.disabled = true;
  }

  function buildReport(result) {
    const { input, base } = result;
    const assessment = assessmentFor(result);
    const lines = [
      "UNIT-ЭКОНОМИКА ТОВАРА НА МАРКЕТПЛЕЙСЕ",
      "",
      "КАРТОЧКА ТОВАРА",
      input.product ? `Товар: ${input.product}` : "",
      input.category ? `Категория: ${input.category}` : "",
      input.brand ? `Бренд или производитель: ${input.brand}` : "",
      input.country ? `Страна продаж: ${input.country}` : "",
      input.marketplace ? `Маркетплейс: ${input.marketplace}` : "",
      productImageInput.files[0] ? `Фото товара: ${productImageInput.files[0].name}` : "",
      "",
      "ИСХОДНЫЕ ДАННЫЕ",
      `Цена продажи: ${formatMoney(input.salePrice)}`,
      `Себестоимость: ${formatMoney(input.costOfGoods)}`,
      `Комиссия: ${formatPercent(input.commissionRate)}`,
      `Логистика: ${formatMoney(input.logisticsCost)}`,
      `Реклама на заказ: ${formatMoney(input.advertisingCost)}`,
      `План заказов в месяц: ${money.format(input.monthlyOrders)}`,
      `Постоянные расходы: ${formatMoney(input.fixedMonthlyCosts)}`,
      "",
      "РЕЗУЛЬТАТ",
      `Прибыль с заказа: ${formatMoney(base.profitPerOrder)}`,
      `Маржа: ${formatPercent(base.marginRate)}`,
      `Переменные расходы: ${formatMoney(base.totalVariableCosts)}`,
      `Цена безубыточности: ${formatMoney(base.breakEvenPrice)}`,
      `Допустимая реклама на заказ: ${formatMoney(base.maxAdvertisingCost)}`,
      `Запас цены: ${formatMoney(base.safetyMargin)}`,
      `Прибыль за месяц: ${formatMoney(base.monthlyProfit)}`,
      `Заказов для покрытия постоянных расходов: ${base.breakEvenOrders === null ? "не достигается" : money.format(base.breakEvenOrders)}`,
      "",
      "ИТОГОВАЯ ОЦЕНКА",
      assessment.status,
      assessment.text,
      "",
      "СТРУКТУРА РАСХОДОВ"
    ];

    costDefinitions.forEach((item) => {
      if (base.costs[item.key] > 0) lines.push(`${item.label}: ${formatMoney(base.costs[item.key])}`);
    });
    lines.push("", "СТРЕСС-СЦЕНАРИИ");
    result.scenarios.forEach((item) => lines.push(`${item.name}: ${formatMoney(item.result.profitPerOrder)} (${formatPercent(item.result.marginRate)})`));
    lines.push("", "Расчёт основан на введённых данных и не является прогнозом спроса.");
    return lines.filter((line, index, array) => line !== "" || array[index - 1] !== "").join("\n");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculate();
  });
  form.addEventListener("input", () => {
    window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(calculate, 140);
  });
  countrySelect.addEventListener("change", () => {
    updateMarketplaceOptions();
    calculate();
  });
  productImageInput.addEventListener("change", loadProductImage);
  removeProductImageButton.addEventListener("click", clearProductImage);
  document.getElementById("load-example").addEventListener("click", () => loadExample("random"));
  document.querySelectorAll("[data-example-mode]").forEach((button) => {
    button.addEventListener("click", () => loadExample(button.dataset.exampleMode));
  });
  document.getElementById("clear-form").addEventListener("click", clearForm);
  printButton.addEventListener("click", () => {
    if (latestResult) window.print();
  });
  downloadButton.addEventListener("click", () => {
    if (!latestResult && !calculate()) return;
    const blob = new Blob([buildReport(latestResult)], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "unit-economics-marketplace.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  initializeCustomSelects();
  updateMarketplaceOptions(marketplaceSelect.value);
  calculate();
})();
