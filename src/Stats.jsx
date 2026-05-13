import { useState, useEffect, useRef } from "react"
import axios from "axios"
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Title,
} from "chart.js"
import { Doughnut, Bar, Scatter } from "react-chartjs-2"

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Title,
)

const API = "https://woundai-backend-wf1b.onrender.com"

const PERIOD_OPTIONS = [
  { value: "month",   label: "30 ngày" },
  { value: "quarter", label: "3 tháng" },
  { value: "year",    label: "1 năm"   },
  { value: "all",     label: "Tất cả"  },
]

const WOUND_COLORS = {
  loet_ap_luc:    "#534AB7",
  vet_mo:         "#1D9E75",
  loet_tinh_mach: "#EF9F27",
  bong_do_2:      "#E24B4A",
}

const ML_TOOLTIPS = {
  mae:         "Sai số trung bình — mô hình dự báo lệch bao nhiêu ngày so với thực tế. Càng nhỏ càng tốt.",
  accuracy_7d: "Tỷ lệ các ca mô hình dự báo đúng trong khoảng ±7 ngày so với ngày lành thực tế.",
  scatter:     "Mỗi chấm là một ca đã lành. Chấm càng gần đường chéo = dự báo càng chính xác.",
  importance:  "Yếu tố nào ảnh hưởng nhiều nhất đến kết quả dự báo của mô hình Random Forest.",
}

export default function Stats({ onBack }) {
  const [period,  setPeriod]  = useState("all")
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null) // { text, x, y }
  const [activeWound, setActiveWound] = useState(null) // filter by wound type

  useEffect(() => {
    setLoading(true)
    axios.get(`${API}/stats/dashboard?period=${period}`)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  function showTooltip(text, e) {
    setTooltip({ text, x: e.clientX, y: e.clientY })
  }
  function hideTooltip() { setTooltip(null) }

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: "#888", fontSize: 14 }}>
      Đang tải dữ liệu...
    </div>
  )
  if (!data) return (
    <div style={{ textAlign: "center", padding: 60, color: "#888", fontSize: 14 }}>
      Không tải được dữ liệu — server có thể đang ngủ, thử lại sau ít phút.
    </div>
  )

  const { overview, wound_distribution, nurse_compare, model_performance } = data

  // Lọc wound_distribution theo activeWound
  const filteredDist = activeWound
    ? wound_distribution.filter(w => w.type === activeWound)
    : wound_distribution

  // Donut chart data
  const donutData = {
    labels: wound_distribution.map(w => w.label),
    datasets: [{
      data: wound_distribution.map(w => w.count),
      backgroundColor: wound_distribution.map(w => WOUND_COLORS[w.type] + "CC"),
      borderColor:     wound_distribution.map(w => WOUND_COLORS[w.type]),
      borderWidth: 1.5,
      hoverOffset: 6,
    }],
  }

  // Bar chart — thời gian lành TB
  const barData = {
    labels: filteredDist.map(w => w.label),
    datasets: [{
      label: "Ngày lành trung bình",
      data:  filteredDist.map(w => w.avg_days || 0),
      backgroundColor: filteredDist.map(w => WOUND_COLORS[w.type] + "BB"),
      borderColor:     filteredDist.map(w => WOUND_COLORS[w.type]),
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  // Scatter chart — dự báo vs thực tế
  const scatterPoints = (model_performance.pred_actual || []).map(p => ({
    x: p.predicted,
    y: p.actual,
    woundType: p.wound_type,
  }))

  const scatterData = {
    datasets: wound_distribution.map(w => ({
      label: w.label,
      data: scatterPoints
        .filter(p => p.woundType === w.type)
        .map(p => ({ x: p.x, y: p.y })),
      backgroundColor: WOUND_COLORS[w.type] + "99",
      borderColor:     WOUND_COLORS[w.type],
      borderWidth: 1,
      pointRadius: 4,
      pointHoverRadius: 6,
    })),
  }

  // Bar chart điều dưỡng
  const nurseBarData = {
    labels: ["Điều dưỡng chuyên khoa", "Điều dưỡng đa khoa"],
    datasets: [{
      label: "Ngày lành trung bình",
      data: [
        nurse_compare.specialist?.avg_days || 0,
        nurse_compare.general?.avg_days    || 0,
      ],
      backgroundColor: ["#534AB7BB", "#EF9F27BB"],
      borderColor:     ["#534AB7",   "#EF9F27"  ],
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  const maxDay = Math.max(
    ...(model_performance.pred_actual || []).map(p => Math.max(p.predicted, p.actual)),
    10
  )

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F2", fontFamily: "system-ui, sans-serif" }}>

      {/* Tooltip global */}
      {tooltip && (
        <div style={{
          position: "fixed", zIndex: 9999,
          top: tooltip.y - 60, left: tooltip.x - 10,
          background: "#1a1a1a", color: "#fff",
          fontSize: 12, lineHeight: 1.6,
          padding: "8px 12px", borderRadius: 8,
          maxWidth: 240, pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}>
          {tooltip.text}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #E5E3DC", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack}
            style={{ fontSize: 13, color: "#1D9E75", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            ← Quay lại
          </button>
          <div style={{ width: 1, height: 16, background: "#E5E3DC" }} />
          <div style={{ fontSize: 15, fontWeight: 500 }}>Thống kê tổng quan</div>
        </div>

        {/* Bộ lọc thời gian */}
        <div style={{ display: "flex", gap: 6 }}>
          {PERIOD_OPTIONS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, fontWeight: 500, cursor: "pointer",
                border: "0.5px solid " + (period === p.value ? "#1D9E75" : "#ddd"),
                background: period === p.value ? "#1D9E75" : "#fff",
                color: period === p.value ? "#fff" : "#666" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* ── TẦNG 1: Số tổng quan ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Tổng vết thương",  value: overview.total_wounds,  bg: "#F8F7F2", text: "#333",    border: "#E5E3DC" },
            { label: "Đang điều trị",     value: overview.active,        bg: "#EEEDFE", text: "#3C3489", border: "#534AB7" },
            { label: "Đã lành",           value: overview.healed,        bg: "#E1F5EE", text: "#085041", border: "#1D9E75" },
            { label: "Ca mới 7 ngày",     value: overview.new_this_week, bg: "#FAEEDA", text: "#633806", border: "#EF9F27" },
          ].map(card => (
            <div key={card.label} style={{ background: card.bg, borderRadius: 12, border: `0.5px solid ${card.border}`, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: card.text, opacity: 0.7, marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: card.text }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* ── TẦNG 2: Phân tích vết thương ── */}
        <SectionCard title="Phân tích vết thương">
          {activeWound && (
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, background: "#EEEDFE", color: "#3C3489", padding: "3px 10px", borderRadius: 8 }}>
                Đang lọc: {wound_distribution.find(w => w.type === activeWound)?.label}
              </span>
              <button onClick={() => setActiveWound(null)}
                style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                ✕ Bỏ lọc
              </button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Donut */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 8 }}>Tỷ lệ loại vết thương</div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Bấm vào để lọc biểu đồ bên phải</div>
              <div style={{ height: 200 }}>
                <Doughnut data={donutData} options={{
                  responsive: true, maintainAspectRatio: false,
                  cutout: "65%",
                  plugins: {
                    legend: { position: "bottom", labels: { font: { size: 11 }, padding: 10 } },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} ca` } },
                  },
                  onClick: (_, elements) => {
                    if (elements.length > 0) {
                      const idx = elements[0].index
                      const type = wound_distribution[idx].type
                      setActiveWound(prev => prev === type ? null : type)
                    }
                  },
                }} />
              </div>
            </div>

            {/* Bar thời gian lành */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 8 }}>Thời gian lành trung bình (ngày)</div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Hover vào cột để xem chi tiết</div>
              <div style={{ height: 200 }}>
                <Bar data={barData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: {
                      label: ctx => ` ${ctx.raw} ngày trung bình`,
                      afterLabel: ctx => {
                        const w = filteredDist[ctx.dataIndex]
                        return ` Số ca: ${w.count}`
                      }
                    }},
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                    y: { grid: { color: "#F0EEE8" }, ticks: { font: { size: 11 } } },
                  },
                }} />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── TẦNG 3: So sánh điều dưỡng ── */}
        <SectionCard title="Chuyên khoa vs Đa khoa">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Bar so sánh */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 8 }}>Thời gian lành trung bình</div>
              <div style={{ height: 180 }}>
                <Bar data={nurseBarData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.raw} ngày trung bình` } },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                    y: { grid: { color: "#F0EEE8" }, ticks: { font: { size: 11 } } },
                  },
                }} />
              </div>
            </div>

            {/* Cards so sánh */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "specialist", color: "#534AB7", bg: "#EEEDFE", label: "Điều dưỡng chuyên khoa" },
                { key: "general",    color: "#EF9F27", bg: "#FAEEDA", label: "Điều dưỡng đa khoa" },
              ].map(n => {
                const info = nurse_compare[n.key]
                const diff = nurse_compare.specialist?.avg_days && nurse_compare.general?.avg_days
                  ? nurse_compare.general.avg_days - nurse_compare.specialist.avg_days
                  : null
                return (
                  <div key={n.key} style={{ background: n.bg, borderRadius: 10, padding: "12px 14px", border: `0.5px solid ${n.color}` }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: n.color, marginBottom: 4 }}>{n.label}</div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, color: n.color, opacity: 0.7 }}>Số ca</div>
                        <div style={{ fontSize: 18, fontWeight: 500, color: n.color }}>{info?.count || 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: n.color, opacity: 0.7 }}>TB ngày lành</div>
                        <div style={{ fontSize: 18, fontWeight: 500, color: n.color }}>{info?.avg_days || "—"}</div>
                      </div>
                      {diff && n.key === "specialist" && (
                        <div>
                          <div style={{ fontSize: 10, color: "#085041", opacity: 0.7 }}>Nhanh hơn</div>
                          <div style={{ fontSize: 18, fontWeight: 500, color: "#085041" }}>~{diff} ngày</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </SectionCard>

        {/* ── TẦNG 4: Hiệu suất mô hình ── */}
        <SectionCard title="Hiệu suất mô hình ML">

          {/* Số chỉ tiêu */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: "#F8F7F2", borderRadius: 10, padding: "12px 14px", cursor: "help" }}
              onMouseMove={e => showTooltip(ML_TOOLTIPS.mae, e)}
              onMouseLeave={hideTooltip}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                Sai số trung bình (MAE) <span style={{ color: "#ccc" }}>?</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, color: "#333" }}>
                {model_performance.mae ?? "—"} <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>ngày</span>
              </div>
            </div>
            <div style={{ background: "#E1F5EE", borderRadius: 10, padding: "12px 14px", cursor: "help" }}
              onMouseMove={e => showTooltip(ML_TOOLTIPS.accuracy_7d, e)}
              onMouseLeave={hideTooltip}>
              <div style={{ fontSize: 11, color: "#0F6E56", marginBottom: 4 }}>
                Dự báo đúng ±7 ngày <span style={{ color: "#9FE1CB" }}>?</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, color: "#085041" }}>
                {model_performance.accuracy_7d ?? "—"}<span style={{ fontSize: 13, fontWeight: 400 }}>%</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Scatter dự báo vs thực tế */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>Dự báo vs thực tế</div>
                <span style={{ fontSize: 11, color: "#ccc", cursor: "help" }}
                  onMouseMove={e => showTooltip(ML_TOOLTIPS.scatter, e)}
                  onMouseLeave={hideTooltip}>?</span>
              </div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Mỗi chấm = 1 ca đã lành</div>
              <div style={{ height: 200 }}>
                <Scatter data={scatterData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 10, padding: 8 } },
                    tooltip: { callbacks: {
                      label: ctx => ` Dự báo: ${ctx.parsed.x} ngày · Thực tế: ${ctx.parsed.y} ngày`,
                    }},
                  },
                  scales: {
                    x: { title: { display: true, text: "Dự báo (ngày)", font: { size: 11 } }, grid: { color: "#F0EEE8" }, ticks: { font: { size: 10 } } },
                    y: { title: { display: true, text: "Thực tế (ngày)", font: { size: 11 } }, grid: { color: "#F0EEE8" }, ticks: { font: { size: 10 } } },
                  },
                }} />
              </div>
            </div>

            {/* Feature importance */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>Yếu tố ảnh hưởng nhất</div>
                <span style={{ fontSize: 11, color: "#ccc", cursor: "help" }}
                  onMouseMove={e => showTooltip(ML_TOOLTIPS.importance, e)}
                  onMouseLeave={hideTooltip}>?</span>
              </div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Từ mô hình Random Forest</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(model_performance.feature_importance || []).slice(0, 6).map((f, i) => (
                  <div key={f.feature}
                    style={{ cursor: "help" }}
                    onMouseMove={e => showTooltip(`${f.label}: đóng góp ${f.importance}% vào kết quả dự báo của mô hình`, e)}
                    onMouseLeave={hideTooltip}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <div style={{ fontSize: 12, color: "#555" }}>{f.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#333" }}>{f.importance}%</div>
                    </div>
                    <div style={{ height: 6, background: "#F0EEE8", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: 6,
                        width: `${f.importance}%`,
                        background: i < 2 ? "#534AB7" : i < 4 ? "#1D9E75" : "#EF9F27",
                        borderRadius: 3,
                        transition: "width 0.5s",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

      </div>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #E5E3DC", padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 16 }}>
        {title}
      </div>
      {children}
    </div>
  )
}
