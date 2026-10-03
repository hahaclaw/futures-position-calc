/**
 * FUTURES MARKET TOOL - 期货市场仓位计算软件
 * 纯前端实现：无后端、无数据库、无外部依赖。
 *
 * 核心公式：
 *   最大风险金额   = 账户余额 * 风险比例 / 100
 *   每手预计亏损   = |入场价格 - 止损价格| * 每手交易单位
 *   最佳合约数量   = Math.floor(最大风险金额 / 每手预计亏损)
 *   计划总风险     = 最佳合约数量 * 每手预计亏损
 */

(function () {
  "use strict";

  // ---------- 页面元素引用 ----------
  var form = document.getElementById("calc-form");
  var balanceInput = document.getElementById("balance");
  var riskInput = document.getElementById("risk");
  var riskValue = document.getElementById("risk-value");
  var entryInput = document.getElementById("entry");
  var stopInput = document.getElementById("stop");
  var unitsInput = document.getElementById("units");
  var errorBox = document.getElementById("error-box");
  var resultBox = document.getElementById("result-box");
  var lotsEl = document.getElementById("result-lots");
  var maxRiskEl = document.getElementById("result-max-risk");
  var perLotEl = document.getElementById("result-per-lot");
  var totalRiskEl = document.getElementById("result-total-risk");
  var warningEl = document.getElementById("risk-warning");

  /**
   * 输入校验：所有数值必须为有效正数；入场价与止损价不能相同。
   * 返回错误信息数组，为空表示通过。
   */
  function validate(balance, risk, entry, stop, units) {
    var errors = [];
    var fields = [
      { name: "账户余额", value: balance },
      { name: "风险比例", value: risk },
      { name: "入场价格", value: entry },
      { name: "止损价格", value: stop },
      { name: "每手交易单位", value: units }
    ];

    fields.forEach(function (f) {
      // 必须为有限数值且大于 0
      if (typeof f.value !== "number" || !isFinite(f.value) || f.value <= 0) {
        errors.push(f.name + "必须为有效正数");
      }
    });

    if (errors.length === 0 && entry === stop) {
      errors.push("入场价格与止损价格不能相同");
    }

    return errors;
  }

  /**
   * 仓位计算核心逻辑（纯函数，便于单元验证）。
   * 入参均为已通过校验的正数。
   */
  function calculate(balance, risk, entry, stop, units) {
    var maxRisk = balance * risk / 100;                 // 最大风险金额（元）
    var perLotLoss = Math.abs(entry - stop) * units;    // 每手预计亏损（元）
    var lots = Math.floor(maxRisk / perLotLoss);        // 最佳合约数量（向下取整）
    var totalRisk = lots * perLotLoss;                  // 计划总风险（元）
    return { maxRisk: maxRisk, perLotLoss: perLotLoss, lots: lots, totalRisk: totalRisk };
  }

  /** 人民币格式化：¥1,000.00 */
  function formatCurrency(value) {
    return "¥" + value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** 获取当前表单数值（非法输入返回 NaN） */
  function readValues() {
    return {
      balance: parseFloat(balanceInput.value),
      risk: parseFloat(riskInput.value),
      entry: parseFloat(entryInput.value),
      stop: parseFloat(stopInput.value),
      units: parseFloat(unitsInput.value)
    };
  }

  /** 执行计算并渲染结果 */
  function runCalculation() {
    var values = readValues();

    // 1. 校验
    var errors = validate(values.balance, values.risk, values.entry, values.stop, values.units);
    if (errors.length > 0) {
      errorBox.textContent = "输入有误：" + errors.join("；");
      errorBox.hidden = false;
      resultBox.hidden = true;
      return;
    }

    errorBox.hidden = true;

    // 2. 计算
    var result = calculate(values.balance, values.risk, values.entry, values.stop, values.units);

    // 3. 渲染
    lotsEl.textContent = result.lots;
    maxRiskEl.textContent = formatCurrency(result.maxRisk);
    perLotEl.textContent = formatCurrency(result.perLotLoss);
    totalRiskEl.textContent = formatCurrency(result.totalRisk);
    resultBox.hidden = false;

    // 4. 合约数量过小风险提示
    if (result.lots < 1) {
      warningEl.textContent =
        "风险提示：按当前参数计算的合约数量小于 1 手，建议放弃该笔交易或调整止损距离。";
      warningEl.hidden = false;
    } else {
      warningEl.hidden = true;
    }
  }

  // ---------- 事件绑定 ----------

  // 风险比例滑块变化时，同步显示百分比并实时更新结果
  riskInput.addEventListener("input", function () {
    riskValue.textContent = riskInput.value + "%";
    runCalculation();
  });

  // 数值输入框失焦或按回车时更新结果
  [balanceInput, entryInput, stopInput, unitsInput].forEach(function (input) {
    input.addEventListener("change", runCalculation);
  });

  // 点击"自动计算"按钮
  form.addEventListener("submit", function (e) {
    e.preventDefault(); // 阻止原生表单提交
    runCalculation();
  });

  // 页面首次打开时自动显示计算结果（默认参数应算出 5 手）
  runCalculation();
})();
