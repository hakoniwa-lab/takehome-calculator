/*
 * 手取り額の概算計算ロジック。DOM・windowの状態には触れない純粋関数のみで構成する。
 * すべて「目安」の概算であり、実際の控除・保険料率は自治体・加入保険者・年度により異なる。
 */

// どの年の税金か: 令和8年(2026年)分の所得税と、その所得にかかる令和9年度の住民税。
// 令和8年度税制改正(基礎控除・給与所得控除の引上げ)を反映している。
// 出典: 国税庁 No.1410 給与所得控除・No.1199 基礎控除、財務省「令和8年度税制改正の大綱」

// 給与所得控除(令和8年分・令和9年分)。最低保障額は本則69万円＋令和8・9年の特例5万円＝74万円。
// 住民税も令和9年度分・令和10年度分は同じ74万円(大綱の地方税(1))。
// ※ 収入660万円未満は本来「所得税法別表第五」の4,000円刻みの表を使うが、概算なので式で計算する
function salaryIncomeDeduction(income) {
  if (income <= 2200000) return Math.min(income, 740000);
  if (income <= 3600000) return income * 0.3 + 80000;
  if (income <= 6600000) return income * 0.2 + 440000;
  if (income <= 8500000) return income * 0.1 + 1100000;
  return 1950000;
}

// 所得税の基礎控除(令和8年分・令和9年分)。本人の合計所得金額で変わる。
// 本則62万円に、合計所得489万円以下は42万円・489万円超655万円以下は5万円を加算する特例。
function incomeTaxBasicDeduction(totalIncome) {
  if (totalIncome <= 4890000) return 1040000;
  if (totalIncome <= 6550000) return 670000;
  if (totalIncome <= 23500000) return 620000;
  if (totalIncome <= 24000000) return 480000;
  if (totalIncome <= 24500000) return 320000;
  if (totalIncome <= 25000000) return 160000;
  return 0;
}

// 住民税の基礎控除。所得税と違って引き上げられておらず、43万円のまま。
function residentTaxBasicDeduction(totalIncome) {
  if (totalIncome <= 24000000) return 430000;
  if (totalIncome <= 24500000) return 290000;
  if (totalIncome <= 25000000) return 150000;
  return 0;
}

// 所得税の超過累進税率表(平成27年分以後。令和8年分も同じ。復興特別所得税2.1%は別途上乗せ)。出典: 国税庁 No.2260
const INCOME_TAX_BRACKETS = [
  { limit: 1950000, rate: 0.05, deduction: 0 },
  { limit: 3300000, rate: 0.1, deduction: 97500 },
  { limit: 6950000, rate: 0.2, deduction: 427500 },
  { limit: 9000000, rate: 0.23, deduction: 636000 },
  { limit: 18000000, rate: 0.33, deduction: 1536000 },
  { limit: 40000000, rate: 0.4, deduction: 2796000 },
  { limit: Infinity, rate: 0.45, deduction: 4796000 },
];

function incomeTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.limit);
  const base = taxableIncome * bracket.rate - bracket.deduction;
  return Math.max(0, Math.round(base * 1.021)); // 復興特別所得税2.1%を上乗せ
}

// 会社員(厚生年金・協会けんぽ)の手取り概算
function calcEmployee(input) {
  const { grossIncome, age40to64, dependents } = input;

  // 社会保険料(協会けんぽ全国平均目安・厚生年金・雇用保険。標準報酬月額表の等級は考慮せず年収に定率適用する簡易計算)
  // 料率は2026年度(令和8年度)。本人負担は労使折半の半分
  const healthRate = 0.0495; // 健康保険料(協会けんぽ全国平均9.90%の半分)
  const childSupportRate = 0.00115; // 子ども・子育て支援金(0.23%の半分。2026年4月分から健康保険料と一緒に徴収)
  const careRate = age40to64 ? 0.0081 : 0; // 介護保険料(40〜64歳。1.62%の半分)
  const pensionRate = 0.0915; // 厚生年金保険料(18.3%の半分。2017年9月から固定)
  const employmentRate = 0.005; // 雇用保険料(一般の事業の労働者負担 5/1,000)
  const socialInsurance = Math.round(grossIncome * (healthRate + childSupportRate + careRate + pensionRate + employmentRate));

  const salaryDeduction = salaryIncomeDeduction(grossIncome);
  const employmentIncome = Math.max(0, grossIncome - salaryDeduction); // 給与所得＝合計所得金額(基礎控除の判定に使う)
  const basicDeductionIncomeTax = incomeTaxBasicDeduction(employmentIncome);
  const dependentDeductionIncomeTax = dependents * 380000;

  const taxableIncomeForIncomeTax = Math.max(
    0,
    employmentIncome - socialInsurance - basicDeductionIncomeTax - dependentDeductionIncomeTax
  );
  const tax = incomeTax(taxableIncomeForIncomeTax);

  // 住民税(所得割10%+均等割5,000円目安。基礎控除43万円・扶養控除33万円/人)
  const basicDeductionResidentTax = residentTaxBasicDeduction(employmentIncome);
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    employmentIncome - socialInsurance - basicDeductionResidentTax - dependentDeductionResidentTax
  );
  const residentTax = taxableIncomeForResidentTax > 0 ? Math.round(taxableIncomeForResidentTax * 0.1) + 5000 : 0;

  const takeHome = grossIncome - socialInsurance - tax - residentTax;

  return {
    grossIncome,
    socialInsurance,
    incomeTax: tax,
    residentTax,
    takeHome,
    takeHomeMonthly: Math.round(takeHome / 12),
  };
}

// 自営業・フリーランス(国民健康保険・国民年金)の手取り概算
// 経費・青色申告特別控除は個人差が非常に大きいため、簡易的な仮定を置いた粗い目安値
function calcSelfEmployed(input) {
  const { grossIncome, expenseRate, dependents } = input;

  const expenses = Math.round(grossIncome * expenseRate);
  const blueReturnDeduction = 650000; // 青色申告特別控除(要件を満たす場合の上限額を仮定)
  const businessIncome = Math.max(0, grossIncome - expenses - blueReturnDeduction);

  // 国民年金保険料(2026年度 月17,920円×12か月、定額)
  const nationalPension = 215040;

  // 国民健康保険料(自治体差が非常に大きいため、事業所得の約10%を目安とし上限額でキャップ)
  // 上限は2026年度の賦課限度額: 基礎67万+後期高齢者支援金26万+介護17万+子ども・子育て支援3万=113万円
  const nationalHealthInsuranceCap = 1130000;
  const nationalHealthInsurance = Math.min(nationalHealthInsuranceCap, Math.round(businessIncome * 0.1));

  const socialInsurance = nationalPension + nationalHealthInsurance;

  const basicDeductionIncomeTax = incomeTaxBasicDeduction(businessIncome); // 事業所得＝合計所得金額
  const dependentDeductionIncomeTax = dependents * 380000;
  const taxableIncomeForIncomeTax = Math.max(
    0,
    businessIncome - socialInsurance - basicDeductionIncomeTax - dependentDeductionIncomeTax
  );
  const tax = incomeTax(taxableIncomeForIncomeTax);

  const basicDeductionResidentTax = residentTaxBasicDeduction(businessIncome);
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    businessIncome - socialInsurance - basicDeductionResidentTax - dependentDeductionResidentTax
  );
  const residentTax = taxableIncomeForResidentTax > 0 ? Math.round(taxableIncomeForResidentTax * 0.1) + 5000 : 0;

  const takeHome = grossIncome - expenses - socialInsurance - tax - residentTax;

  return {
    grossIncome,
    expenses,
    businessIncome,
    socialInsurance,
    incomeTax: tax,
    residentTax,
    takeHome,
    takeHomeMonthly: Math.round(takeHome / 12),
  };
}

function calcTakeHome(input) {
  if (input.employmentType === "self_employed") {
    return calcSelfEmployed(input);
  }
  return calcEmployee(input);
}
