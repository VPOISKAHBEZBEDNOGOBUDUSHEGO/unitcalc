(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MarketplaceCalculator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MONEY_FIELDS = [
    "costOfGoods", "packagingCost", "logisticsCost", "fulfillmentCost",
    "storageCost", "returnCost", "advertisingCost", "otherVariableCost",
    "fixedMonthlyCosts"
  ];

  function toNumber(value, field, fallback) {
    if ((value === "" || value === null || value === undefined) && fallback !== undefined) return fallback;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Поле «${field}» должно быть числом.`);
    return number;
  }

  function normalize(raw) {
    const input = {
      product: String(raw.product || "").trim(),
      category: String(raw.category || "").trim(),
      brand: String(raw.brand || "").trim(),
      country: String(raw.country || "").trim(),
      marketplace: String(raw.marketplace || "").trim(),
      salePrice: toNumber(raw.salePrice, "Цена продажи"),
      costOfGoods: toNumber(raw.costOfGoods, "Себестоимость", 0),
      packagingCost: toNumber(raw.packagingCost, "Упаковка", 0),
      commissionRate: toNumber(raw.commissionRate, "Комиссия", 0) / 100,
      logisticsCost: toNumber(raw.logisticsCost, "Логистика", 0),
      fulfillmentCost: toNumber(raw.fulfillmentCost, "Обработка заказа", 0),
      storageCost: toNumber(raw.storageCost, "Хранение", 0),
      paymentRate: toNumber(raw.paymentRate, "Эквайринг", 0) / 100,
      returnRate: toNumber(raw.returnRate, "Доля возвратов", 0) / 100,
      returnCost: toNumber(raw.returnCost, "Стоимость возврата", 0),
      advertisingCost: toNumber(raw.advertisingCost, "Реклама", 0),
      taxRate: toNumber(raw.taxRate, "Налог", 0) / 100,
      otherVariableCost: toNumber(raw.otherVariableCost, "Прочие расходы", 0),
      monthlyOrders: toNumber(raw.monthlyOrders, "Заказы в месяц", 0),
      fixedMonthlyCosts: toNumber(raw.fixedMonthlyCosts, "Постоянные расходы", 0)
    };

    if (input.salePrice <= 0) throw new Error("Цена продажи должна быть больше нуля.");
    if (MONEY_FIELDS.some((key) => input[key] < 0) || input.monthlyOrders < 0) {
      throw new Error("Расходы и объём продаж не могут быть отрицательными.");
    }

    const rates = [input.commissionRate, input.paymentRate, input.returnRate, input.taxRate];
    if (rates.some((rate) => rate < 0 || rate > 1)) {
      throw new Error("Процентные ставки должны быть в диапазоне от 0 до 100%.");
    }
    if (input.commissionRate + input.paymentRate + input.taxRate >= 1) {
      throw new Error("Комиссия, эквайринг и налог вместе должны быть меньше 100%.");
    }

    return input;
  }

  function calculateMetrics(input) {
    const costs = {
      costOfGoods: input.costOfGoods,
      packaging: input.packagingCost,
      commission: input.salePrice * input.commissionRate,
      logistics: input.logisticsCost,
      fulfillment: input.fulfillmentCost,
      storage: input.storageCost,
      payment: input.salePrice * input.paymentRate,
      returns: input.returnRate * input.returnCost,
      advertising: input.advertisingCost,
      tax: input.salePrice * input.taxRate,
      other: input.otherVariableCost
    };

    const totalVariableCosts = Object.values(costs).reduce((sum, value) => sum + value, 0);
    const profitPerOrder = input.salePrice - totalVariableCosts;
    const marginRate = profitPerOrder / input.salePrice;
    const percentageRate = input.commissionRate + input.paymentRate + input.taxRate;
    const fixedPerOrderCosts = totalVariableCosts - costs.commission - costs.payment - costs.tax;
    const priceDenominator = 1 - percentageRate;
    const breakEvenPrice = priceDenominator > 0 ? fixedPerOrderCosts / priceDenominator : null;
    const maxAdvertisingCost = profitPerOrder + input.advertisingCost;
    const safetyMargin = breakEvenPrice === null ? null : input.salePrice - breakEvenPrice;
    const monthlyContribution = profitPerOrder * input.monthlyOrders;
    const monthlyProfit = monthlyContribution - input.fixedMonthlyCosts;
    const breakEvenOrders = profitPerOrder > 0 ? Math.ceil(input.fixedMonthlyCosts / profitPerOrder) : null;

    return {
      costs,
      totalVariableCosts,
      profitPerOrder,
      marginRate,
      breakEvenPrice,
      maxAdvertisingCost,
      safetyMargin,
      monthlyContribution,
      monthlyProfit,
      breakEvenOrders
    };
  }

  function scenarios(input) {
    const definitions = [
      { id: "base", name: "Базовый", note: "Текущие параметры", changes: {} },
      {
        id: "moderate",
        name: "Умеренный стресс",
        note: "Цена -3%, комиссия +1 п.п., логистика и реклама +10%, возвраты +2 п.п.",
        changes: {
          salePrice: input.salePrice * 0.97,
          commissionRate: input.commissionRate + 0.01,
          logisticsCost: input.logisticsCost * 1.1,
          advertisingCost: input.advertisingCost * 1.1,
          returnRate: Math.min(1, input.returnRate + 0.02)
        }
      },
      { id: "price", name: "Цена -10%", note: "Скидка или участие в акции", changes: { salePrice: input.salePrice * 0.9 } },
      { id: "commission", name: "Комиссия +5 п.п.", note: "Рост тарифа площадки", changes: { commissionRate: input.commissionRate + 0.05 } },
      { id: "logistics", name: "Логистика +25%", note: "Рост стоимости доставки", changes: { logisticsCost: input.logisticsCost * 1.25 } },
      { id: "advertising", name: "Реклама +30%", note: "Удорожание заказа из рекламы", changes: { advertisingCost: input.advertisingCost * 1.3 } },
      { id: "returns", name: "Возвраты +5 п.п.", note: "Рост доли возвратов", changes: { returnRate: Math.min(1, input.returnRate + 0.05) } },
      {
        id: "combined",
        name: "Сильный стресс",
        note: "Цена -10%, комиссия +5 п.п., логистика +25%, реклама +30%, возвраты +5 п.п.",
        changes: {
          salePrice: input.salePrice * 0.9,
          commissionRate: input.commissionRate + 0.05,
          logisticsCost: input.logisticsCost * 1.25,
          advertisingCost: input.advertisingCost * 1.3,
          returnRate: Math.min(1, input.returnRate + 0.05)
        }
      }
    ];

    return definitions.map((definition) => {
      const scenarioInput = Object.assign({}, input, definition.changes);
      return Object.assign({}, definition, { input: scenarioInput, result: calculateMetrics(scenarioInput) });
    });
  }

  function sensitivity(base, allScenarios) {
    return allScenarios
      .filter((item) => !["base", "moderate", "combined"].includes(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        note: item.note,
        impact: item.result.profitPerOrder - base.profitPerOrder
      }))
      .sort((a, b) => a.impact - b.impact);
  }

  function largestCost(costs) {
    const labels = {
      costOfGoods: "себестоимость", packaging: "упаковка", commission: "комиссия",
      logistics: "логистика", fulfillment: "обработка заказа", storage: "хранение",
      payment: "эквайринг", returns: "возвраты", advertising: "реклама",
      tax: "налог", other: "прочие расходы"
    };
    const [key, value] = Object.entries(costs).sort((a, b) => b[1] - a[1])[0];
    return { key, label: labels[key], value };
  }

  function recommendation(base, allScenarios) {
    const driver = largestCost(base.costs);
    const combined = allScenarios.find((item) => item.id === "combined").result;

    if (base.profitPerOrder <= 0) {
      return {
        level: "danger", badge: "Убыток", title: "Каждый заказ приносит убыток",
        text: `При текущих вводных расходы выше цены продажи. Самая крупная статья - ${driver.label}. Измените цену или структуру затрат до масштабирования.`
      };
    }
    if (base.marginRate < 0.05) {
      return {
        level: "warning", badge: "Низкий запас", title: "Заказ прибыльный, но запас небольшой",
        text: `Маржа ниже 5%, поэтому небольшое изменение условий может сделать заказ убыточным. Самая крупная статья - ${driver.label}.`
      };
    }
    if (combined.profitPerOrder < 0) {
      return {
        level: "success", badge: "Положительно", title: "Базовая экономика заказа положительная",
        text: `Текущая маржа выше 5%, но комбинированный стресс уводит расчёт в минус. Основная статья расходов - ${driver.label}.`
      };
    }
    return {
      level: "success", badge: "Устойчиво", title: "Экономика заказа сохраняет запас",
      text: `Расчёт остаётся положительным даже в комбинированном стресс-сценарии. Основная статья расходов - ${driver.label}.`
    };
  }

  function calculate(raw) {
    const input = normalize(raw);
    const base = calculateMetrics(input);
    const scenarioResults = scenarios(input);
    return {
      input,
      base,
      scenarios: scenarioResults,
      sensitivity: sensitivity(base, scenarioResults),
      recommendation: recommendation(base, scenarioResults)
    };
  }

  return { calculate, normalize, calculateMetrics };
});
