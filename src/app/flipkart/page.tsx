"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";

export default function FlipkartPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: 40,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        background: "#fafafa"
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "#0284c710",
          color: "#0284c7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <ShoppingCart size={28} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>Flipkart Operations Hub</h2>
      <p style={{ fontSize: 12, color: "#888", marginTop: 4, maxWidth: 360, lineHeight: 1.5 }}>
        Initializing Flipkart Seller dashboard. Click any item in the sidebar platforms list to transition between channels instantly.
      </p>
    </motion.div>
  );
}
