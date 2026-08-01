/*
 * 手取り額の概算計算ロジック。DOM・windowの状態には触れない純粋関数のみで構成する。
 * すべて「目安」の概算であり、実際の控除・保険料率は自治体・加入保険者・年度により異なる。
 */

// 給与所得控除(令和2年分以降の速算表)
function salaryIncomeDeduction(income) {
  if (income <= 1625000) return 550000;
  if (income <= 1800000) return income * 0.4 - 100000;
  if (income <= 3600000) return income * 0.3 + 80000;
  if (income <= 6600000) return income * 0.2 + 440000;
  if (income <= 8500000) return income * 0.1 + 1100000;
  return 1950000;
}

// 所得税の超過累進税率表(2024年分、復興特別所得税2.1%は別途上乗せ)
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
  const healthRate = 0.0499; // 健康保険料(従業員負担分、全国平均目安)
  const careRate = age40to64 ? 0.008 : 0; // 介護保険料(40〜64歳)
  const pensionRate = 0.0915; // 厚生年金保険料(従業員負担分、全国一律)
  const employmentRate = 0.006; // 雇用保険料(従業員負担分、2024年度一般事業)
  const socialInsurance = Math.round(grossIncome * (healthRate + careRate + pensionRate + employmentRate));

  const salaryDeduction = salaryIncomeDeduction(grossIncome);
  const basicDeductionIncomeTax = 480000;
  const dependentDeductionIncomeTax = dependents * 380000;

  const taxableIncomeForIncomeTax = Math.max(
    0,
    grossIncome - salaryDeduction - socialInsurance - basicDeductionIncomeTax - dependentDeductionIncomeTax
  );
  const tax = incomeTax(taxableIncomeForIncomeTax);

  // 住民税(所得割10%+均等割5,000円目安。基礎控除43万円・扶養控除33万円/人)
  const basicDeductionResidentTax = 430000;
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    grossIncome - salaryDeduction - socialInsurance - basicDeductionResidentTax - dependentDeductionResidentTax
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

  // 国民年金保険料(2024年度目安、定額)
  const nationalPension = 204000;

  // 国民健康保険料(自治体差が非常に大きいため、事業所得の約10%を目安とし上限額でキャップ)
  const nationalHealthInsuranceCap = 1060000; // 医療分+支援分+介護分の年間上限目安(2024年度水準)
  const nationalHealthInsurance = Math.min(nationalHealthInsuranceCap, Math.round(businessIncome * 0.1));

  const socialInsurance = nationalPension + nationalHealthInsurance;

  const basicDeductionIncomeTax = 480000;
  const dependentDeductionIncomeTax = dependents * 380000;
  const taxableIncomeForIncomeTax = Math.max(
    0,
    businessIncome - socialInsurance - basicDeductionIncomeTax - dependentDeductionIncomeTax
  );
  const tax = incomeTax(taxableIncomeForIncomeTax);

  const basicDeductionResidentTax = 430000;
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
