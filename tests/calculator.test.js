const test = require("node:test");
const assert = require("node:assert/strict");
const calculator = require("../src/calculator.js");

const example = {
  product: "Набор конфет",
  category: "Продукты питания",
  brand: "Собственное производство",
  country: "Россия",
  marketplace: "Wildberries",
  salePrice: 1500,
  costOfGoods: 400,
  packagingCost: 30,
  commissionRate: 25,
  logisticsCost: 250,
  fulfillmentCost: 30,
  storageCost: 10,
  paymentRate: 1.5,
  returnRate: 5,
  returnCost: 250,
  advertisingCost: 150,
  taxRate: 6,
  otherVariableCost: 0,
  monthlyOrders: 300,
  fixedMonthlyCosts: 20000
};

function closeTo(actual, expected, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
}

test("calculates a transparent per-order cost model", () => {
  const result = calculator.calculate(example);

  assert.equal(result.base.costs.commission, 375);
  assert.equal(result.base.costs.payment, 22.5);
  assert.equal(result.base.costs.tax, 90);
  assert.equal(result.base.costs.returns, 12.5);
  assert.equal(result.base.totalVariableCosts, 1370);
  assert.equal(result.base.profitPerOrder, 130);
  closeTo(result.base.marginRate, 130 / 1500);
});

test("calculates break-even and advertising limits from the same cost model", () => {
  const result = calculator.calculate(example);

  closeTo(result.base.breakEvenPrice, 882.5 / 0.675);
  assert.equal(result.base.maxAdvertisingCost, 280);
  closeTo(result.base.safetyMargin, 1500 - 882.5 / 0.675);
});

test("calculates monthly plan and break-even order count", () => {
  const result = calculator.calculate(example);

  assert.equal(result.base.monthlyContribution, 39000);
  assert.equal(result.base.monthlyProfit, 19000);
  assert.equal(result.base.breakEvenOrders, 154);
});

test("builds stress scenarios and identifies the largest negative driver", () => {
  const result = calculator.calculate(example);
  const moderate = result.scenarios.find((item) => item.id === "moderate");
  const combined = result.scenarios.find((item) => item.id === "combined");

  assert.ok(moderate.result.profitPerOrder > 0);
  assert.ok(moderate.result.profitPerOrder < result.base.profitPerOrder);
  assert.ok(combined.result.profitPerOrder < result.base.profitPerOrder);
  assert.equal(result.sensitivity[0].id, "price");
  assert.ok(result.sensitivity[0].impact < 0);
});

test("labels a small positive margin as a thin safety margin", () => {
  const thin = calculator.calculate({ ...example, advertisingCost: 230 });

  assert.equal(thin.recommendation.level, "warning");
  assert.equal(thin.recommendation.badge, "Низкий запас");
});

test("labels a loss-making order without pretending to predict demand", () => {
  const loss = calculator.calculate({ ...example, salePrice: 1100 });

  assert.equal(loss.recommendation.level, "danger");
  assert.equal(loss.recommendation.badge, "Убыток");
  assert.ok(loss.base.profitPerOrder < 0);
  assert.equal(loss.base.breakEvenOrders, null);
});

test("rejects negative costs and impossible percentage rates", () => {
  assert.throws(() => calculator.calculate({ ...example, logisticsCost: -1 }), /отрицательными/);
  assert.throws(() => calculator.calculate({ ...example, commissionRate: 725 }), /от 0 до 100%/);
  assert.throws(() => calculator.calculate({ ...example, commissionRate: 95, taxRate: 6 }), /меньше 100%/);
});

test("allows an empty product name but requires a positive sale price", () => {
  assert.doesNotThrow(() => calculator.calculate({ ...example, product: "" }));
  assert.throws(() => calculator.calculate({ ...example, salePrice: 0 }), /больше нуля/);
});

test("preserves optional product and marketplace details for reports", () => {
  const result = calculator.calculate(example);

  assert.equal(result.input.category, "Продукты питания");
  assert.equal(result.input.brand, "Собственное производство");
  assert.equal(result.input.country, "Россия");
  assert.equal(result.input.marketplace, "Wildberries");
});
