"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertCircle, RefreshCw, Key, HelpCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function InstagramSettingsModal({ isOpen, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  // Connection status states: 'idle' | 'success' | 'error'
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
  const [connectedProfile, setConnectedProfile] = useState<{
    name: string;
    username: string;
    profilePictureUrl?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Load existing credentials from Supabase on mount/open
  useEffect(() => {
    if (!isOpen) return;
    
    async function loadConfig() {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from("roadmap_projects")
          .select("data")
          .eq("id", "instagram_config")
          .maybeSingle();

        if (error) throw error;
        if (data && data.data) {
          setAccountId(data.data.accountId || "");
          setAccessToken(data.data.accessToken || "");
          // Auto-verify if credentials already exist
          if (data.data.accountId && data.data.accessToken) {
            verifyCredentials(data.data.accountId, data.data.accessToken);
          }
        }
      } catch (err) {
        console.error("Failed to load Instagram settings:", err);
      }
    }

    loadConfig();
  }, [isOpen]);

  const verifyCredentials = async (id: string, token: string) => {
    setIsTesting(true);
    setConnectionStatus("idle");
    setErrorMessage("");
    
    try {
      const res = await fetch("/api/roadmap/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id, accessToken: token }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify connection.");
      }

      setConnectionStatus("success");
      setConnectedProfile({
        name: data.name,
        username: data.username,
        profilePictureUrl: data.profilePictureUrl,
      });
    } catch (err) {
      setConnectionStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setConnectedProfile(null);
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestConnection = () => {
    if (!accountId.trim() || !accessToken.trim()) {
      setConnectionStatus("error");
      setErrorMessage("Please enter both Instagram Account ID and Access Token to test.");
      return;
    }
    verifyCredentials(accountId.trim(), accessToken.trim());
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!supabase) {
        throw new Error("Supabase is not initialized. Check your database configuration.");
      }
      const { error } = await supabase.from("roadmap_projects").upsert({
        id: "instagram_config",
        data: {
          accountId: accountId.trim(),
          accessToken: accessToken.trim(),
        },
      });

      if (error) throw error;
      alert("Instagram settings saved successfully!");
      onClose();
    } catch (err) {
      alert("Failed to save credentials: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(5px)",
          }}
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 15 }}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "520px",
            background: isDark ? "#1c1c1e" : "#ffffff",
            borderRadius: "20px",
            boxShadow: isDark 
              ? "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
              : "0 25px 50px -12px rgba(0, 0, 0, 0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 2010,
            maxHeight: "90vh",
            border: isDark ? "1px solid #2d2d2d" : "none",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: isDark ? "1px solid #2d2d2d" : "1px solid #efefef",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  padding: 1.5,
                  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: isDark ? "#1c1c1e" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: isDark ? "#f5f5f5" : "#262626",
                  }}
                >
                  IG
                </div>
              </div>
              <span style={{ fontSize: "14px", fontWeight: 700, color: isDark ? "#f5f5f5" : "#262626" }}>
                Instagram Automation Settings
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: isDark ? "#2c2c2e" : "#f3f3f3",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#f5f5f5" : "#262626",
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Guide/Alert Alert */}
            <div
              style={{
                background: isDark ? "rgba(124, 58, 237, 0.08)" : "rgba(124, 58, 237, 0.04)",
                border: isDark ? "1px solid rgba(124, 58, 237, 0.25)" : "1px solid rgba(124, 58, 237, 0.15)",
                borderRadius: "10px",
                padding: "12px",
                display: "flex",
                gap: "10px",
                fontSize: "11.5px",
                lineHeight: "1.45",
                color: isDark ? "#c084fc" : "#6d28d9",
              }}
            >
              <HelpCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>How to get these details:</strong>
                <ol style={{ paddingLeft: "14px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                  <li>Make sure your Instagram is a <strong>Business/Creator</strong> account linked to a Facebook Page.</li>
                  <li>Create an app in the <strong>Meta Developer Console</strong>.</li>
                  <li>Generate a <strong>Long-Lived Page Access Token</strong> with <code>instagram_basic</code> and <code>instagram_content_publish</code> permissions.</li>
                </ol>
              </div>
            </div>

            {/* Account ID input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "10px", fontWeight: 700, color: isDark ? "#a3a3a3" : "#777777", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Instagram Business Account ID
              </label>
              <input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g. 17841401234567890"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: isDark ? "#2c2c2e" : "#fff",
                  border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                  borderRadius: "10px",
                  fontSize: "13px",
                  outline: "none",
                  color: isDark ? "#f5f5f5" : "#262626",
                }}
              />
            </div>

            {/* Access Token input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "10px", fontWeight: 700, color: isDark ? "#a3a3a3" : "#777777", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Meta Page Access Token
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showToken ? "text" : "password"}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAACW..."
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 12px",
                    background: isDark ? "#2c2c2e" : "#fff",
                    border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                    borderRadius: "10px",
                    fontSize: "13px",
                    outline: "none",
                    color: isDark ? "#f5f5f5" : "#262626",
                    fontFamily: accessToken ? "monospace" : "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: isDark ? "#8e8e8e" : "#8e8e8e",
                  }}
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Connection Status panel */}
            <div
              style={{
                border: isDark ? "1px solid #2d2d2d" : "1px solid #efefef",
                borderRadius: "12px",
                padding: "12px",
                background: isDark ? "#121212" : "#fafafa",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#737373" : "#8e8e8e" }}>
                  CONNECTION VERIFICATION
                </span>
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#7c3aed",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <RefreshCw size={12} className={isTesting ? "animate-spin" : ""} />
                  {isTesting ? "Testing..." : "Test Connection"}
                </button>
              </div>

              {connectionStatus === "success" && connectedProfile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "4px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "#333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {connectedProfile.profilePictureUrl ? (
                      <img src={connectedProfile.profilePictureUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Check size={18} style={{ color: "#059669" }} />
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#fff" : "#262626" }}>
                      {connectedProfile.name}
                    </span>
                    <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>
                      @{connectedProfile.username} · Linked Successfully
                    </span>
                  </div>
                </div>
              )}

              {connectionStatus === "error" && (
                <div style={{ display: "flex", gap: "8px", color: "#dc2626", fontSize: "11px", marginTop: "4px" }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {connectionStatus === "idle" && (
                <div style={{ fontSize: "11px", color: isDark ? "#737373" : "#8e8e8e", fontStyle: "italic", marginTop: "4px" }}>
                  No active connection verified yet. Fill in credentials and test.
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: isDark ? "1px solid #2d2d2d" : "1px solid #efefef",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              background: isDark ? "#1c1c1e" : "#ffffff",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                background: "none",
                border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                color: isDark ? "#f5f5f5" : "#262626",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: "8px 18px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
                border: "none",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)",
              }}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
