import { useState, useEffect } from "react"
import axios from "axios"

const API = "https://woundai-backend-wf1b.onrender.com"

const WOUND_TYPES = [
  { value: "vet_mo",          label: "Vết mổ" },
  { value: "loet_ap_luc",    label: "Loét áp lực" },
  { value: "loet_tinh_mach", label: "Loét tĩnh mạch" },
  { value: "bong_do_2",      label: "Bỏng độ II" },
]
const AGE_GROUPS      = ["18-40", "41-60", "61-75", ">75"]
const DRESSING_OPTIONS = [1,2,3,4,5,6,7]

const EMPTY_FORM = {
  patient_name: "", age_group: "41-60", diabetes: false,
  wound_type: "loet_ap_luc", length_cm: "", width_cm: "", depth_cm: "",
  dressing_per_week: 3, nurse_type: "specialist",
}

const riskColor = {
  low:    { bg: "#E1F5EE", text: "#085041", border: "#1D9E75" },
  medium: { bg: "#FAEEDA", text: "#633806", border: "#EF9F27" },
  high:   { bg: "#FCEBEB", text: "#791F1F", border: "#E24B4A" },
}

export default function App() {
  const [tab,          setTab]          = useState("form")
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [result,       setResult]       = useState(null)
  const [woundId,      setWoundId]      = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState("")
  const [retrainStatus,setRetrainStatus]= useState(null)
  const [confirmModal, setConfirmModal] = useState(false)
  const [healDate,     setHealDate]     = useState("")
  const [healNote,     setHealNote]     = useState("")
  const [healLoading,  setHealLoading]  = useState(false)
  const [healResult,   setHealResult]   = useState(null)

  // Load retrain status khi vào app
  useEffect(() => {
    axios.get(`${API}/retrain-status`)
      .then(r => setRetrainStatus(r.data))
      .catch(() => {})
  }, [])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit() {
    if (!form.patient_name.trim()) { setError("Vui lòng nhập tên bệnh nhân"); return }
    if (!form.length_cm || !form.width_cm || !form.depth_cm) {
      setError("Vui lòng nhập đầy đủ kích thước vết thương"); return
    }
    setError(""); setLoading(true)
    try {
      // Bước 1: Tạo ca mới trong database
      const caseRes = await axios.post(`${API}/cases`, {
        patient_name:      form.patient_name,
        age_group:         form.age_group,
        diabetes:          form.diabetes,
        wound_type:        form.wound_type,
        length_cm:         parseFloat(form.length_cm),
        width_cm:          parseFloat(form.width_cm),
        depth_cm:          parseFloat(form.depth_cm),
        dressing_per_week: parseInt(form.dressing_per_week),
        nurse_type:        form.nurse_type,
      })
      const newWoundId = caseRes.data.wound_id
      setWoundId(newWoundId)

      // Bước 2: Dự báo
      const predRes = await axios.post(`${API}/predict`, {
        ...form,
        wound_id:          newWoundId,
        length_cm:         parseFloat(form.length_cm),
        width_cm:          parseFloat(form.width_cm),
        depth_cm:          parseFloat(form.depth_cm),
        dressing_per_week: parseInt(form.dressing_per_week),
      })
      setResult(predRes.data)
      setTab("result")
    } catch (e) {
      setError("Không kết nối được server. Hãy thử lại sau ít phút.")
    }
    setLoading(false)
  }

  async function handleConfirmHealed() {
    if (!healDate) { alert("Vui lòng chọn ngày lành"); return }
    setHealLoading(true)
    try {
      const res = await axios.post(`${API}/confirm-healed`, {
        wound_id:           woundId,
        actual_healed_date: healDate,
        nurse_note:         healNote,
      })
      setHealResult(res.data)
      setConfirmModal(false)
      // Cập nhật retrain status
      const rs = await axios.get(`${API}/retrain-status`)
      setRetrainStatus(rs.data)
    } catch (e) {
      alert("Lỗi xác nhận: " + (e.response?.data?.detail || e.message))
    }
    setHealLoading(false)
  }

  function handleReset() {
    setForm(EMPTY_FORM); setResult(null); setWoundId(null)
    setTab("form"); setError(""); setHealResult(null)
    setHealDate(""); setHealNote("")
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F2", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #E5E3DC", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#1D9E75", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>+</span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>WoundAI</div>
            <div style={{ fontSize: 11, color: "#888" }}>Hỗ trợ chăm sóc vết thương</div>
          </div>
        </div>
        <div style={{ fontSize: 12, background: "#E1F5EE", padding: "3px 10px", borderRadius: 10, color: "#085041" }}>
          {retrainStatus ? retrainStatus.model_version : "v1.0"}
        </div>
      </div>

      {/* Retrain progress bar */}
      {retrainStatus && (
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E5E3DC", padding: "8px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 4 }}>
            <span>Tiến độ cập nhật mô hình</span>
            <span>{retrainStatus.new_cases}/{retrainStatus.trigger_at} ca · {retrainStatus.progress_pct}%</span>
          </div>
          <div style={{ height: 4, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: 4, width: retrainStatus.progress_pct + "%", background: retrainStatus.progress_pct >= 100 ? "#1D9E75" : "#EF9F27", borderRadius: 2, transition: "width .5s" }} />
          </div>
          {retrainStatus.progress_pct >= 100 && (
            <div style={{ fontSize: 11, color: "#085041", marginTop: 3 }}>✅ Đủ ca — mô hình sẽ được cập nhật tự động</div>
          )}
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 40px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {["form","result"].map(t => (
            <button key={t} onClick={() => t === "result" && result ? setTab(t) : setTab("form")}
              style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer",
                border: "0.5px solid " + (tab === t ? "#1D9E75" : "#ddd"),
                background: tab === t ? "#1D9E75" : "#fff",
                color: tab === t ? "#fff" : "#666" }}>
              {t === "form" ? "Nhập ca" : "Kết quả dự báo"}
            </button>
          ))}
        </div>

        {/* ── FORM ── */}
        {tab === "form" && (
          <div>
            <Section title="Thông tin bệnh nhân">
              <Field label="Họ và tên bệnh nhân">
                <input value={form.patient_name} onChange={e => set("patient_name", e.target.value)}
                  placeholder="Nguyễn Văn A" style={inputStyle} />
              </Field>
              <Row2>
                <Field label="Nhóm tuổi">
                  <select value={form.age_group} onChange={e => set("age_group", e.target.value)} style={inputStyle}>
                    {AGE_GROUPS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="Đái tháo đường">
                  <ToggleBtn options={[["Không", false], ["Có", true]]} value={form.diabetes} onChange={v => set("diabetes", v)} />
                </Field>
              </Row2>
            </Section>

            <Section title="Thông tin vết thương">
              <Field label="Loại vết thương">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {WOUND_TYPES.map(w => (
                    <button key={w.value} onClick={() => set("wound_type", w.value)}
                      style={{ padding: "10px 8px", borderRadius: 8, fontSize: 13, textAlign: "center", cursor: "pointer",
                        border: "0.5px solid " + (form.wound_type === w.value ? "#1D9E75" : "#ddd"),
                        background: form.wound_type === w.value ? "#E1F5EE" : "#fff",
                        color: form.wound_type === w.value ? "#085041" : "#555",
                        fontWeight: form.wound_type === w.value ? 500 : 400 }}>
                      {w.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Row3>
                <Field label="Dài (cm)"><input type="number" value={form.length_cm} onChange={e => set("length_cm", e.target.value)} placeholder="4.2" step="0.1" min="0" style={inputStyle} /></Field>
                <Field label="Rộng (cm)"><input type="number" value={form.width_cm}  onChange={e => set("width_cm",  e.target.value)} placeholder="3.1" step="0.1" min="0" style={inputStyle} /></Field>
                <Field label="Sâu (cm)"><input type="number" value={form.depth_cm}  onChange={e => set("depth_cm",  e.target.value)} placeholder="0.8" step="0.1" min="0" style={inputStyle} /></Field>
              </Row3>
            </Section>

            <Section title="Thông tin chăm sóc">
              <Field label="Thay băng mỗi tuần">
                <div style={{ display: "flex", gap: 6 }}>
                  {DRESSING_OPTIONS.map(n => (
                    <button key={n} onClick={() => set("dressing_per_week", n)}
                      style={{ width: 40, height: 40, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer",
                        border: "0.5px solid " + (form.dressing_per_week === n ? "#1D9E75" : "#ddd"),
                        background: form.dressing_per_week === n ? "#1D9E75" : "#fff",
                        color: form.dressing_per_week === n ? "#fff" : "#555" }}>{n}</button>
                  ))}
                </div>
              </Field>
              <Field label="Người chăm sóc">
                <ToggleBtn options={[["Điều dưỡng chuyên khoa","specialist"],["Điều dưỡng đa khoa","general"]]} value={form.nurse_type} onChange={v => set("nurse_type", v)} />
              </Field>
            </Section>

            {error && <div style={{ background: "#FCEBEB", border: "0.5px solid #E24B4A", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#791F1F", marginBottom: 12 }}>{error}</div>}

            <button onClick={handleSubmit} disabled={loading}
              style={{ width: "100%", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 500, border: "none", cursor: loading ? "not-allowed" : "pointer",
                background: loading ? "#9FE1CB" : "#1D9E75", color: "#fff" }}>
              {loading ? "Đang dự báo..." : "Dự báo thời gian lành →"}
            </button>
          </div>
        )}

        {/* ── KẾT QUẢ ── */}
        {tab === "result" && result && (
          <div>
            {/* Hero */}
            <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #E5E3DC", padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>{form.patient_name} · {WOUND_TYPES.find(w=>w.value===form.wound_type)?.label}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 52, fontWeight: 500, lineHeight: 1 }}>{result.predicted_days}</div>
                  <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>ngày dự báo</div>
                </div>
                <div style={{ paddingBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "#888" }}>Khoảng dao động</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "#555" }}>{result.confidence_low} – {result.confidence_high} ngày</div>
                </div>
              </div>
              <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                background: riskColor[result.risk.level].bg, color: riskColor[result.risk.level].text,
                border: "0.5px solid " + riskColor[result.risk.level].border }}>
                {result.risk.label} · {result.risk.note}
              </div>
            </div>

            {/* SHAP */}
            {result.shap.slowing_factors.length > 0 && (
              <Section title="Yếu tố làm chậm lành">
                {result.shap.slowing_factors.map(f => <ShapRow key={f.feature} factor={f} type="bad" />)}
              </Section>
            )}
            {result.shap.helping_factors.length > 0 && (
              <Section title="Yếu tố giúp lành nhanh hơn">
                {result.shap.helping_factors.map(f => <ShapRow key={f.feature} factor={f} type="good" />)}
              </Section>
            )}

            {/* Gợi ý can thiệp */}
            {result.shap.interventions.length > 0 && (
              <Section title="Gợi ý can thiệp điều dưỡng">
                {result.shap.interventions.map((iv,i) => (
                  <div key={i} style={{ background: "#E1F5EE", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "#0F6E56", fontWeight: 500, marginBottom: 3 }}>
                      {iv.factor} · có thể rút ngắn ~{Math.round(iv.days_saving)} ngày
                    </div>
                    <div style={{ fontSize: 13, color: "#085041" }}>{iv.action}</div>
                  </div>
                ))}
              </Section>
            )}

            {/* Nút xác nhận lành */}
            {!healResult ? (
              <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #E5E3DC", padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Xác nhận kết quả thực tế</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 12, lineHeight: 1.6 }}>
                  Khi vết thương đã lành hoàn toàn, hãy xác nhận để hệ thống học từ kết quả thực tế — giúp mô hình ngày càng chính xác hơn.
                </div>
                <button onClick={() => setConfirmModal(true)}
                  style={{ width: "100%", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer",
                    border: "1px solid #1D9E75", background: "#E1F5EE", color: "#085041" }}>
                  ✅ Xác nhận vết thương đã lành
                </button>
              </div>
            ) : (
              <div style={{ background: "#E1F5EE", borderRadius: 14, border: "0.5px solid #1D9E75", padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#085041", marginBottom: 4 }}>✅ Đã xác nhận lành sau {healResult.actual_days} ngày</div>
                {healResult.retrain_message && (
                  <div style={{ fontSize: 12, color: "#0F6E56", marginTop: 6 }}>{healResult.retrain_message}</div>
                )}
                {healResult.retrain_status && (
                  <div style={{ fontSize: 12, color: "#0F6E56", marginTop: 4 }}>
                    Tiến độ cập nhật mô hình: {healResult.retrain_status.new_cases}/{healResult.retrain_status.trigger_at} ca
                  </div>
                )}
              </div>
            )}

            <button onClick={handleReset}
              style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer",
                background: "#fff", color: "#1D9E75", border: "1px solid #1D9E75" }}>
              Nhập ca mới
            </button>
          </div>
        )}
      </div>

      {/* Modal xác nhận lành */}
      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Xác nhận vết thương đã lành</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>{form.patient_name} · {WOUND_TYPES.find(w=>w.value===form.wound_type)?.label}</div>

            <Field label="Ngày lành thực tế">
              <input type="date" value={healDate} onChange={e => setHealDate(e.target.value)}
                max={today} style={{ ...inputStyle, width: "100%" }} />
            </Field>

            <Field label="Ghi chú điều dưỡng (tuỳ chọn)">
              <textarea value={healNote} onChange={e => setHealNote(e.target.value)}
                placeholder="Tình trạng lành, ghi chú đặc biệt..."
                rows={3} style={{ ...inputStyle, width: "100%", resize: "vertical" }} />
            </Field>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setConfirmModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer",
                  border: "0.5px solid #ddd", background: "#fff", color: "#555" }}>
                Huỷ
              </button>
              <button onClick={handleConfirmHealed} disabled={healLoading}
                style={{ flex: 1, padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer",
                  border: "none", background: healLoading ? "#9FE1CB" : "#1D9E75", color: "#fff" }}>
                {healLoading ? "Đang lưu..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Components ───────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #E5E3DC", padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}
function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 13, color: "#555", marginBottom: 5 }}>{label}</div>{children}</div>
}
function Row2({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
}
function Row3({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>{children}</div>
}
function ToggleBtn({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
      {options.map(([lbl, val]) => (
        <button key={String(val)} onClick={() => onChange(val)}
          style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, cursor: "pointer",
            border: "0.5px solid " + (value === val ? "#1D9E75" : "#ddd"),
            background: value === val ? "#E1F5EE" : "#fff",
            color: value === val ? "#085041" : "#555",
            fontWeight: value === val ? 500 : 400 }}>{lbl}</button>
      ))}
    </div>
  )
}
function ShapRow({ factor, type }) {
  const isBad = type === "bad"
  const pct   = Math.min(100, Math.round(Math.abs(factor.days_impact) / 20 * 100))
  return (
    <div style={{ border: "0.5px solid #E5E3DC", borderRadius: 10, padding: "12px 14px", marginBottom: 8, background: "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{factor.label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: isBad ? "#A32D2D" : "#085041" }}>
          {isBad ? "+" : "−"}{Math.abs(factor.days_impact).toFixed(1)} ngày
        </div>
      </div>
      <div style={{ height: 6, background: "#eee", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: 6, width: pct+"%", borderRadius: 3, background: isBad ? "#E24B4A" : "#1D9E75" }} />
      </div>
      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{factor.explanation}</div>
    </div>
  )
}
const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
  border: "0.5px solid #ddd", background: "#FAFAF8", color: "#1a1a1a",
  outline: "none", boxSizing: "border-box",
}
