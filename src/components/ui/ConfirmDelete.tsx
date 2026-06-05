"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmDeleteProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
}

export function ConfirmDelete({ isOpen, onConfirm, onCancel, message }: ConfirmDeleteProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button by default (safer choice)
      cancelButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && document.activeElement === confirmButtonRef.current) {
        onConfirm();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm flex items-center justify-center gap-3 rounded-lg"
          role="alertdialog"
          aria-labelledby="confirm-delete-message"
          aria-describedby="confirm-delete-message"
        >
          <span id="confirm-delete-message" className="text-sm font-medium text-[#444]">
            {message || "Delete this?"}
          </span>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-[#1a1a1a] transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            aria-label="Confirm deletion"
          >
            Yes, Delete
          </button>
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="px-3 py-1.5 bg-[#f5f5f5] text-[#444] text-xs font-bold rounded-lg hover:bg-[#e0e0e0] transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            aria-label="Cancel deletion"
          >
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
