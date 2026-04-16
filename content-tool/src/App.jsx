import { useState, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const SEGMENTS_LAAG1 = [
  { id: "default",    label: "Default",        prefix: "",          attr: null },
  { id: "gez",        label: "Gezinsreiziger",  prefix: "TOV_GEZ_", attr: "Gezinsreiziger" },
  { id: "lux",        label: "Luxe & Wellness", prefix: "TOV_LUX_", attr: "Luxe & Wellness" },
  { id: "ste",        label: "Stedentripper",   prefix: "TOV_STE_", attr: "Stedentripper" },
  { id: "com",        label: "Comfortzoeker",   prefix: "TOV_COM_", attr: "Comfortzoeker" },
  { id: "kor",        label: "Kortingzoeker",   prefix: "TOV_KOR_", attr: "Kortingzoeker" },
  { id: "gro",        label: "Groen Genieter",  prefix: "TOV_GRO_", attr: "Groen Genieter" },
];

const SEGMENTS_LAAG2 = [
  { id: "default", label: "Default",       prefix: "",          attr: null },
  { id: "ste",     label: "Stedelijk",     prefix: "IMG_STE_", attr: "Stedelijk" },
  { id: "nat",     label: "Natuur & Rust", prefix: "IMG_NAT_", attr: "Natuur & Rust" },
  { id: "gem",     label: "Gemengd",       prefix: "IMG_GEM_", attr: "Gemengd" },
];

const FIELDS_LAAG1 = [
  {
    group: "Subject & Preview",
    items: [
      { key: "SUBJECT",      label: "E-mail onderwerpregel", type: "text" },
      { key: "PREVIEW_TEXT", label: "Preview tekst",         type: "text" },
    ],
  },
  {
    group: "Titels",
    items: Array.from({ length: 5 }, (_, i) => ({
      key: `TITLE${i + 1}_COPY`,
      label: `Titel ${i + 1}`,
      type: "text",
    })),
  },
  {
    group: "Teksten",
    items: Array.from({ length: 5 }, (_, i) => ({
      key: `TEXT${i + 1}_COPY`,
      label: `Tekst ${i + 1}`,
      type: "textarea",
    })),
  },
  {
    group: "Buttons & Links",
    items: Array.from({ length: 5 }, (_, i) => [
      { key: `BUTTON${i + 1}_TEXT`, label: `Button ${i + 1} — Tekst`, type: "text" },
      { key: `BUTTON${i + 1}_LINK`, label: `Button ${i + 1} — Link / UTM`, type: "url" },
    ]).flat(),
  },
];

const FIELDS_LAAG2 = [
  {
    group: "Afbeeldingen (12 stuks)",
    items: Array.from({ length: 12 }, (_, i) => [
      { key: `IMG${i + 1}`,      label: `Afbeelding ${i + 1} — URL`,  type: "url" },
      { key: `IMG${i + 1}_LINK`, label: `Afbeelding ${i + 1} — Link`, type: "url" },
    ]).flat(),
  },
];

const ALL_FIELDS_L1 = FIELDS_LAAG1.flatMap((g) => g.items);
const ALL_FIELDS_L2 = FIELDS_LAAG2.flatMap((g) => g.items);

// ─── INITIAL STATE ────────────────────────────────────────────────────────────

const makeEmptyModule = () => {
  const l1 = {};
  SEGMENTS_LAAG1.forEach((s) => {
    l1[s.id] = {};
    ALL_FIELDS_L1.forEach((f) => { l1[s.id][f.key] = ""; });
  });
  const l2 = {};
  SEGMENTS_LAAG2.forEach((s) => {
    l2[s.id] = {};
    ALL_FIELDS_L2.forEach((f) => { l2[s.id][f.key] = ""; });
  });
  return { l1, l2 };
};

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────

const buildCsvHeaders = () => {
  const h = ["item_id"];
  // Default Laag1 (22 cols) — note: buttons sorted TEXT first, then LINK (matching Excel)
  ["SUBJECT","PREVIEW_TEXT","TITLE1_COPY","TITLE2_COPY","TITLE3_COPY","TITLE4_COPY","TITLE5_COPY",
   "TEXT1_COPY","TEXT2_COPY","TEXT3_COPY","TEXT4_COPY","TEXT5_COPY",
   "BUTTON1_TEXT","BUTTON2_TEXT","BUTTON3_TEXT","BUTTON4_TEXT","BUTTON5_TEXT",
   "BUTTON1_LINK","BUTTON2_LINK","BUTTON3_LINK","BUTTON4_LINK","BUTTON5_LINK",
  ].forEach((k) => h.push(k));
  // Per segment Laag1 (6 × 22 = 132 cols)
  SEGMENTS_LAAG1.slice(1).forEach((s) => {
    ["SUBJECT","PREVIEW_TEXT","TITLE1_COPY","TITLE2_COPY","TITLE3_COPY","TITLE4_COPY","TITLE5_COPY",
     "TEXT1_COPY","TEXT2_COPY","TEXT3_COPY","TEXT4_COPY","TEXT5_COPY",
     "BUTTON1_TEXT","BUTTON2_TEXT","BUTTON3_TEXT","BUTTON4_TEXT","BUTTON5_TEXT",
     "BUTTON1_LINK","BUTTON2_LINK","BUTTON3_LINK","BUTTON4_LINK","BUTTON5_LINK",
    ].forEach((k) => h.push(s.prefix + k));
  });
  // Default Laag2 (24 cols)
  Array.from({ length: 12 }, (_, i) => {
    h.push(`IMG${i + 1}`);
    h.push(`IMG${i + 1}_LINK`);
  });
  // Per segment Laag2 (3 × 24 = 72 cols)
  SEGMENTS_LAAG2.slice(1).forEach((s) => {
    Array.from({ length: 12 }, (_, i) => {
      h.push(s.prefix + `IMG${i + 1}`);
      h.push(s.prefix + `IMG${i + 1}_LINK`);
    });
  });
  return h; // total: 1 + 22 + 132 + 24 + 72 = 251
};

const exportCSV = (modules) => {
  const headers = buildCsvHeaders();
  const L1_EXPORT_ORDER = [
    "SUBJECT","PREVIEW_TEXT","TITLE1_COPY","TITLE2_COPY","TITLE3_COPY","TITLE4_COPY","TITLE5_COPY",
    "TEXT1_COPY","TEXT2_COPY","TEXT3_COPY","TEXT4_COPY","TEXT5_COPY",
    "BUTTON1_TEXT","BUTTON2_TEXT","BUTTON3_TEXT","BUTTON4_TEXT","BUTTON5_TEXT",
    "BUTTON1_LINK","BUTTON2_LINK","BUTTON3_LINK","BUTTON4_LINK","BUTTON5_LINK",
  ];

  const rows = modules.map((mod, mi) => {
    const row = [mi + 1];
    // Default Laag1
    L1_EXPORT_ORDER.forEach((k) => row.push(mod.l1.default?.[k] || ""));
    // Segment Laag1 (fallback to default)
    SEGMENTS_LAAG1.slice(1).forEach((s) => {
      L1_EXPORT_ORDER.forEach((k) => {
        row.push(mod.l1[s.id]?.[k] || mod.l1.default?.[k] || "");
      });
    });
    // Default Laag2
    Array.from({ length: 12 }, (_, i) => {
      row.push(mod.l2.default?.[`IMG${i + 1}`] || "");
      row.push(mod.l2.default?.[`IMG${i + 1}_LINK`] || "");
    });
    // Segment Laag2 (fallback to default)
    SEGMENTS_LAAG2.slice(1).forEach((s) => {
      Array.from({ length: 12 }, (_, i) => {
        row.push(mod.l2[s.id]?.[`IMG${i + 1}`] || mod.l2.default?.[`IMG${i + 1}`] || "");
        row.push(mod.l2[s.id]?.[`IMG${i + 1}_LINK`] || mod.l2.default?.[`IMG${i + 1}_LINK`] || "");
      });
    });
    return row;
  });

  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "catalog_export_bloomreach.csv";
  a.click();
  URL.revokeObjectURL(url);
};

// ─── EXCEL IMPORT ─────────────────────────────────────────────────────────────

const importFromExcel = (file, modules, setModules, setImportMsg) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: "array" });

      // --- Laag 1 ---
      const wsL1 = wb.Sheets["InputSheet_Laag1"];
      const rowsL1 = wsL1 ? XLSX.utils.sheet_to_json(wsL1, { header: 1, defval: "" }) : [];

      // Find header row (where col[1] === "Technische Veldnaam")
      const headerRowL1 = rowsL1.findIndex((r) => String(r[1] || "").trim() === "Technische Veldnaam");
      // Segment column order: col 2=Default, 3=Gezinsreiziger, 4=Luxe&Wellness, 5=Stedentripper, 6=Comfortzoeker, 7=Kortingzoeker, 8=Groen Genieter
      const L1_COL_MAP = { default: 2, gez: 3, lux: 4, ste: 5, com: 6, kor: 7, gro: 8 };

      // Group rows by item_id column (col index 2 of the "Mail ID" row before header)
      // For now, collect unique item_ids from the Mail ID row
      const mailIdRow = headerRowL1 > 0 ? rowsL1[headerRowL1 - 1] : [];
      // item_ids start at col 2; find unique values
      const itemIds = [];
      for (let c = 2; c < mailIdRow.length; c++) {
        const id = mailIdRow[c];
        if (id !== "" && id !== undefined && !itemIds.includes(id)) itemIds.push(id);
      }
      if (itemIds.length === 0) itemIds.push(1); // fallback

      // Build per-item data for Laag1
      const l1Data = {}; // { itemId: { segId: { fieldKey: value } } }
      itemIds.forEach((itemId) => {
        l1Data[itemId] = {};
        SEGMENTS_LAAG1.forEach((s) => { l1Data[itemId][s.id] = {}; });
      });

      // For each item_id, find which columns correspond to it
      const itemColOffsets = {}; // { itemId: { segId: colIndex } }
      if (headerRowL1 >= 0) {
        itemIds.forEach((itemId) => {
          itemColOffsets[itemId] = {};
          // Find the first occurrence of this itemId in mailIdRow
          // Each itemId block: cols at offset [0..6] for [Default, GEZ, LUX, STE, COM, KOR, GRO]
          let baseCol = -1;
          for (let c = 2; c < mailIdRow.length; c++) {
            if (mailIdRow[c] === itemId) { baseCol = c; break; }
          }
          if (baseCol >= 0) {
            // Check if the header row has the segment names at these positions
            const headerRow = rowsL1[headerRowL1];
            SEGMENTS_LAAG1.forEach((s, idx) => {
              itemColOffsets[itemId][s.id] = baseCol + idx;
            });
          } else {
            // Fallback: use default L1_COL_MAP
            SEGMENTS_LAAG1.forEach((s) => {
              itemColOffsets[itemId][s.id] = L1_COL_MAP[s.id] ?? 2;
            });
          }
        });
      }

      // Read field values
      for (let ri = headerRowL1 + 1; ri < rowsL1.length; ri++) {
        const row = rowsL1[ri];
        const fieldKey = String(row[1] || "").trim();
        if (!fieldKey) continue;
        const isKnownField = ALL_FIELDS_L1.some((f) => f.key === fieldKey);
        if (!isKnownField) continue;

        itemIds.forEach((itemId) => {
          SEGMENTS_LAAG1.forEach((s) => {
            const colIdx = itemColOffsets[itemId]?.[s.id] ?? (L1_COL_MAP[s.id] ?? 2);
            const val = String(row[colIdx] || "");
            if (l1Data[itemId]?.[s.id]) {
              l1Data[itemId][s.id][fieldKey] = val;
            }
          });
        });
      }

      // --- Laag 2 ---
      const wsL2 = wb.Sheets["InputSheet_Laag2"];
      const rowsL2 = wsL2 ? XLSX.utils.sheet_to_json(wsL2, { header: 1, defval: "" }) : [];
      const headerRowL2 = rowsL2.findIndex((r) => String(r[1] || "").trim() === "Technische Veldnaam");
      const L2_COL_MAP = { default: 2, ste: 3, nat: 4, gem: 5 };

      const mailIdRowL2 = headerRowL2 > 0 ? rowsL2[headerRowL2 - 1] : [];
      const itemIdsL2 = [];
      for (let c = 2; c < mailIdRowL2.length; c++) {
        const id = mailIdRowL2[c];
        if (id !== "" && id !== undefined && !itemIdsL2.includes(id)) itemIdsL2.push(id);
      }
      if (itemIdsL2.length === 0) itemIdsL2.push(1);

      const l2Data = {};
      itemIdsL2.forEach((itemId) => {
        l2Data[itemId] = {};
        SEGMENTS_LAAG2.forEach((s) => { l2Data[itemId][s.id] = {}; });
      });

      if (headerRowL2 >= 0) {
        for (let ri = headerRowL2 + 1; ri < rowsL2.length; ri++) {
          const row = rowsL2[ri];
          const fieldKey = String(row[1] || "").trim();
          if (!fieldKey) continue;
          const isKnownField = ALL_FIELDS_L2.some((f) => f.key === fieldKey);
          if (!isKnownField) continue;
          itemIdsL2.forEach((itemId) => {
            SEGMENTS_LAAG2.forEach((s) => {
              const colIdx = L2_COL_MAP[s.id] ?? 2;
              const val = String(row[colIdx] || "");
              if (l2Data[itemId]?.[s.id]) l2Data[itemId][s.id][fieldKey] = val;
            });
          });
        }
      }

      // Merge all unique item ids
      const allItemIds = [...new Set([...itemIds, ...itemIdsL2])].sort((a, b) => a - b);
      const newModules = allItemIds.map((itemId) => {
        const emptyMod = makeEmptyModule();
        if (l1Data[itemId]) {
          SEGMENTS_LAAG1.forEach((s) => {
            Object.assign(emptyMod.l1[s.id], l1Data[itemId][s.id] || {});
          });
        }
        if (l2Data[itemId]) {
          SEGMENTS_LAAG2.forEach((s) => {
            Object.assign(emptyMod.l2[s.id], l2Data[itemId][s.id] || {});
          });
        }
        return emptyMod;
      });

      if (newModules.length === 0) {
        setImportMsg({ type: "error", text: "Geen data gevonden in de Excel. Controleer of de sheetnamen kloppen (InputSheet_Laag1, InputSheet_Laag2)." });
        return;
      }

      setModules(newModules);
      setImportMsg({ type: "success", text: `✓ ${newModules.length} module(s) geïmporteerd uit Excel.` });
      setTimeout(() => setImportMsg(null), 4000);
    } catch (err) {
      setImportMsg({ type: "error", text: `Fout bij importeren: ${err.message}` });
    }
  };
  reader.readAsArrayBuffer(file);
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const C = {
  blue: "#1a4d7c",
  orange: "#d4762c",
  orangeLight: "#fff3e8",
  blueLight: "#e8f0f8",
  bg: "#f2f2f0",
  border: "#e5e5e5",
  text: "#1a1a1a",
  muted: "#888",
};

const SegBadge = ({ seg, active, hasOverrides, onClick }) => (
  <button onClick={onClick} style={{
    padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer",
    fontSize: "12px", fontWeight: active ? 700 : 500, transition: "all 0.15s",
    background: active
      ? seg.id === "default" ? C.blue : C.orange
      : seg.id === "default" ? C.blueLight : hasOverrides ? C.orangeLight : "#f5f5f5",
    color: active ? "#fff" : seg.id === "default" ? C.blue : hasOverrides ? C.orange : "#999",
    position: "relative",
  }}>
    {seg.label}
    {hasOverrides && !active && (
      <span style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: C.orange }} />
    )}
  </button>
);

const FieldInput = ({ field, value, defaultValue, isDefault, onChange }) => {
  const hasVal = value !== "";
  const showFallback = !isDefault && !hasVal && defaultValue;
  const borderColor = hasVal ? (isDefault ? C.blue : C.orange) : C.border;

  const baseStyle = {
    width: "100%", padding: "7px 10px", borderRadius: "6px", fontSize: "13px",
    border: `1.5px solid ${borderColor}`,
    background: hasVal ? "#fff" : "#fafafa",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
    resize: field.type === "textarea" ? "vertical" : "none",
  };

  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600, color: "#444" }}>{field.label}</label>
        {showFallback && (
          <span style={{ fontSize: "10px", color: "#aaa", fontStyle: "italic" }}>
            ↩ {defaultValue.length > 45 ? defaultValue.slice(0, 45) + "…" : defaultValue}
          </span>
        )}
      </div>
      {field.type === "textarea" ? (
        <textarea rows={2} value={value}
          placeholder={isDefault ? "Vul standaard waarde in…" : defaultValue || "Gebruikt Default waarde"}
          onChange={(e) => onChange(e.target.value)}
          style={baseStyle} />
      ) : (
        <input type="text" value={value}
          placeholder={isDefault ? "Vul standaard waarde in…" : defaultValue || "Gebruikt Default waarde"}
          onChange={(e) => onChange(e.target.value)}
          style={baseStyle} />
      )}
    </div>
  );
};

const ModuleCard = ({ moduleIdx, modData, layer, segments, fields, allFields, onUpdate, activeSeg, onSegChange, collapsed, onToggle }) => {
  const segData = modData[layer];

  const overrides = useMemo(() => {
    const r = {};
    segments.slice(1).forEach((s) => {
      r[s.id] = allFields.some((f) => segData[s.id]?.[f.key]);
    });
    return r;
  }, [segData, segments, allFields]);

  const filledDefault = useMemo(
    () => allFields.filter((f) => segData.default?.[f.key]).length,
    [segData, allFields]
  );

  return (
    <div style={{ background: "#fff", borderRadius: "10px", marginBottom: "10px", border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", cursor: "pointer", userSelect: "none",
        background: collapsed ? "#fff" : "#fafafa",
        borderBottom: collapsed ? "none" : `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>
            {moduleIdx + 1}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Module {moduleIdx + 1}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
              item_id: {moduleIdx + 1} — {filledDefault}/{allFields.length} velden
              {Object.values(overrides).some(Boolean) && (
                <span style={{ color: C.orange, marginLeft: 6 }}>+ {Object.values(overrides).filter(Boolean).length} segment(en)</span>
              )}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 18, color: C.muted, transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "0.2s" }}>▾</span>
      </div>

      {!collapsed && (
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
            {segments.map((s) => (
              <SegBadge key={s.id} seg={s} active={activeSeg === s.id}
                hasOverrides={overrides[s.id] || false}
                onClick={() => onSegChange(s.id)} />
            ))}
          </div>

          {fields.map((group) => (
            <details key={group.group} open>
              <summary style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: C.muted, marginBottom: 8, marginTop: 10, cursor: "pointer" }}>
                {group.group}
              </summary>
              {group.items.map((field) => (
                <FieldInput key={field.key} field={field}
                  value={segData[activeSeg]?.[field.key] || ""}
                  defaultValue={activeSeg !== "default" ? (segData.default?.[field.key] || "") : ""}
                  isDefault={activeSeg === "default"}
                  onChange={(val) => onUpdate(layer, activeSeg, field.key, val)} />
              ))}
            </details>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── PREVIEW ──────────────────────────────────────────────────────────────────

const PreviewL1 = ({ modules, previewSeg }) => {
  const resolve = (mod, key) => mod.l1[previewSeg]?.[key] || mod.l1.default?.[key] || "";

  return (
    <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        Email Preview
      </div>
      <div style={{ maxHeight: 500, overflowY: "auto", padding: "14px" }}>
        {modules.map((mod, mi) => {
          const subject = resolve(mod, "SUBJECT");
          const preview = resolve(mod, "PREVIEW_TEXT");
          const title = resolve(mod, "TITLE1_COPY");
          const text = resolve(mod, "TEXT1_COPY");
          const btn = resolve(mod, "BUTTON1_TEXT");
          if (!subject && !title) return null;
          return (
            <div key={mi} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: mi < modules.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginBottom: 4 }}>MODULE {mi + 1}</div>
              {subject && <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{subject}</div>}
              {preview && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{preview}</div>}
              {title && <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginTop: 8 }}>{title}</div>}
              {text && <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, marginTop: 4 }}>{text}</div>}
              {btn && (
                <div style={{ display: "inline-block", marginTop: 8, padding: "6px 16px", borderRadius: 5, background: C.orange, color: "#fff", fontSize: 11, fontWeight: 700 }}>
                  {btn}
                </div>
              )}
            </div>
          );
        })}
        {!modules.some((m) => m.l1.default?.SUBJECT || m.l1.default?.TITLE1_COPY) && (
          <div style={{ textAlign: "center", padding: "30px 0", color: "#ccc", fontSize: 13 }}>Vul content in om preview te zien</div>
        )}
      </div>
    </div>
  );
};

const PreviewL2 = ({ modules, previewSeg }) => {
  const resolve = (mod, key) => mod.l2[previewSeg]?.[key] || mod.l2.default?.[key] || "";

  return (
    <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        Afbeelding Preview
      </div>
      <div style={{ maxHeight: 500, overflowY: "auto", padding: 14 }}>
        {modules.map((mod, mi) => {
          const imgs = Array.from({ length: 12 }, (_, i) => ({
            url: resolve(mod, `IMG${i + 1}`),
            link: resolve(mod, `IMG${i + 1}_LINK`),
            n: i + 1,
          })).filter((x) => x.url);
          return (
            <div key={mi} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginBottom: 6 }}>MODULE {mi + 1} — {imgs.length} afbeeldingen</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {imgs.map((img) => (
                  <div key={img.n} style={{ background: "#f5f5f5", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <img src={img.url} alt={`IMG${img.n}`} style={{ width: "100%", height: 60, objectFit: "cover", display: "block" }}
                      onError={(e) => { e.target.style.display = "none"; }} />
                    <div style={{ padding: "4px 6px", fontSize: 10, color: C.muted }}>IMG{img.n}</div>
                  </div>
                ))}
              </div>
              {imgs.length === 0 && <div style={{ fontSize: 12, color: "#ccc" }}>Geen afbeeldingen ingevuld</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── STATS BAR ────────────────────────────────────────────────────────────────

const StatsBar = ({ modules }) => {
  const filledL1 = modules.filter((m) => ALL_FIELDS_L1.some((f) => m.l1.default?.[f.key])).length;
  const totalOverrides = modules.reduce(
    (sum, m) =>
      sum +
      SEGMENTS_LAAG1.slice(1).filter((s) => ALL_FIELDS_L1.some((f) => m.l1[s.id]?.[f.key])).length +
      SEGMENTS_LAAG2.slice(1).filter((s) => ALL_FIELDS_L2.some((f) => m.l2[s.id]?.[f.key])).length,
    0
  );
  return (
    <div style={{ padding: "5px 12px", borderRadius: 6, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", fontSize: 11 }}>
      {modules.length} modules — {filledL1} ingevuld — {totalOverrides} overrides — 251 export kolommen
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [modules, setModules] = useState(() => [makeEmptyModule()]);
  const [activeLayer, setActiveLayer] = useState("l1");
  const [activeSegs, setActiveSegs] = useState(() => ({ l1: Array(10).fill("default"), l2: Array(10).fill("default") }));
  const [collapsed, setCollapsed] = useState(() => Array(10).fill(false).map((_, i) => i > 0));
  const [previewSeg, setPreviewSeg] = useState("default");
  const [showPreview, setShowPreview] = useState(true);
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = useRef(null);

  const updateModule = useCallback((layer, mi, segId, fieldKey, value) => {
    setModules((prev) => {
      const next = [...prev];
      const mod = { ...next[mi] };
      mod[layer] = { ...mod[layer], [segId]: { ...mod[layer][segId], [fieldKey]: value } };
      next[mi] = mod;
      return next;
    });
  }, []);

  const addModule = () => {
    if (modules.length < 10) setModules((p) => [...p, makeEmptyModule()]);
  };

  const removeModule = () => {
    if (modules.length > 1) setModules((p) => p.slice(0, -1));
  };

  const segments = activeLayer === "l1" ? SEGMENTS_LAAG1 : SEGMENTS_LAAG2;
  const fields = activeLayer === "l1" ? FIELDS_LAAG1 : FIELDS_LAAG2;
  const allFields = activeLayer === "l1" ? ALL_FIELDS_L1 : ALL_FIELDS_L2;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: C.blue, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px" }}>Content Automation Tool</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 }}>Bloomreach Email Personalisatie — Valk Digital V4</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <StatsBar modules={modules} />

          {/* Import Excel */}
          <input type="file" accept=".xlsx,.xls" ref={fileInputRef} style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) importFromExcel(e.target.files[0], modules, setModules, setImportMsg);
              e.target.value = "";
            }} />
          <button onClick={() => fileInputRef.current?.click()} style={{
            padding: "7px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>↑ Excel importeren</button>

          <button onClick={() => setShowPreview((p) => !p)} style={{
            padding: "7px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)",
            background: showPreview ? "rgba(255,255,255,0.15)" : "transparent",
            color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>Preview {showPreview ? "▸" : "◂"}</button>

          <button onClick={() => exportCSV(modules)} style={{
            padding: "7px 14px", borderRadius: 6, border: "none",
            background: C.orange, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>↓ Export CSV</button>
        </div>
      </div>

      {/* Import message */}
      {importMsg && (
        <div style={{
          padding: "10px 24px", fontSize: 13, fontWeight: 600,
          background: importMsg.type === "success" ? "#e6f4ea" : "#fdecea",
          color: importMsg.type === "success" ? "#1e6b2e" : "#b00020",
          borderBottom: `1px solid ${importMsg.type === "success" ? "#b8dfc3" : "#f5c6cb"}`,
        }}>
          {importMsg.text}
        </div>
      )}

      {/* Layer tabs */}
      <div style={{ padding: "12px 24px 0", display: "flex", gap: 4 }}>
        {[
          { id: "l1", label: "Laag 1 — Tone of Voice", sub: "segment_profiel → SUBJECT / TITELS / TEKSTEN / BUTTONS" },
          { id: "l2", label: "Laag 2 — Afbeeldingen",  sub: "segment_hotel → 12 afbeeldingen per omgevingslabel" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveLayer(tab.id)} style={{
            padding: "10px 18px", borderRadius: "8px 8px 0 0", border: `1px solid ${C.border}`,
            borderBottom: activeLayer === tab.id ? "none" : `1px solid ${C.border}`,
            background: activeLayer === tab.id ? "#fff" : "#e8e8e5",
            cursor: "pointer", textAlign: "left",
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: activeLayer === tab.id ? C.blue : C.muted }}>{tab.label}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{tab.sub}</div>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{
        display: "grid",
        gridTemplateColumns: showPreview ? "1fr 300px" : "1fr",
        gap: 16, padding: "16px 24px", maxWidth: 1400, margin: "0 auto",
      }}>
        {/* Left: modules */}
        <div>
          {modules.map((mod, mi) => (
            <ModuleCard key={mi}
              moduleIdx={mi} modData={mod}
              layer={activeLayer} segments={segments} fields={fields} allFields={allFields}
              activeSeg={activeSegs[activeLayer][mi]}
              onSegChange={(seg) => setActiveSegs((p) => ({
                ...p, [activeLayer]: p[activeLayer].map((v, i) => i === mi ? seg : v),
              }))}
              collapsed={collapsed[mi]}
              onToggle={() => setCollapsed((p) => p.map((v, i) => i === mi ? !v : v))}
              onUpdate={(layer, seg, key, val) => updateModule(layer, mi, seg, key, val)} />
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {modules.length < 10 && (
              <button onClick={addModule} style={{
                flex: 1, padding: 10, borderRadius: 8,
                border: `2px dashed ${C.border}`, background: "transparent",
                color: C.muted, cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}>+ Module toevoegen</button>
            )}
            {modules.length > 1 && (
              <button onClick={removeModule} style={{
                padding: "10px 16px", borderRadius: 8, border: `1px solid ${C.border}`,
                background: "#fff", color: "#cc4444", cursor: "pointer", fontSize: 13,
              }}>Verwijder laatste</button>
            )}
          </div>
        </div>

        {/* Right: preview */}
        {showPreview && (
          <div style={{ position: "sticky", top: 16, alignSelf: "start" }}>
            {/* Segment switcher for preview */}
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              {segments.map((s) => (
                <button key={s.id} onClick={() => setPreviewSeg(s.id)} style={{
                  padding: "3px 8px", borderRadius: 4, border: "none",
                  fontSize: 10, fontWeight: previewSeg === s.id ? 700 : 500,
                  background: previewSeg === s.id ? C.blue : "#e8e8e8",
                  color: previewSeg === s.id ? "#fff" : "#666", cursor: "pointer",
                }}>{s.label}</button>
              ))}
            </div>
            {activeLayer === "l1"
              ? <PreviewL1 modules={modules} previewSeg={previewSeg} />
              : <PreviewL2 modules={modules} previewSeg={previewSeg} />}
          </div>
        )}
      </div>
    </div>
  );
}
