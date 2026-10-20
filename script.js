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
  var highEl = document.getElementById("result-high");
  var lowEl = document.getElementById("result-low");
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
    // 规定：最高点/最低点为入场价与止损价中的较大者/较小者
    // 入场价高于止损价 → 最高点=入场价、最低点=止损价
    // 入场价低于止损价 → 最高点=止损价、最低点=入场价
    var high = Math.max(entry, stop);                   // 最高点
    var low = Math.min(entry, stop);                    // 最低点
    var perLotLoss = (high - low) * units;              // 每手预计亏损（元）
    var lots = Math.floor(maxRisk / perLotLoss);        // 最佳合约数量（向下取整）
    var totalRisk = lots * perLotLoss;                  // 计划总风险（元）
    return { maxRisk: maxRisk, high: high, low: low, perLotLoss: perLotLoss, lots: lots, totalRisk: totalRisk };
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
    highEl.textContent = result.high;
    lowEl.textContent = result.low;
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

  // ============================================================
  // 品种速查功能
  // 内置品种数据库：交易单位与保证金比例参考 2026 年各交易所/期货公司公示数据
  // ============================================================
  var PROD_DB = [
    // ---- 上期所（上海期货交易所） ----
    { name: '螺纹钢', code: 'rb', exchange: '上海', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 3300, note: '', alias: ["螺纹", "期螺"] },
    { name: '热卷', code: 'hc', exchange: '上海', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 3400, note: '' },
    { name: '铜', code: 'cu', exchange: '上海', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 76000, note: '', alias: ["沪铜"] },
    { name: '铝', code: 'al', exchange: '上海', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 20000, note: '', alias: ["沪铝"] },
    { name: '锌', code: 'zn', exchange: '上海', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 24000, note: '', alias: ["沪锌"] },
    { name: '铅', code: 'pb', exchange: '上海', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 16500, note: '', alias: ["沪铅"] },
    { name: '镍', code: 'ni', exchange: '上海', unitText: '1吨/手', unitNum: 1, unitName: '吨', priceUnit: '元/吨', margin: 0.10, refPrice: 120000, note: '', alias: ["沪镍"] },
    { name: '锡', code: 'sn', exchange: '上海', unitText: '1吨/手', unitNum: 1, unitName: '吨', priceUnit: '元/吨', margin: 0.10, refPrice: 250000, note: '', alias: ["沪锡"] },
    { name: '黄金', code: 'au', exchange: '上海', unitText: '1000克/手', unitNum: 1000, unitName: '克', priceUnit: '元/克', margin: 0.16, refPrice: 610, note: '', alias: ["沪金", "金"] },
    { name: '白银', code: 'ag', exchange: '上海', unitText: '15千克/手', unitNum: 15, unitName: '千克', priceUnit: '元/千克', margin: 0.16, refPrice: 7300, note: '', alias: ["沪银"] },
    { name: '橡胶', code: 'ru', exchange: '上海', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 14000, note: '' },
    { name: '沥青', code: 'bu', exchange: '上海', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 3300, note: '' },
    { name: '燃料油', code: 'fu', exchange: '上海', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 3000, note: '', alias: ["燃油"] },
    { name: '纸浆', code: 'sp', exchange: '上海', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 5600, note: '' },
    { name: '不锈钢', code: 'ss', exchange: '上海', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 13500, note: '' },
    { name: '氧化铝', code: 'ao', exchange: '上海', unitText: '20吨/手', unitNum: 20, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 4800, note: '' },
    // ---- 能源中心（上海国际能源交易中心） ----
    { name: '原油', code: 'sc', exchange: '能源', unitText: '1000桶/手', unitNum: 1000, unitName: '桶', priceUnit: '元/桶', margin: 0.09, refPrice: 520, note: '', alias: ["上海原油"] },
    { name: '20号胶', code: 'nr', exchange: '能源', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 11500, note: '' },
    { name: '低硫燃料油', code: 'lu', exchange: '能源', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 3900, note: '' },
    // ---- 广期所（广州期货交易所） ----
    { name: '碳酸锂', code: 'lc', exchange: '广州', unitText: '1吨/手', unitNum: 1, unitName: '吨', priceUnit: '元/吨', margin: 0.11, refPrice: 70000, note: '' },
    { name: '工业硅', code: 'si', exchange: '广州', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.10, refPrice: 11000, note: '' },
    { name: '多晶硅', code: 'ps', exchange: '广州', unitText: '3吨/手', unitNum: 3, unitName: '吨', priceUnit: '元/吨', margin: 0.15, refPrice: 40000, note: '' },
    // ---- 大商所（大连商品交易所） ----
    { name: '豆粕', code: 'm', exchange: '大连', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 3000, note: '' },
    { name: '豆油', code: 'y', exchange: '大连', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 7700, note: '' },
    { name: '棕榈油', code: 'p', exchange: '大连', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.08, refPrice: 8500, note: '', alias: ["棕榈"] },
    { name: '豆一', code: 'a', exchange: '大连', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 4300, note: '', alias: ["黄豆一号", "黄豆1号", "黄大豆1号", "黄大豆一号", "豆一"] },
    { name: '豆二', code: 'b', exchange: '大连', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 4100, note: '', alias: ["黄豆二号", "黄豆2号", "黄大豆2号", "黄豆"] },
    { name: '玉米', code: 'c', exchange: '大连', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 2250, note: '', alias: ["玉米主连"] },
    { name: '玉米淀粉', code: 'cs', exchange: '大连', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.06, refPrice: 2650, note: '', alias: ["淀粉"] },
    { name: '鸡蛋', code: 'jd', exchange: '大连', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 4300, note: '报价为元/500千克，此处按吨近似折算' },
    { name: '生猪', code: 'lh', exchange: '大连', unitText: '16吨/手', unitNum: 16, unitName: '吨', priceUnit: '元/吨', margin: 0.08, refPrice: 15000, note: '' },
    { name: '铁矿石', code: 'i', exchange: '大连', unitText: '100吨/手', unitNum: 100, unitName: '吨', priceUnit: '元/吨', margin: 0.11, refPrice: 780, note: '', alias: ["铁矿"] },
    { name: '焦炭', code: 'j', exchange: '大连', unitText: '100吨/手', unitNum: 100, unitName: '吨', priceUnit: '元/吨', margin: 0.20, refPrice: 1900, note: '', alias: ["冶金焦"] },
    { name: '焦煤', code: 'jm', exchange: '大连', unitText: '60吨/手', unitNum: 60, unitName: '吨', priceUnit: '元/吨', margin: 0.12, refPrice: 1350, note: '' },
    { name: '聚乙烯', code: 'l', exchange: '大连', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 8100, note: '' },
    { name: '聚氯乙烯', code: 'v', exchange: '大连', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 5700, note: '' },
    { name: '聚丙烯', code: 'pp', exchange: '大连', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 7400, note: '' },
    { name: '乙二醇', code: 'eg', exchange: '大连', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 4600, note: '' },
    { name: '苯乙烯', code: 'eb', exchange: '大连', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 8200, note: '' },
    { name: '液化石油气', code: 'pg', exchange: '大连', unitText: '20吨/手', unitNum: 20, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 4700, note: '' },
    { name: '原木', code: 'lg', exchange: '大连', unitText: '90立方米/手', unitNum: 90, unitName: '立方米', priceUnit: '元/立方米', margin: 0.08, refPrice: 900, note: '' },
    // ---- 郑商所（郑州商品交易所） ----
    { name: '白糖', code: 'sr', exchange: '郑州', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.06, refPrice: 6000, note: '', alias: ["白砂糖"] },
    { name: '棉花', code: 'cf', exchange: '郑州', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 14000, note: '', alias: ["郑棉"] },
    { name: '菜粕', code: 'rm', exchange: '郑州', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 2400, note: '', alias: ["菜籽粕", "油菜籽粕"] },
    { name: '菜油', code: 'oi', exchange: '郑州', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 9300, note: '' },
    { name: 'PTA', code: 'ta', exchange: '郑州', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 4800, note: '' },
    { name: '甲醇', code: 'ma', exchange: '郑州', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 2400, note: '', alias: ["郑醇"] },
    { name: '玻璃', code: 'fg', exchange: '郑州', unitText: '20吨/手', unitNum: 20, unitName: '吨', priceUnit: '元/吨', margin: 0.10, refPrice: 1150, note: '', alias: ["浮法玻璃"] },
    { name: '纯碱', code: 'sa', exchange: '郑州', unitText: '20吨/手', unitNum: 20, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 2100, note: '', alias: ["重碱"] },
    { name: '尿素', code: 'ur', exchange: '郑州', unitText: '20吨/手', unitNum: 20, unitName: '吨', priceUnit: '元/吨', margin: 0.08, refPrice: 1750, note: '' },
    { name: '短纤', code: 'pf', exchange: '郑州', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 6800, note: '' },
    { name: '苹果', code: 'ap', exchange: '郑州', unitText: '10吨/手', unitNum: 10, unitName: '吨', priceUnit: '元/吨', margin: 0.10, refPrice: 7600, note: '' },
    { name: '红枣', code: 'cj', exchange: '郑州', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 10000, note: '' },
    { name: '花生', code: 'pk', exchange: '郑州', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.07, refPrice: 8300, note: '' },
    { name: '烧碱', code: 'sh', exchange: '郑州', unitText: '30吨/手', unitNum: 30, unitName: '吨', priceUnit: '元/吨', margin: 0.08, refPrice: 2800, note: '' },
    { name: '硅铁', code: 'sf', exchange: '郑州', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.08, refPrice: 6400, note: '' },
    { name: '锰硅', code: 'sm', exchange: '郑州', unitText: '5吨/手', unitNum: 5, unitName: '吨', priceUnit: '元/吨', margin: 0.09, refPrice: 6600, note: '' },
    // ---- 中金所（中国金融期货交易所） ----
    { name: '沪深300', code: 'if', exchange: '中金所', unitText: '300元/点', unitNum: 300, unitName: '点', priceUnit: '点', margin: 0.12, refPrice: 3900, note: '', alias: ["IF", "沪深300指数"] },
    { name: '中证500', code: 'ic', exchange: '中金所', unitText: '200元/点', unitNum: 200, unitName: '点', priceUnit: '点', margin: 0.12, refPrice: 5800, note: '' },
    { name: '中证1000', code: 'im', exchange: '中金所', unitText: '200元/点', unitNum: 200, unitName: '点', priceUnit: '点', margin: 0.12, refPrice: 6300, note: '' },
    { name: '上证50', code: 'ih', exchange: '中金所', unitText: '300元/点', unitNum: 300, unitName: '点', priceUnit: '点', margin: 0.12, refPrice: 2700, note: '' },
    { name: '10年期国债', code: 't', exchange: '中金所', unitText: '10000元/点', unitNum: 10000, unitName: '元', priceUnit: '元', margin: 0.02, refPrice: 108, note: '' }
  ];

  /** 交易所简称 -> 完整名称 */
  var EXCHANGE_FULL = {
    '上海': '上海期货交易所',
    '能源': '上海国际能源交易中心',
    '广州': '广州期货交易所',
    '大连': '大连商品交易所',
    '郑州': '郑州商品交易所',
    '中金所': '中国金融期货交易所'
  };

  var quickInput = document.getElementById("quick-input");
  var quickBtn = document.getElementById("quick-btn");
  var quickError = document.getElementById("quick-error");
  var quickResults = document.getElementById("quick-results");

  /**
   * 品种匹配：支持中文名/文华代码/别名匹配，大小写不敏感。
   * 匹配优先级：原文精确(code/name/alias) > 原文包含 > 别名包含
   *           > 去交易所前缀(沪/连/郑/广/北) > 剥离数字尾缀后重试以上全部。
   */
  function matchProducts(keyword) {
    var raw = keyword.trim();
    var k = raw.toLowerCase();
    if (!k) return [];
    var PREFIXS = ["沪", "连", "郑", "广", "北"];

    // 单轮匹配：依次尝试精确 / name·code包含 / 别名包含
    function matchOnce(text) {
      var t = text.trim();
      var tk = t.toLowerCase();
      if (!t) return [];
      var exact = PROD_DB.filter(function (p) {
        if (p.code === tk || p.name === t) return true;
        return (p.alias || []).some(function (a) {
          return a.toLowerCase() === tk;
        });
      });
      if (exact.length > 0) return exact;
      var contains = PROD_DB.filter(function (p) {
        return p.name.toLowerCase().indexOf(tk) !== -1 || p.code.indexOf(tk) !== -1;
      });
      if (contains.length > 0) return contains;
      var aliasHits = PROD_DB.filter(function (p) {
        return (p.alias || []).some(function (a) {
          return a.toLowerCase().indexOf(tk) !== -1;
        });
      });
      if (aliasHits.length > 0) return aliasHits;
      return [];
    }

    function stripPrefix(s) {
      for (var i = 0; i < PREFIXS.length; i++) {
        if (s.indexOf(PREFIXS[i]) === 0) return s.slice(PREFIXS[i].length).trim();
      }
      return s;
    }

    // 1) 原文
    var result = matchOnce(raw);
    if (result.length > 0) return result;
    // 2) 原文去交易所前缀
    var noPrefix = stripPrefix(raw);
    if (noPrefix !== raw) {
      result = matchOnce(noPrefix);
      if (result.length > 0) return result;
    }
    // 3) 剥离末尾数字尾缀（含空格）后，重试原文与去前缀
    var strippedRaw = raw.replace(/[\d\s]+$/, "").trim();
    if (strippedRaw && strippedRaw !== raw) {
      result = matchOnce(strippedRaw);
      if (result.length > 0) return result;
      var strippedNoPrefix = stripPrefix(strippedRaw);
      if (strippedNoPrefix !== strippedRaw) {
        result = matchOnce(strippedNoPrefix);
        if (result.length > 0) return result;
      }
    }
    return [];
  }

  /** 构造单字段条目 */
  function buildItem(label, value, cls) {
    var item = document.createElement("div");
    item.className = "qc-item";
    var l = document.createElement("span");
    l.className = "qc-label";
    l.textContent = label;
    var v = document.createElement("span");
    v.className = "qc-value" + (cls ? " " + cls : "");
    v.textContent = value;
    item.appendChild(l);
    item.appendChild(v);
    return item;
  }

  /** 根据卡片内参考价格实时重算合约价值与一手保证金 */
  function updateProductValues(card, p) {
    var price = parseFloat(card.querySelector(".qc-price").value);
    if (isNaN(price) || price <= 0) price = p.refPrice;
    var contractValue = price * p.unitNum;
    var margin = contractValue * p.margin;
    var moneyEls = card.querySelectorAll(".qc-money");
    moneyEls[0].textContent = formatCurrency(contractValue);
    moneyEls[1].textContent = formatCurrency(margin);
  }

  /** 渲染单个品种卡片 */
  function renderProductCard(p) {
    var card = document.createElement("div");
    card.className = "quick-card";

    // 表头：名称 + 代码 + 交易所
    var head = document.createElement("div");
    head.className = "quick-card-head";
    var name = document.createElement("span");
    name.className = "quick-name";
    name.textContent = p.name + " " + p.code.toUpperCase();
    var exch = document.createElement("span");
    exch.className = "quick-exch";
    exch.textContent = EXCHANGE_FULL[p.exchange] || p.exchange;
    head.appendChild(name);
    head.appendChild(exch);
    card.appendChild(head);

    // 信息网格
    var grid = document.createElement("div");
    grid.className = "quick-grid";

    grid.appendChild(buildItem("交易单位", p.unitText, ""));

    // 参考价格（可编辑）
    var priceCell = buildItem("参考价格", "", "");
    var valueWrap = priceCell.querySelector(".qc-value");
    valueWrap.textContent = "";
    var priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.className = "qc-price";
    priceInput.step = "any";
    priceInput.min = "0";
    priceInput.value = p.refPrice;
    valueWrap.appendChild(priceInput);
    var priceUnit = document.createElement("span");
    priceUnit.className = "qc-unit";
    priceUnit.textContent = p.priceUnit;
    valueWrap.appendChild(priceUnit);

    grid.appendChild(priceCell);
    grid.appendChild(buildItem("每手合约价值", "", "qc-money"));
    grid.appendChild(buildItem("一手保证金估算", "", "qc-money qc-margin-val"));

    card.appendChild(grid);

    // 特殊标注
    if (p.note) {
      var note = document.createElement("div");
      note.className = "qc-note";
      note.textContent = p.note;
      card.appendChild(note);
    }

    // 价格变化实时重算
    priceInput.addEventListener("input", function () {
      updateProductValues(card, p);
    });

    updateProductValues(card, p);
    return card;
  }

  /** 执行查询并渲染结果 */
  function runQuickSearch() {
    var products = matchProducts(quickInput.value);
    quickResults.innerHTML = "";
    quickError.hidden = true;

    if (products.length === 0) {
      quickError.textContent = "未找到该品种，请检查名称或代码";
      quickError.hidden = false;
      return;
    }

    var shown = products.slice(0, 20);
    shown.forEach(function (p) {
      quickResults.appendChild(renderProductCard(p));
    });

    if (products.length > 20) {
      var tip = document.createElement("p");
      tip.className = "quick-hint";
      tip.textContent = "匹配品种较多（共 " + products.length + " 个），已展示前 20 个，请细化关键词。";
      quickResults.appendChild(tip);
    }
  }

  quickBtn.addEventListener("click", runQuickSearch);
  quickInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      runQuickSearch();
    }
  });

  // 页面首次展示：默认查询"螺纹钢"
  quickInput.value = "螺纹钢";
  runQuickSearch();

  // ---------- 输入框清除按钮 ----------
  function clearQuickResults() {
    quickResults.innerHTML = "";
    quickError.hidden = true;
  }

  [balanceInput, entryInput, stopInput, unitsInput, quickInput].forEach(function (input) {
    var clearBtn = input.parentNode.querySelector(".clear-btn");
    if (!clearBtn) return;

    function syncClearBtn() {
      clearBtn.hidden = input.value.trim() === "";
    }

    input.addEventListener("input", syncClearBtn);

    clearBtn.addEventListener("click", function (e) {
      e.preventDefault();
      input.value = "";
      syncClearBtn();
      if (input === quickInput) {
        clearQuickResults();
      } else {
        runCalculation();
      }
      input.focus();
    });

    syncClearBtn();
  });
})();
