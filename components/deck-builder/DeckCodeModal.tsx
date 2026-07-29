"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Download, X } from "lucide-react";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";

export function DeckCodeModal({ onClose }: { onClose: () => void }) {
  const exportCodeFn = useDeckBuilderStore((s) => s.exportCode);
  const importCode = useDeckBuilderStore((s) => s.importCode);
  const entries = useDeckBuilderStore((s) => s.currentDeck.entries);
  const name = useDeckBuilderStore((s) => s.currentDeck.name);
  const characterId = useDeckBuilderStore((s) => s.characterId);

  const [mode, setMode] = useState<"export" | "import">("export");
  const [importInput, setImportInput] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const exportCode = useMemo(
    () => exportCodeFn(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exportCodeFn, entries, name, characterId],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setImportError("Не удалось скопировать");
    }
  };

  const handleImport = () => {
    const result = importCode(importInput.trim());
    if (result.success) {
      onClose();
    } else {
      setImportError(result.error ?? "Неверный код");
      setTimeout(() => setImportError(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "92vw",
          background: COLORS.bg_surface,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              font: `700 20px ${TYPOGRAPHY.display}`,
              color: COLORS.text_primary,
              margin: 0,
            }}
          >
            Код колоды
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: COLORS.text_secondary,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            marginBottom: 16,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 8,
            padding: 3,
          }}
        >
          {(["export", "import"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "6px 0",
                background: mode === m ? "rgba(255,255,255,0.1)" : "transparent",
                borderRadius: 6,
                border: "none",
                font: `600 13px ${TYPOGRAPHY.ui}`,
                color:
                  mode === m ? COLORS.text_primary : COLORS.text_secondary,
                letterSpacing: "0.5px",
                cursor: "pointer",
              }}
            >
              {m === "export" ? "Экспорт" : "Импорт"}
            </button>
          ))}
        </div>

        {mode === "export" ? (
          <>
            <textarea
              readOnly
              value={exportCode}
              style={{
                width: "100%",
                height: 80,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: 10,
                font: `400 12px ${TYPOGRAPHY.mono}`,
                color: COLORS.gold,
                resize: "none",
                wordBreak: "break-all",
              }}
            />
            <p
              style={{
                font: `400 12px ${TYPOGRAPHY.ui}`,
                color: COLORS.text_secondary,
                marginTop: 8,
              }}
            >
              Поделись этим кодом с другом — он сможет скопировать твою колоду.
            </p>
            <motion.button
              type="button"
              onClick={() => void handleCopy()}
              whileTap={{ scale: 0.97 }}
              style={{
                marginTop: 14,
                width: "100%",
                height: 40,
                background: copySuccess ? "#2D7A4A" : COLORS.gold,
                color: "#1A0000",
                borderRadius: 8,
                font: `700 14px ${TYPOGRAPHY.ui}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "none",
                cursor: "pointer",
              }}
            >
              {copySuccess ? (
                <>
                  <Check size={16} /> Скопировано!
                </>
              ) : (
                <>
                  <Copy size={16} /> Скопировать код
                </>
              )}
            </motion.button>
          </>
        ) : (
          <>
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="Вставь код колоды сюда..."
              style={{
                width: "100%",
                height: 80,
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${importError ? COLORS.red_hot : "rgba(255,255,255,0.1)"}`,
                borderRadius: 8,
                padding: 10,
                font: `400 12px ${TYPOGRAPHY.mono}`,
                color: COLORS.text_primary,
                resize: "none",
              }}
            />
            {importError && (
              <p
                style={{
                  font: `500 12px ${TYPOGRAPHY.ui}`,
                  color: COLORS.red_hot,
                  marginTop: 6,
                }}
              >
                {importError}
              </p>
            )}
            <button
              type="button"
              onClick={handleImport}
              disabled={!importInput.trim()}
              style={{
                marginTop: 14,
                width: "100%",
                height: 40,
                background: importInput.trim()
                  ? COLORS.gold
                  : "rgba(255,255,255,0.05)",
                color: importInput.trim()
                  ? "#1A0000"
                  : COLORS.text_secondary,
                borderRadius: 8,
                font: `700 14px ${TYPOGRAPHY.ui}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "none",
                cursor: importInput.trim() ? "pointer" : "not-allowed",
              }}
            >
              <Download size={16} /> Загрузить колоду
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
