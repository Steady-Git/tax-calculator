import { useState, useCallback } from "react";

const TAX_BRACKETS = [
  { max: 300_000_000, baseRate: 0.005, baseDeduction: 0, heavyRate: 0.005, heavyDeduction: 0 },
  { max: 600_000_000, baseRate: 0.007, baseDeduction: 600_000, heavyRate: 0.007, heavyDeduction: 600_000 },
  { max: 1_200_000_000, baseRate: 0.010, baseDeduction: 2_400_000, heavyRate: 0.010, heavyDeduction: 2_400_000 },
  { max: 2_500_000_000, baseRate: 0.013, baseDeduction: 6_000_000, heavyRate: 0.020, heavyDeduction: 14_400_000 },
  { max: 5_000_000_000, baseRate: 0.015, baseDeduction: 11_000_000, heavyRate: 0.030, heavyDeduction: 39_400_000 },
  { max: 9_400_000_000, baseRate: 0.020, baseDeduction: 36_000_000, heavyRate: 0.040, heavyDeduction: 89_400_000 },
  { max: Infinity, baseRate: 0.027, baseDeduction: 101_800_000, heavyRate: 0.050, heavyDeduction: 183_400_000 },
];

function fmt(n) {
  if (n === null || n === undefined) return "-";
  return Math.round(n).toLocaleString("ko-KR") + "원";
}

function parseNum(str) {
  const n = Number(str.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function calcPropertyTax(price) {
  // 재산세 부과세액 계산 (주택 기준)
  const base = price * 0.6;
  if (price <= 600_000_000) {
    return base * 0.001;
  } else if (price <= 1_500_000_000) {
    return base * 0.002 - 600_000;
  } else {
    return base * 0.004 - 3_600_000;
  }
}

export default function App() {
  const [houseType, setHouseType] = useState("1"); // 1세대1주택 여부
  const [houses, setHouses] = useState([{ id: 1, price: "" }]);
  const [prevYearTax, setPrevYearTax] = useState("");
  const [result, setResult] = useState(null);

  const addHouse = () => {
    setHouses(prev => [...prev, { id: Date.now(), price: "" }]);
  };

  const removeHouse = (id) => {
    setHouses(prev => prev.filter(h => h.id !== id));
  };

  const updateHouse = (id, val) => {
    setHouses(prev => prev.map(h => h.id === id ? { ...h, price: val } : h));
  };

  const calculate = useCallback(() => {
    const prices = houses.map(h => parseNum(h.price));
    const total = prices.reduce((a, b) => a + b, 0);
    const count = houses.length;
    const isOneHousehold = houseType === "1";
    const deduction = isOneHousehold ? 1_200_000_000 : 900_000_000;
    const fairMarketRatio = 0.60;

    // 과세표준
    const excessAmount = Math.max(0, total - deduction);
    const taxBase = excessAmount * fairMarketRatio;

    if (taxBase <= 0) {
      setResult({ taxBase: 0, message: "과세표준이 0 이하로 종합부동산세 납부 대상이 아닙니다." });
      return;
    }

    // 세율 결정 (3주택 이상 & 과세표준 12억 초과 시 중과세율)
    const isHeavy = count >= 3 && taxBase > 1_200_000_000;
    const bracket = TAX_BRACKETS.find(b => taxBase <= b.max);
    const rate = isHeavy ? bracket.heavyRate : bracket.baseRate;
    const progressiveDeduction = isHeavy ? bracket.heavyDeduction : bracket.baseDeduction;

    // 종합부동산세액
    const crtTax = taxBase * rate - progressiveDeduction;

    // 공제할 재산세액 계산
    const propTaxTotal = prices.reduce((sum, p) => sum + calcPropertyTax(p), 0);
    const numerator = taxBase * fairMarketRatio * rate;  // 과세표준 × 재산세공정시장가액비율 × 재산세율 근사
    const denominator = prices.reduce((sum, p) => sum + p * 0.6 * (p <= 600_000_000 ? 0.001 : p <= 1_500_000_000 ? 0.002 : 0.004), 0);
    // 정확한 공식: 재산세부과세액 × (종합부동산세과세표준×재산세공정시장가액비율×재산세율) / 전체주택재산세
    // 간략화: 공제재산세 = 재산세부과세액합 × (종부세과세표준 / 전체주택공정시장가액기반)
    const totalPropTaxBase = prices.reduce((sum, p) => sum + p * 0.6, 0);
    const denomForDeduction = prices.reduce((sum, p) => {
      const b = p * 0.6;
      return sum + (p <= 600_000_000 ? b * 0.001 : p <= 1_500_000_000 ? b * 0.002 - 600_000 : b * 0.004 - 3_600_000);
    }, 0);
    // 공제할 재산세액 = 재산세부과세액 × (종부세과세표준 × 60% × 재산세율) / 전체주택재산세
    // 아래는 책의 공식대로 근사 계산
    const deductiblePropertyTax = denomForDeduction > 0
      ? propTaxTotal * (taxBase * 0.6 * rate) / denomForDeduction
      : 0;

    // 산출세액
    const computedTax = Math.max(0, crtTax - Math.min(deductiblePropertyTax, crtTax));

    // 세부담상한 (직전연도 세액 입력 시)
    const prevTotal = parseNum(prevYearTax);
    const taxLimit = prevTotal > 0 ? prevTotal * 1.5 : null;
    const finalTax = taxLimit !== null ? Math.min(computedTax, taxLimit) : computedTax;

    // 납부세액 & 농어촌특별세
    const ruralTax = finalTax * 0.20;
    const totalBurden = finalTax + ruralTax;

    setResult({
      total,
      deduction,
      excessAmount,
      taxBase,
      isHeavy,
      rate,
      progressiveDeduction,
      crtTax,
      propTaxTotal,
      deductiblePropertyTax,
      computedTax,
      taxLimit,
      finalTax,
      ruralTax,
      totalBurden,
    });
  }, [houses, houseType, prevYearTax]);

  const styles = {
    app: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
      fontFamily: "'Noto Sans KR', 'Pretendard', sans-serif",
      padding: "2rem 1rem",
      color: "#e8f4f8",
    },
    card: {
      maxWidth: 680,
      margin: "0 auto",
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px)",
      borderRadius: 24,
      border: "1px solid rgba(255,255,255,0.12)",
      overflow: "hidden",
    },
    header: {
      padding: "2rem 2rem 1.5rem",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      background: "linear-gradient(135deg, rgba(0,180,219,0.15), rgba(0,131,176,0.1))",
    },
    title: {
      fontSize: "1.7rem",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      color: "#fff",
      margin: 0,
    },
    subtitle: {
      fontSize: "0.85rem",
      color: "rgba(255,255,255,0.5)",
      marginTop: 6,
    },
    body: { padding: "1.8rem 2rem" },
    sectionLabel: {
      fontSize: "0.75rem",
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "rgba(100,200,255,0.7)",
      marginBottom: 10,
      marginTop: 20,
    },
    radioGroup: { display: "flex", gap: 10, marginBottom: 4 },
    radioBtn: (active) => ({
      flex: 1,
      padding: "10px 0",
      borderRadius: 10,
      border: active ? "1.5px solid #00b4db" : "1.5px solid rgba(255,255,255,0.15)",
      background: active ? "rgba(0,180,219,0.18)" : "rgba(255,255,255,0.04)",
      color: active ? "#00d4ff" : "rgba(255,255,255,0.6)",
      fontWeight: active ? 700 : 400,
      fontSize: "0.9rem",
      cursor: "pointer",
      transition: "all 0.2s",
      textAlign: "center",
    }),
    houseRow: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 8,
    },
    inputWrap: {
      flex: 1,
      position: "relative",
    },
    input: {
      width: "100%",
      padding: "11px 50px 11px 14px",
      borderRadius: 10,
      border: "1.5px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.06)",
      color: "#fff",
      fontSize: "0.95rem",
      outline: "none",
      boxSizing: "border-box",
    },
    inputSuffix: {
      position: "absolute",
      right: 12,
      top: "50%",
      transform: "translateY(-50%)",
      color: "rgba(255,255,255,0.4)",
      fontSize: "0.8rem",
    },
    removeBtn: {
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid rgba(255,80,80,0.4)",
      background: "rgba(255,80,80,0.1)",
      color: "#ff8080",
      cursor: "pointer",
      fontSize: "1rem",
    },
    addBtn: {
      width: "100%",
      padding: "10px",
      marginTop: 4,
      borderRadius: 10,
      border: "1.5px dashed rgba(255,255,255,0.2)",
      background: "transparent",
      color: "rgba(255,255,255,0.5)",
      cursor: "pointer",
      fontSize: "0.9rem",
    },
    calcBtn: {
      width: "100%",
      padding: "14px",
      marginTop: 24,
      borderRadius: 12,
      border: "none",
      background: "linear-gradient(135deg, #00b4db, #0083b0)",
      color: "#fff",
      fontWeight: 800,
      fontSize: "1.05rem",
      cursor: "pointer",
      letterSpacing: "0.03em",
      boxShadow: "0 4px 20px rgba(0,180,219,0.3)",
    },
    resultCard: {
      marginTop: 28,
      borderRadius: 16,
      border: "1px solid rgba(0,180,219,0.3)",
      overflow: "hidden",
      background: "rgba(0,180,219,0.06)",
    },
    resultHeader: {
      padding: "14px 20px",
      background: "rgba(0,180,219,0.12)",
      fontSize: "0.8rem",
      fontWeight: 700,
      letterSpacing: "0.08em",
      color: "#00d4ff",
      textTransform: "uppercase",
    },
    resultRows: { padding: "8px 0" },
    resultRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "9px 20px",
      fontSize: "0.88rem",
    },
    resultLabel: { color: "rgba(255,255,255,0.6)" },
    resultValue: { fontWeight: 600, color: "#e8f4f8" },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" },
    totalRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 20px",
      background: "rgba(0,180,219,0.1)",
      borderTop: "1px solid rgba(0,180,219,0.25)",
    },
    totalLabel: { fontWeight: 700, fontSize: "1rem", color: "#00d4ff" },
    totalValue: { fontWeight: 800, fontSize: "1.2rem", color: "#fff" },
    badge: (color) => ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      background: color === "heavy" ? "rgba(255,100,100,0.15)" : "rgba(0,220,130,0.15)",
      color: color === "heavy" ? "#ff8080" : "#00dc82",
      fontSize: "0.75rem",
      fontWeight: 700,
      marginLeft: 8,
    }),
    msgBox: {
      padding: "16px 20px",
      color: "rgba(255,255,255,0.6)",
      fontSize: "0.9rem",
      lineHeight: 1.6,
    },
  };

  return (
    <div style={styles.app}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>🏠 종합부동산세 계산기</h1>
          <p style={styles.subtitle}>2023년 개정 기준 · 주택분 종합부동산세</p>
        </div>

        <div style={styles.body}>
          {/* 보유 유형 */}
          <div style={styles.sectionLabel}>보유 유형</div>
          <div style={styles.radioGroup}>
            {[
              { v: "1", label: "1세대 1주택자", sub: "공제 12억원" },
              { v: "0", label: "일반 / 다주택자", sub: "공제 9억원" },
            ].map(({ v, label, sub }) => (
              <button
                key={v}
                style={styles.radioBtn(houseType === v)}
                onClick={() => setHouseType(v)}
              >
                {label}<br />
                <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{sub}</span>
              </button>
            ))}
          </div>

          {/* 주택 공시가격 입력 */}
          <div style={styles.sectionLabel}>주택별 공시가격 입력</div>
          {houses.map((h, i) => (
            <div key={h.id} style={styles.houseRow}>
              <div style={styles.inputWrap}>
                <input
                  style={styles.input}
                  type="text"
                  placeholder={`주택 ${i + 1} 공시가격 (예: 800000000)`}
                  value={h.price}
                  onChange={e => updateHouse(h.id, e.target.value)}
                />
                <span style={styles.inputSuffix}>원</span>
              </div>
              {houses.length > 1 && (
                <button style={styles.removeBtn} onClick={() => removeHouse(h.id)}>✕</button>
              )}
            </div>
          ))}
          <button style={styles.addBtn} onClick={addHouse}>+ 주택 추가</button>

          {/* 직전연도 세액 (선택) */}
          <div style={styles.sectionLabel}>직전연도 재산세+종합부동산세 합계 <span style={{ opacity: 0.5 }}>(선택)</span></div>
          <div style={styles.inputWrap}>
            <input
              style={styles.input}
              type="text"
              placeholder="세부담상한 계산용 (입력 시 150% 한도 적용)"
              value={prevYearTax}
              onChange={e => setPrevYearTax(e.target.value)}
            />
            <span style={styles.inputSuffix}>원</span>
          </div>

          <button style={styles.calcBtn} onClick={calculate}>계산하기</button>

          {/* 결과 */}
          {result && (
            <div style={styles.resultCard}>
              <div style={styles.resultHeader}>계산 결과</div>
              {result.message ? (
                <div style={styles.msgBox}>{result.message}</div>
              ) : (
                <>
                  <div style={styles.resultRows}>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>주택공시가격 합계</span>
                      <span style={styles.resultValue}>{fmt(result.total)}</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>공제금액</span>
                      <span style={styles.resultValue}>- {fmt(result.deduction)}</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>공제초과금액</span>
                      <span style={styles.resultValue}>{fmt(result.excessAmount)}</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>과세표준 (×60%)</span>
                      <span style={styles.resultValue}>{fmt(result.taxBase)}</span>
                    </div>
                    <div style={styles.divider} />
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>
                        적용 세율
                        <span style={styles.badge(result.isHeavy ? "heavy" : "normal")}>
                          {result.isHeavy ? "중과세율" : "기본세율"}
                        </span>
                      </span>
                      <span style={styles.resultValue}>{(result.rate * 100).toFixed(1)}%</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>종합부동산세액 (누진공제 후)</span>
                      <span style={styles.resultValue}>{fmt(result.crtTax)}</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>공제할 재산세액</span>
                      <span style={styles.resultValue}>- {fmt(result.deductiblePropertyTax)}</span>
                    </div>
                    <div style={styles.divider} />
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>산출세액</span>
                      <span style={styles.resultValue}>{fmt(result.computedTax)}</span>
                    </div>
                    {result.taxLimit !== null && (
                      <div style={styles.resultRow}>
                        <span style={styles.resultLabel}>세부담상한액 (전년도×150%)</span>
                        <span style={styles.resultValue}>{fmt(result.taxLimit)}</span>
                      </div>
                    )}
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>종합부동산세 납부세액</span>
                      <span style={styles.resultValue}>{fmt(result.finalTax)}</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>농어촌특별세 (×20%)</span>
                      <span style={styles.resultValue}>{fmt(result.ruralTax)}</span>
                    </div>
                  </div>
                  <div style={styles.totalRow}>
                    <span style={styles.totalLabel}>총 부담세액</span>
                    <span style={styles.totalValue}>{fmt(result.totalBurden)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(255,200,0,0.07)", border: "1px solid rgba(255,200,0,0.15)", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
            ⚠️ 본 계산기는 참고용이며, 세액공제(고령자·장기보유) 및 개별 감면은 반영되지 않습니다. 정확한 세액은 국세청 홈택스의 종합부동산세 간이세액계산 서비스를 이용하세요.
          </div>
        </div>
      </div>
    </div>
  );
}
