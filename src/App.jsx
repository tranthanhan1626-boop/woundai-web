import Stats from "./Stats"
import { useState, useEffect } from "react"
import axios from "axios"

const API = "https://woundai-backend-wf1b.onrender.com"

const WOUND_TYPES = [
  { value: "vet_mo",          label: "Vết mổ" },
  { value: "loet_ap_luc",    label: "Loét áp lực" },
  { value: "loet_tinh_mach", label: "Loét tĩnh mạch" },
  { value: "bong_do_2",      label: "Bỏng độ II" },
]
const AGE_GROUPS       = ["18-40", "41-60", "61-75", ">75"]
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
  const [tab,              setTab]              = useState("form")
  const [form,             setForm]             = useState(EMPTY_FORM)
  const [result,           setResult]           = useState(null)
  const [woundId,          setWoundId]          = useState(null)
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState("")
  const [retrainStatus,    setRetrainStatus]    = useState(null)
  const [confirmModal,     setConfirmModal]     = useState(false)
  const [healDate,         setHealDate]         = useState("")
  const [healNote,         setHealNote]         = useState("")
  const [healLoading,      setHealLoading]      = useState(false)
  const [healResult,       setHealResult]       = useState(null)
  const [historyTab,       setHistoryTab]       = useState(false)
  const [wounds,           setWounds]           = useState([])
  const [selectedWound,    setSelectedWound]    = useState(null)
  const [visits,           setVisits]           = useState([])
  const [findMode,         setFindMode]         = useState(false)
  const [searchId,         setSearchId]         = useState("")
  const [searchLoading,    setSearchLoading]    = useState(false)
  const [searchError,      setSearchError]      = useState("")
  const [foundPatient,     setFoundPatient]     = useState(null)
  const [foundWounds,      setFoundWounds]      = useState([])
  const [selectedOldWound, setSelectedOldWound] = useState(null)
  const [addVisitMode,     setAddVisitMode]     = useState(false)
  const [existingPatient,     setExistingPatient]     = useState(null)
  const [findExistingLoading, setFindExistingLoading] = useState(false)
  const [findExistingError,   setFindExistingError]   = useState("")
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    axios.get(`${API}/retrain-status`)
      .then(r => setRetrainStatus(r.data))
      .catch(() => {})
  }, [])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function loadWounds() {
    setHistoryTab(true); setFindMode(false)
    try {
      const res = await axios.get(`${API}/wounds`)
      setWounds(res.data.wounds)
    } catch { setWounds([]) }
  }

  async function loadVisits(wound) {
    setSelectedWound(wound); setVisits([])
    try {
      const res = await axios.get(`${API}/wounds/${wound.id}/visits`)
      setVisits(res.data.visits)
    } catch { setVisits([]) }
  }

  async function handleSearch() {
    if (!searchId.trim()) { setSearchError("Vui lòng nhập ID bệnh nhân"); return }
    setSearchError(""); setSearchLoading(true); setFoundPatient(null); setFoundWounds([])
    try {
      const res = await axios.get(`${API}/patients/${searchId.trim()}`)
      setFoundPatient(res.data.patient)
      setFoundWounds(res.data.wounds)
    } catch (e) {
      setSearchError(e.response?.status === 404
        ? "Không tìm thấy bệnh nhân với ID này"
        : "Lỗi kết nối — thử lại sau ít phút")
    }
    setSearchLoading(false)
  }

  function handleSelectOldWound(wound) {
    if (wound.status === "healed") return
    setSelectedOldWound(wound)
    setAddVisitMode(true)
    setForm(f => ({ ...f,
      wound_type: wound.wound_type,
      length_cm: "", width_cm: "", depth_cm: "",
      dressing_per_week: 3, nurse_type: "specialist"
    }))
    setError(""); setResult(null); setHealResult(null)
  }

  async function handleAddVisit() {
    if (!form.length_cm || !form.width_cm || !form.depth_cm) {
      setError("Vui lòng nhập đầy đủ kích thước vết thương"); return
    }
    setError(""); setLoading(true)
    try {
      await axios.post(`${API}/wounds/${selectedOldWound.id}/visits`, {
        wound_type:        selectedOldWound.wound_type,
        age_group:         foundPatient.age_group,
        diabetes:          foundPatient.diabetes,
        length_cm:         parseFloat(form.length_cm),
        width_cm:          parseFloat(form.width_cm),
        depth_cm:          parseFloat(form.depth_cm),
        dressing_per_week: parseInt(form.dressing_per_week),
        nurse_type:        form.nurse_type,
      })
      const predRes = await axios.post(`${API}/predict`, {
        wound_id:          selectedOldWound.id,
        wound_type:        selectedOldWound.wound_type,
        age_group:         foundPatient.age_group,
        diabetes:          foundPatient.diabetes,
        length_cm:         parseFloat(form.length_cm),
        width_cm:          parseFloat(form.width_cm),
        depth_cm:          parseFloat(form.depth_cm),
        dressing_per_week: parseInt(form.dressing_per_week),
        nurse_type:        form.nurse_type,
      })
      setResult(predRes.data)
      setWoundId(selectedOldWound.id)
      setTab("result")
    } catch (e) {
      setError("Lỗi: " + (e.response?.data?.detail || "Không kết nối được server"))
    }
    setLoading(false)
  }

  async function handleSubmit() {
    if (!existingPatient && !form.patient_name.trim()) { setError("Vui lòng nhập tên bệnh nhân"); return }
    if (!form.length_cm || !form.width_cm || !form.depth_cm) {
      setError("Vui lòng nhập đầy đủ kích thước vết thương"); return
    }
    setError(""); setLoading(true)
    try {
      const endpoint = existingPatient
        ? `${API}/patients/${existingPatient.id}/wounds`
        : `${API}/cases`
      const caseRes = await axios.post(endpoint, {
        patient_name:      existingPatient ? existingPatient.full_name : form.patient_name,
        age_group:         existingPatient ? existingPatient.age_group : form.age_group,
        diabetes:          existingPatient ? existingPatient.diabetes  : form.diabetes,
        wound_type:        form.wound_type,
        length_cm:         parseFloat(form.length_cm),
        width_cm:          parseFloat(form.width_cm),
        depth_cm:          parseFloat(form.depth_cm),
        dressing_per_week: parseInt(form.dressing_per_week),
        nurse_type:        form.nurse_type,
      })
      const newWoundId = caseRes.data.wound_id
      setWoundId(newWoundId)
      const predRes = await axios.post(`${API}/predict`, {
        wound_id:          newWoundId,
        wound_type:        form.wound_type,
        age_group:         existingPatient ? existingPatient.age_group : form.age_group,
        diabetes:          existingPatient ? existingPatient.diabetes  : form.diabetes,
        length_cm:         parseFloat(form.length_cm),
        width_cm:          parseFloat(form.width_cm),
        depth_cm:          parseFloat(form.depth_cm),
        dressing_per_week: parseInt(form.dressing_per_week),
        nurse_type:        form.nurse_type,
      })
      setResult(predRes.data)
      setTab("result")
    } catch {
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
    setFindMode(false); setSearchId(""); setSearchError("")
    setFoundPatient(null); setFoundWounds([])
    setSelectedOldWound(null); setAddVisitMode(false)
    setExistingPatient(null); setFindExistingError("")
  }
  async function handleFindExisting() {
    const id = form.existingPatientId?.trim()
    if (!id) return
    setFindExistingError(""); setFindExistingLoading(true); setExistingPatient(null)
    try {
      const res = await axios.get(`${API}/patients/${id}`)
      setExistingPatient(res.data.patient)
    } catch (e) {
      setFindExistingError(e.response?.status === 404
        ? "Không tìm thấy bệnh nhân với ID này"
        : "Lỗi kết nối — thử lại sau")
    }
    setFindExistingLoading(false)
  }

  const today = new Date().toISOString().split("T")[0]

  if (showStats) return <Stats onBack={() => setShowStats(false)} />

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
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {["form","result"].map(t => (
            <button key={t} onClick={() => { setHistoryTab(false); setFindMode(false); t === "result" && result ? setTab(t) : setTab("form") }}
              style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer",
                border: "0.5px solid " + (!historyTab && !findMode && tab === t ? "#1D9E75" : "#ddd"),
                background: !historyTab && !findMode && tab === t ? "#1D9E75" : "#fff",
                color: !historyTab && !findMode && tab === t ? "#fff" : "#666" }}>
              {t === "form" ? "Nhập ca mới" : "Kết quả dự báo"}
            </button>
          ))}
          <button onClick={() => { setHistoryTab(false); setFindMode(true); setAddVisitMode(false); setTab("form") }}
            style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "0.5px solid " + (findMode ? "#534AB7" : "#ddd"),
              background: findMode ? "#534AB7" : "#fff",
              color: findMode ? "#fff" : "#666" }}>
            Tìm bệnh nhân cũ
          </button>
          <button onClick={() => setShowStats(true)}
            style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "0.5px solid #ddd", background: "#fff", color: "#666" }}>
            Thống kê
          </button>
          <button onClick={loadWounds}
            style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "0.5px solid " + (historyTab ? "#1D9E75" : "#ddd"),
              background: historyTab ? "#1D9E75" : "#fff",
              color: historyTab ? "#fff" : "#666" }}>
            Lịch sử
          </button>
        </div>

        {/* ── TÌM BỆNH NHÂN CŨ ── */}
        {findMode && !addVisitMode && (
          <div>
            <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #E5E3DC", padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Tìm bệnh nhân theo ID</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 10, lineHeight: 1.6 }}>
                ID bệnh nhân nằm trong tab Lịch sử, bên dưới tên mỗi bệnh nhân.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={searchId} onChange={e => setSearchId(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="Dán ID bệnh nhân vào đây..."
                  style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleSearch} disabled={searchLoading}
                  style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    border: "none", background: searchLoading ? "#9FE1CB" : "#1D9E75", color: "#fff", whiteSpace: "nowrap" }}>
                  {searchLoading ? "Đang tìm..." : "Tìm →"}
                </button>
              </div>
              {searchError && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#791F1F", background: "#FCEBEB", borderRadius: 8, padding: "8px 12px" }}>
                  {searchError}
                </div>
              )}
            </div>

            {foundPatient && (
              <div>
                <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #534AB7", padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#534AB7", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Đã tìm thấy</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{foundPatient.full_name}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                    Tuổi: {foundPatient.age_group} · Đái tháo đường: {foundPatient.diabetes ? "Có" : "Không"}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 8, marginLeft: 4 }}>
                  Chọn vết thương đang điều trị để thêm lần khám mới:
                </div>
                {foundWounds.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 24, color: "#888", fontSize: 13 }}>Chưa có vết thương nào</div>
                ) : foundWounds.map(w => (
                  <div key={w.id} onClick={() => handleSelectOldWound(w)}
                    style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 10,
                      border: "0.5px solid " + (w.status === "healed" ? "#E5E3DC" : "#534AB7"),
                      cursor: w.status === "healed" ? "not-allowed" : "pointer",
                      opacity: w.status === "healed" ? 0.6 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {WOUND_TYPES.find(x => x.value === w.wound_type)?.label || w.wound_type}
                        </div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Bắt đầu: {w.created_date}</div>
                        {w.status === "active" && (
                          <div style={{ fontSize: 12, color: "#534AB7", marginTop: 2 }}>Đang theo dõi: {w.days_so_far} ngày</div>
                        )}
                      </div>
                      {w.status === "healed"
                        ? <span style={{ fontSize: 12, background: "#E1F5EE", color: "#085041", padding: "3px 10px", borderRadius: 10 }}>✓ Đã lành</span>
                        : <span style={{ fontSize: 12, background: "#EEEDFE", color: "#3C3489", padding: "3px 10px", borderRadius: 10 }}>Thêm khám →</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── NHẬP LẦN KHÁM MỚI (bệnh nhân cũ) ── */}
        {findMode && addVisitMode && selectedOldWound && (
          <div>
            <div style={{ background: "#EEEDFE", borderRadius: 14, border: "0.5px solid #534AB7", padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#534AB7", fontWeight: 500 }}>Đang nhập cho:</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{foundPatient.full_name}</div>
              <div style={{ fontSize: 12, color: "#534AB7", marginTop: 2 }}>
                {WOUND_TYPES.find(x => x.value === selectedOldWound.wound_type)?.label} · Theo dõi ngày {selectedOldWound.days_so_far}
              </div>
              <button onClick={() => setAddVisitMode(false)}
                style={{ marginTop: 8, fontSize: 12, color: "#534AB7", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                ← Chọn vết thương khác
              </button>
            </div>
            {/* Lịch sử các lần khám trước */}
            <VisitHistory woundId={selectedOldWound.id} />

            <Section title="Kích thước vết thương hôm nay">
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
                        border: "0.5px solid " + (form.dressing_per_week === n ? "#534AB7" : "#ddd"),
                        background: form.dressing_per_week === n ? "#534AB7" : "#fff",
                        color: form.dressing_per_week === n ? "#fff" : "#555" }}>{n}</button>
                  ))}
                </div>
              </Field>
              <Field label="Người chăm sóc">
                <ToggleBtn options={[["Điều dưỡng chuyên khoa","specialist"],["Điều dưỡng đa khoa","general"]]} value={form.nurse_type} onChange={v => set("nurse_type", v)} />
              </Field>
            </Section>

            {error && <div style={{ background: "#FCEBEB", border: "0.5px solid #E24B4A", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#791F1F", marginBottom: 12 }}>{error}</div>}

            <button onClick={handleAddVisit} disabled={loading}
              style={{ width: "100%", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 500, border: "none", cursor: loading ? "not-allowed" : "pointer",
                background: loading ? "#AFA9EC" : "#534AB7", color: "#fff" }}>
              {loading ? "Đang dự báo..." : "Lưu & Dự báo lần này →"}
            </button>
          </div>
        )}

        {/* ── LỊCH SỬ ── */}
        {historyTab && (
          <div>
            {wounds.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#888", fontSize: 14 }}>Chưa có dữ liệu vết thương</div>
            ) : wounds.map(w => (
              <div key={w.id} style={{ background: "#fff", borderRadius: 14, border: "0.5px solid " + (w.status === "healed" ? "#1D9E75" : "#E5E3DC"), padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{w.patient_name}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{w.wound_type} · {w.location}</div>
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 3, fontFamily: "monospace" }}>ID: {w.patient_id}</div>
                  </div>
                  {w.status === "healed"
                    ? <span style={{ fontSize: 12, background: "#E1F5EE", color: "#085041", padding: "3px 10px", borderRadius: 10 }}>✓ Đã lành</span>
                    : <span style={{ fontSize: 12, background: "#FAEEDA", color: "#633806", padding: "3px 10px", borderRadius: 10 }}>Đang điều trị</span>}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: "#555" }}>
                  <span>Ngày bắt đầu: {w.created_date}</span>
                  {w.status === "healed" ? (
                    <div style={{ marginTop: 6, background: "#E1F5EE", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#085041", fontWeight: 500 }}>
                      🎉 Lành sau {w.actual_days} ngày điều trị
                    </div>
                  ) : (
                    <span style={{ marginLeft: 16, color: "#534AB7", fontWeight: 500 }}>Đang theo dõi: {w.days_so_far} ngày</span>
                  )}
                </div>
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => loadVisits(w)}
                    style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                      border: "0.5px solid #1D9E75", background: "#E1F5EE", color: "#085041" }}>
                    Xem chi tiết →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── NHẬP CA MỚI ── */}
        {!findMode && tab === "form" && (
          <div>
            <Section title="Thông tin bệnh nhân">
              {/* Tìm bệnh nhân đã có */}
              <Field label="Bệnh nhân đã có trong hệ thống? Nhập ID để tìm">
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={form.existingPatientId || ""}
                    onChange={e => set("existingPatientId", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleFindExisting()}
                    placeholder="Dán ID bệnh nhân vào đây (nếu có)..."
                    style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={handleFindExisting} disabled={findExistingLoading}
                    style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                      border: "none", background: findExistingLoading ? "#9FE1CB" : "#1D9E75",
                      color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {findExistingLoading ? "..." : "Tìm"}
                  </button>
                </div>
                {findExistingError && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#791F1F", background: "#FCEBEB", borderRadius: 8, padding: "6px 10px" }}>
                    {findExistingError}
                  </div>
                )}
              </Field>

              {/* Hiển thị bệnh nhân tìm thấy */}
              {existingPatient && (
                <div style={{ background: "#E1F5EE", borderRadius: 10, padding: "10px 14px", marginBottom: 12, border: "0.5px solid #1D9E75" }}>
                  <div style={{ fontSize: 12, color: "#0F6E56", fontWeight: 500, marginBottom: 2 }}>✅ Đã tìm thấy — sẽ thêm vết thương mới cho:</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{existingPatient.full_name}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                    Tuổi: {existingPatient.age_group} · Đái tháo đường: {existingPatient.diabetes ? "Có" : "Không"}
                  </div>
                  <button onClick={() => { setExistingPatient(null); set("existingPatientId", "") }}
                    style={{ marginTop: 6, fontSize: 12, color: "#0F6E56", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                    ✕ Huỷ — nhập bệnh nhân mới
                  </button>
                </div>
              )}

              {/* Form bệnh nhân mới — ẩn nếu đã tìm thấy bệnh nhân cũ */}
              {!existingPatient && (
                <>
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
                </>
              )}
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
            <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #E5E3DC", padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>
                {foundPatient ? foundPatient.full_name : form.patient_name} · {WOUND_TYPES.find(w => w.value === (selectedOldWound?.wound_type || form.wound_type))?.label}
              </div>
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

            {!healResult ? (
              <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #E5E3DC", padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Xác nhận kết quả thực tế</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 12, lineHeight: 1.6 }}>
                  Khi vết thương đã lành hoàn toàn, hãy xác nhận để hệ thống học từ kết quả thực tế.
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
                {healResult.retrain_message && <div style={{ fontSize: 12, color: "#0F6E56", marginTop: 6 }}>{healResult.retrain_message}</div>}
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

      {/* Modal chi tiết vết thương */}
      {selectedWound && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40, paddingLeft: 16, paddingRight: 16, paddingBottom: 40 }}>
          <div style={{ background: "#F8F7F2", borderRadius: 16, width: "100%", maxWidth: 600, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{selectedWound.patient_name}</div>
              <button onClick={() => setSelectedWound(null)} style={{ fontSize: 20, color: "#888", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{selectedWound.wound_type} · {selectedWound.location} · Bắt đầu: {selectedWound.created_date}</div>
            {selectedWound.status === "healed" && (
              <div style={{ background: "#E1F5EE", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#085041", fontWeight: 500, marginBottom: 12 }}>
                🎉 Lành sau {selectedWound.actual_days} ngày · Ngày lành: {selectedWound.actual_healed_date}
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Lịch sử các lần khám</div>
            {visits.length === 0 ? (
              <div style={{ fontSize: 13, color: "#888", textAlign: "center", padding: 20 }}>Đang tải...</div>
            ) : visits.map((v, i) => (
              <div key={v.id} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", marginBottom: 8, borderLeft: "3px solid " + (i === 0 ? "#1D9E75" : "#E5E3DC") }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? "#085041" : "#333" }}>
                  {v.visit_date} {i === 0 && <span style={{ fontSize: 11, background: "#E1F5EE", color: "#085041", padding: "1px 8px", borderRadius: 6, marginLeft: 6 }}>Gần nhất</span>}
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>Kích thước: {v.length_cm} × {v.width_cm} × {v.depth_cm} cm</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Thay băng: {v.dressing_per_week}x/tuần · {v.nurse_type === "specialist" ? "Điều dưỡng chuyên khoa" : "Điều dưỡng đa khoa"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal xác nhận lành */}
      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Xác nhận vết thương đã lành</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              {foundPatient ? foundPatient.full_name : form.patient_name} · {WOUND_TYPES.find(w => w.value === (selectedOldWound?.wound_type || form.wound_type))?.label}
            </div>
            <Field label="Ngày lành thực tế">
              <input type="date" value={healDate} onChange={e => setHealDate(e.target.value)} max={today} style={{ ...inputStyle, width: "100%" }} />
            </Field>
            <Field label="Ghi chú điều dưỡng (tuỳ chọn)">
              <textarea value={healNote} onChange={e => setHealNote(e.target.value)}
                placeholder="Tình trạng lành, ghi chú đặc biệt..." rows={3}
                style={{ ...inputStyle, width: "100%", resize: "vertical" }} />
            </Field>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setConfirmModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, fontSize: 14, cursor: "pointer", border: "0.5px solid #ddd", background: "#fff", color: "#555" }}>Huỷ</button>
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
function VisitHistory({ woundId }) {
  const [visits, setVisits] = useState([])
  useEffect(() => {
    axios.get(`${API}/wounds/${woundId}/visits`)
      .then(r => setVisits(r.data.visits))
      .catch(() => {})
  }, [woundId])

  if (visits.length === 0) return null

  const riskColor = {
    low:    { bg: "#E1F5EE", text: "#085041", border: "#1D9E75" },
    medium: { bg: "#FAEEDA", text: "#633806", border: "#EF9F27" },
    high:   { bg: "#FCEBEB", text: "#791F1F", border: "#E24B4A" },
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #E5E3DC", padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>
        Lịch sử các lần khám trước
      </div>
      {visits.map((v, i) => (
        <div key={v.id} style={{ borderLeft: "3px solid " + (i === 0 ? "#534AB7" : "#E5E3DC"), paddingLeft: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? "#534AB7" : "#333" }}>
              {v.visit_date} {v.created_at ? new Date(v.created_at).toLocaleTimeString("vi-VN", {hour: "2-digit", minute: "2-digit"}) : ""}
              {i === visits.length - 1 && <span style={{ fontSize: 11, background: "#EEEDFE", color: "#3C3489", padding: "1px 8px", borderRadius: 6, marginLeft: 6 }}>Gần nhất</span>}
            </div>
            {v.predicted_days && (
              <div style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>
                Dự báo: <span style={{ fontSize: 18, color: "#534AB7" }}>{v.predicted_days}</span> ngày
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
            Kích thước: {v.length_cm} × {v.width_cm} × {v.depth_cm} cm
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
            Thay băng: {v.dressing_per_week}x/tuần · {v.nurse_type === "specialist" ? "Điều dưỡng chuyên khoa" : "Điều dưỡng đa khoa"}
          </div>
          {v.risk_level && (
            <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: riskColor[v.risk_level]?.bg, color: riskColor[v.risk_level]?.text,
              border: "0.5px solid " + riskColor[v.risk_level]?.border }}>
              {v.risk_label} · {v.confidence_low}–{v.confidence_high} ngày
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
  border: "0.5px solid #ddd", background: "#FAFAF8", color: "#1a1a1a",
  outline: "none", boxSizing: "border-box",
}
