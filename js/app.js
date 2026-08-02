/*
 * フォームの入力受付・DOM描画。計算ロジックは calculate.js に委譲する。
 */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function yen(n) {
  return Math.round(n).toLocaleString("ja-JP") + "円";
}

const form = document.getElementById("calc-form");
const employmentTypeSelect = document.getElementById("employment_type");
const expenseRateField = document.getElementById("expense-rate-field");
const resultSection = document.getElementById("screen-result");
const introSection = document.getElementById("screen-intro");
const resultBody = document.getElementById("result-body");
const btnRestart = document.getElementById("btn-restart");

function toggleExpenseRateField() {
  expenseRateField.hidden = employmentTypeSelect.value !== "self_employed";
}

employmentTypeSelect.addEventListener("change", toggleExpenseRateField);
toggleExpenseRateField();

function buildCrossLinkBanners(input) {
  const banners = [
    { href: "../insurance-checker/", text: "手取り額が分かったら、必要な保障を保険診断で確認する →" },
    { href: "../furusato-simulator/", text: "実質2,000円で寄附できるふるさと納税の上限額も計算する →" },
    { href: "../retirement-simulator/", text: "将来の退職金の手取り額も計算してみる →" },
  ];
  if (input.employmentType === "self_employed") {
    banners.push({ href: "../subsidy-checker/", text: "自営業・フリーランスの方が使える公的な給付金・補助金を確認する →" });
  } else {
    banners.push({ href: "../sidejob-checker/", text: "収入を増やす副業ジャンルを診断する →" });
    banners.push({ href: "../career-checker/", text: "収入アップにつながる転職エージェントを診断する →" });
  }
  return banners.map((b) => `<a class="cross-link-banner" href="${escapeHtml(b.href)}">${escapeHtml(b.text)}</a>`).join("");
}

function buildResultHtml(r, input) {
  const rows = [];
  if (input.employmentType === "self_employed") {
    rows.push(["額面年収(売上)", yen(r.grossIncome)]);
    rows.push(["必要経費(概算)", "− " + yen(r.expenses)]);
    rows.push(["事業所得(青色申告特別控除後)", yen(r.businessIncome)]);
    rows.push(["国民年金・国民健康保険料(概算)", "− " + yen(r.socialInsurance)]);
  } else {
    rows.push(["額面年収", yen(r.grossIncome)]);
    rows.push(["社会保険料(健康保険・厚生年金・雇用保険)", "− " + yen(r.socialInsurance)]);
  }
  rows.push(["所得税(概算)", "− " + yen(r.incomeTax)]);
  rows.push(["住民税(概算)", "− " + yen(r.residentTax)]);

  const rowsHtml = rows
    .map(([label, value]) => `<div class="result-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`)
    .join("");

  return `
    <div class="result-headline">
      <p class="result-headline__label">手取り年収の目安</p>
      <p class="result-headline__value">${escapeHtml(yen(r.takeHome))}</p>
      <p class="result-headline__sub">月あたり目安 ${escapeHtml(yen(r.takeHomeMonthly))}</p>
    </div>
    <div class="result-breakdown">
      ${rowsHtml}
    </div>
    <div class="result-cross-links">
      ${buildCrossLinkBanners(input)}
    </div>
  `;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const employmentType = formData.get("employment_type");
  const grossIncome = Number(formData.get("gross_income"));
  const age40to64 = formData.get("age40to64") === "on";
  const dependents = Number(formData.get("dependents") || 0);
  const expenseRate = Number(formData.get("expense_rate") || 30) / 100;

  if (!grossIncome || grossIncome <= 0) {
    return;
  }

  const input = { employmentType, grossIncome, age40to64, dependents, expenseRate };
  const result = calcTakeHome(input);

  resultBody.innerHTML = buildResultHtml(result, input);
  introSection.hidden = true;
  resultSection.hidden = false;
});

btnRestart.addEventListener("click", () => {
  resultSection.hidden = true;
  introSection.hidden = false;
});
