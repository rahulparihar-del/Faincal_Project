"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Tag, Calendar, ChevronDown, Camera, Upload, Check, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { RoadmapNode, NodeStatus, NodePriority, STATUS_META, PRIORITY_META, NODE_ACCENT_COLORS } from "./types";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  node: RoadmapNode | null;
  onClose: () => void;
  onUpdate: (patch: Partial<RoadmapNode>) => void;
  onDelete: (id: string) => void;
}

const IMAGE_PRESETS = [
  { label: "Marketing", url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=90" },
  { label: "Creative", url: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=1200&q=90" },
  { label: "Business", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=90" },
  { label: "Coding", url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=90" },
  { label: "Minimalist", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=90" },
  { label: "Instagram", url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=90" },
];

export function NodeDetailPanel({ node, onClose, onUpdate, onDelete }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"presets" | "upload" | "url">("presets");
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Track active image in modal preview
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePublishToInstagram = async () => {
    if (!node) return;
    setIsPublishing(true);
    try {
      const res = await fetch("/api/roadmap/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish post.");
      }

      const result = data.results?.[0];
      if (result && result.success) {
        alert("Success! Your post has been published to Instagram!");
        onUpdate({ 
          status: "done", 
          instagramPostId: result.instagramPostId,
          publishedAt: new Date().toISOString()
        });
      } else {
        throw new Error(result?.error || "Failed to publish post.");
      }
    } catch (err) {
      alert("Automation Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsPublishing(false);
    }
  };

  // Sync state when node changes
  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    const plainText = node.richContent
      ? node.richContent.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
      : "";
    setCaption(plainText);
    setPastedUrl("");
    setActivePreviewIndex(0);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return null;

  const statusMeta = STATUS_META[node.status];
  const priorityMeta = PRIORITY_META[node.priority];

  // Carousel image list
  const images = node.imageUrls && node.imageUrls.length > 0
    ? node.imageUrls
    : node.imageUrl
      ? [node.imageUrl]
      : [];

  const handleCaptionChange = (val: string) => {
    setCaption(val);
    const htmlContent = val.replace(/\n/g, "<br>");
    onUpdate({ richContent: htmlContent });
  };

  const handleTitleBlur = () => {
    onUpdate({ title });
  };

  const addTag = () => {
    const cleanTag = tagInput.trim().toLowerCase().replace(/\s+/g, "-").replace(/#/g, "");
    if (!cleanTag || node.tags.includes(cleanTag)) {
      setTagInput("");
      return;
    }
    onUpdate({ tags: [...node.tags, cleanTag] });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    onUpdate({ tags: node.tags.filter((t) => t !== tag) });
  };

  // Compress and convert file to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1600;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        // Use better image scaling quality
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
        }
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        
        // Append image to carousel
        const nextImages = [...images, dataUrl];
        onUpdate({ 
          imageUrls: nextImages,
          imageUrl: nextImages[0]
        });
        setActivePreviewIndex(nextImages.length - 1);
        setIsUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handlePresetSelect = (url: string) => {
    // Append preset image to carousel
    const nextImages = [...images, url];
    onUpdate({ 
      imageUrls: nextImages,
      imageUrl: nextImages[0] 
    });
    setActivePreviewIndex(nextImages.length - 1);
  };

  const handleUrlSubmit = () => {
    if (pastedUrl.trim()) {
      // Append image url to carousel
      const nextImages = [...images, pastedUrl.trim()];
      onUpdate({ 
        imageUrls: nextImages,
        imageUrl: nextImages[0] 
      });
      setActivePreviewIndex(nextImages.length - 1);
      setPastedUrl("");
    }
  };

  const handleRemoveAllImages = () => {
    onUpdate({ imageUrls: [], imageUrl: "" });
    setPastedUrl("");
    setActivePreviewIndex(0);
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        {/* Dark Backdrop */}
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
          initial={{ scale: 0.85, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "860px",
            background: isDark ? "#1c1c1e" : "#ffffff",
            borderRadius: "20px",
            boxShadow: isDark 
              ? "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
              : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
            zIndex: 1010,
            maxHeight: "90vh",
            border: isDark ? "1px solid #2d2d2d" : "none",
          }}
          className="flex-col md:flex-row"
        >
          {/* ── LEFT PANE: Image Selection & Settings ────────────────── */}
          <div
            style={{
              flex: "1",
              background: isDark ? "#121212" : "#fafafa",
              borderRight: isDark ? "1px solid #2d2d2d" : "1px solid #efefef",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minWidth: "300px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            className="w-full md:w-1/2"
          >
            <div
              style={{
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: isDark ? "1px solid #2d2d2d" : "1px solid #f0f0f0",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#737373" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Post Image Workspace
              </span>
              {images.length > 0 && (
                <button
                  onClick={handleRemoveAllImages}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ed4956",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Main Preview with Carousel Arrows */}
            <div
              style={{
                width: "100%",
                paddingTop: "75%",
                position: "relative",
                background: isDark ? "#1c1c1e" : "#f0f0f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {images.length > 0 ? (
                <>
                  <img
                    src={images[activePreviewIndex]}
                    alt={node.title}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {/* Arrows */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setActivePreviewIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                        style={{
                          position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
                          width: "28px", height: "28px", borderRadius: "50%",
                          background: isDark ? "rgba(28,28,30,0.85)" : "rgba(255,255,255,0.85)", 
                          color: isDark ? "#fff" : "#000", border: "none",
                          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                        }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setActivePreviewIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                        style={{
                          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                          width: "28px", height: "28px", borderRadius: "50%",
                          background: isDark ? "rgba(28,28,30,0.85)" : "rgba(255,255,255,0.85)", 
                          color: isDark ? "#fff" : "#000", border: "none",
                          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>
                      {/* Dots overlay */}
                      <div
                        style={{
                          position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)",
                          display: "flex", gap: "4px", background: "rgba(0,0,0,0.35)", padding: "3px 6px", borderRadius: "99px"
                        }}
                      >
                        {images.map((_, i) => (
                          <div
                            key={i}
                            style={{
                              width: "5px", height: "5px", borderRadius: "50%",
                              background: activePreviewIndex === i ? "#fff" : "rgba(255,255,255,0.4)"
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    background: isDark 
                      ? `linear-gradient(135deg, ${node.color}10, ${node.color}02)`
                      : `linear-gradient(135deg, ${node.color}22, ${node.color}11)`,
                  }}
                >
                  <Camera size={38} style={{ color: node.color, opacity: 0.6 }} />
                  <span style={{ fontSize: "12px", color: isDark ? "#737373" : "#8e8e8e", fontWeight: 600 }}>No Image Selected</span>
                </div>
              )}
            </div>

            {/* Horizontal Carousel Thumbnail Strip */}
            <div style={{ padding: "14px 16px 4px", borderBottom: isDark ? "1px solid #2d2d2d" : "1px solid #f0f0f0" }}>
              <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: isDark ? "#8e8e8e" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
                Carousel Slides ({images.length} images)
              </label>
              <div 
                style={{ 
                  display: "flex", 
                  gap: "8px", 
                  overflowX: "auto", 
                  paddingBottom: "8px",
                  scrollBehavior: "smooth"
                }}
              >
                {images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActivePreviewIndex(idx)}
                    style={{
                      position: "relative",
                      width: "56px",
                      height: "56px",
                      borderRadius: "8px",
                      border: activePreviewIndex === idx ? `2px solid ${node.color}` : "2px solid transparent",
                      overflow: "hidden",
                      cursor: "pointer",
                      flexShrink: 0,
                      background: isDark ? "#1c1c1e" : "#e5e5e5",
                    }}
                  >
                    <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {/* Delete item */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = images.filter((_, i) => i !== idx);
                        onUpdate({
                          imageUrls: next,
                          imageUrl: next.length > 0 ? next[0] : "",
                        });
                        setActivePreviewIndex((prev) => Math.min(prev, Math.max(0, next.length - 1)));
                      }}
                      style={{
                        position: "absolute",
                        top: "2px",
                        right: "2px",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.65)",
                        color: "#fff",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "9px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        lineHeight: 1
                      }}
                      title="Delete slide"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {images.length === 0 && (
                  <span style={{ fontSize: "11px", fontStyle: "italic", color: isDark ? "#737373" : "#8e8e8e", padding: "10px 0" }}>
                    No slides. Select presets or upload below.
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  borderBottom: isDark ? "1px solid #2d2d2d" : "1px solid #efefef",
                  marginBottom: "14px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {(["presets", "upload", "url"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      background: "none",
                      border: "none",
                      borderBottom: activeTab === tab 
                        ? (isDark ? "2px solid #f5f5f5" : "2px solid #262626") 
                        : "2px solid transparent",
                      color: activeTab === tab 
                        ? (isDark ? "#f5f5f5" : "#262626") 
                        : (isDark ? "#737373" : "#8e8e8e"),
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1 }}>
                {activeTab === "presets" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "8px",
                    }}
                  >
                    {IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => handlePresetSelect(preset.url)}
                        style={{
                          border: "2px solid transparent",
                          borderRadius: "8px",
                          overflow: "hidden",
                          aspectRatio: "1/1",
                          position: "relative",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.6)",
                            color: "#fff",
                            fontSize: "9px",
                            padding: "2px 0",
                            textAlign: "center",
                          }}
                        >
                          {preset.label}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === "upload" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "10px",
                        padding: "24px 20px",
                        border: isDark ? "2px dashed #3a3a3c" : "2px dashed #dbdbdb",
                        borderRadius: "12px",
                        background: isDark ? "#2c2c2e" : "#fff",
                        cursor: "pointer",
                        width: "100%",
                        color: isDark ? "#737373" : "#8e8e8e",
                        transition: "border-color 0.2s, background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = node.color;
                        if (isDark) e.currentTarget.style.background = "#3a3a3c";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? "#3a3a3c" : "#dbdbdb";
                        if (isDark) e.currentTarget.style.background = "#2c2c2e";
                      }}
                    >
                      <Upload size={24} style={{ color: node.color }} />
                      <span style={{ fontSize: "12px", fontWeight: 600, color: isDark ? "#f5f5f5" : "#262626" }}>
                        {isUploading ? "Uploading & Resizing..." : "Select Local Image"}
                      </span>
                      <span style={{ fontSize: "10px", color: isDark ? "#737373" : "#8e8e8e" }}>Append image to carousel array</span>
                    </button>
                  </div>
                )}

                {activeTab === "url" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: isDark ? "#737373" : "#8e8e8e" }}>PASTE IMAGE URL</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        value={pastedUrl}
                        onChange={(e) => setPastedUrl(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          background: isDark ? "#2c2c2e" : "#fff",
                          border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                          borderRadius: "8px",
                          fontSize: "12px",
                          outline: "none",
                          color: isDark ? "#f5f5f5" : "#262626",
                        }}
                      />
                      <button
                        onClick={handleUrlSubmit}
                        style={{
                          padding: "8px 14px",
                          background: node.color,
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANE: Instagram Post Details ────────────────── */}
          <div
            style={{
              flex: "1.2",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflowY: "auto",
              background: isDark ? "#1c1c1e" : "#ffffff",
              maxHeight: "90vh",
            }}
            className="w-full md:w-1/2"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    padding: "1.5px",
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
                      fontSize: "10px",
                      fontWeight: 700,
                      color: isDark ? "#f5f5f5" : "#262626",
                    }}
                  >
                    IG
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#f5f5f5" : "#262626" }}>brand_strategy</span>
                  <span style={{ fontSize: "10px", color: isDark ? "#737373" : "#8e8e8e" }}>Instagram Planner</span>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  width: "32px",
                  height: "32px",
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
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: isDark ? "#8e8e8e" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                POST TITLE / DAY
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Day 1: Launch strategy"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: isDark ? "#2c2c2e" : "#fff",
                  border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 700,
                  outline: "none",
                  color: isDark ? "#f5f5f5" : "#262626",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#8e8e8e" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  CAPTION / DESCRIPTION
                </label>
                <span style={{ fontSize: "10px", color: isDark ? "#737373" : "#b0b0b0" }}>{caption.length} chars</span>
              </div>
              <textarea
                value={caption}
                onChange={(e) => handleCaptionChange(e.target.value)}
                placeholder="Write your Instagram post caption here... Add your message, calls-to-action, etc."
                style={{
                  width: "100%",
                  height: "120px",
                  padding: "12px",
                  background: isDark ? "#2c2c2e" : "#fff",
                  border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                  borderRadius: "10px",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  outline: "none",
                  resize: "none",
                  color: isDark ? "#f5f5f5" : "#262626",
                  fontFamily: "Inter, sans-serif",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: isDark ? "#8e8e8e" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                HASHTAGS
              </label>
              <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: isDark ? "#121212" : "#fafafa",
                    border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                    borderRadius: "8px",
                    padding: "6px 12px",
                  }}
                >
                  <Tag size={12} style={{ color: "#aaa" }} />
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                    placeholder="Enter tag (press Enter)"
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: "12px",
                      color: isDark ? "#f5f5f5" : "#262626",
                    }}
                  />
                </div>
                <button
                  onClick={addTag}
                  style={{
                    padding: "6px 12px",
                    background: isDark ? "#2c2c2e" : "#f0f0f0",
                    border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    color: isDark ? "#f5f5f5" : "#262626",
                  }}
                >
                  Add
                </button>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {node.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: isDark ? "#9ecaff" : "#00376b",
                      background: isDark ? "#1c2b3e" : "#f0f7ff",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: isDark ? "1px solid #2a4365" : "1px solid #cce4ff",
                    }}
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: isDark ? "#9ecaff" : "#00376b", padding: 0, display: "flex" }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: isDark ? "#8e8e8e" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                  STATUS
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={node.status}
                    onChange={(e) => onUpdate({ status: e.target.value as NodeStatus })}
                    style={{
                      width: "100%",
                      background: isDark ? "#2c2c2e" : "#fff",
                      border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                      color: statusMeta.color,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      outline: "none",
                      appearance: "none",
                    }}
                  >
                    {(Object.keys(STATUS_META) as NodeStatus[]).map((s) => (
                      <option key={s} value={s} style={{ background: isDark ? "#1c1c1e" : "#fff", color: isDark ? "#f5f5f5" : "#262626" }}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8e8e8e" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: isDark ? "#8e8e8e" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                  POST TYPE
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={node.priority}
                    onChange={(e) => onUpdate({ priority: e.target.value as NodePriority })}
                    style={{
                      width: "100%",
                      background: isDark ? "#2c2c2e" : "#fff",
                      border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                      color: priorityMeta.color,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      outline: "none",
                      appearance: "none",
                    }}
                  >
                    {(Object.keys(PRIORITY_META) as NodePriority[]).map((p) => (
                      <option key={p} value={p} style={{ background: isDark ? "#1c1c1e" : "#fff", color: isDark ? "#f5f5f5" : "#262626" }}>
                        {PRIORITY_META[p].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8e8e8e" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: isDark ? "#8e8e8e" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                  PLAN DATE
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    border: isDark ? "1px solid #3a3a3c" : "1px solid #dbdbdb",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    background: isDark ? "#2c2c2e" : "#fff",
                  }}
                >
                  <Calendar size={13} style={{ color: "#aaa" }} />
                  <input
                    type="date"
                    value={node.dueDate}
                    onChange={(e) => onUpdate({ dueDate: e.target.value })}
                    style={{
                      border: "none",
                      outline: "none",
                      color: isDark ? "#f5f5f5" : "#262626",
                      background: "transparent",
                      fontSize: "12px",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: isDark ? "#8e8e8e" : "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
                  CANVAS HIGHLIGHT
                </label>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {NODE_ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => onUpdate({ color: c })}
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: c,
                        border: node.color === c 
                          ? (isDark ? "2px solid #fff" : "2px solid #262626") 
                          : "2px solid transparent",
                        cursor: "pointer",
                        padding: 0,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {node.color === c && <Check size={10} style={{ color: "#fff" }} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                borderTop: isDark ? "1px solid #2d2d2d" : "1px solid #efefef",
                paddingTop: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "auto",
              }}
            >
              <button
                onClick={() => {
                  onDelete(node.id);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  background: isDark ? "rgba(237, 73, 86, 0.15)" : "rgba(237, 73, 86, 0.08)",
                  border: isDark ? "1px solid rgba(237, 73, 86, 0.3)" : "1px solid rgba(237, 73, 86, 0.2)",
                  borderRadius: "10px",
                  color: "#ed4956",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(237, 73, 86, 0.25)" : "rgba(237, 73, 86, 0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = isDark ? "rgba(237, 73, 86, 0.15)" : "rgba(237, 73, 86, 0.08)")}
              >
                <Trash2 size={13} />
                Delete Post
              </button>

              {node.status !== "done" ? (
                <button
                  onClick={handlePublishToInstagram}
                  disabled={isPublishing || images.length === 0}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    background: "linear-gradient(45deg, #f09433 0%, #dc2743 50%, #bc1888 100%)",
                    border: "none",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: (isPublishing || images.length === 0) ? "not-allowed" : "pointer",
                    opacity: (isPublishing || images.length === 0) ? 0.6 : 1,
                    boxShadow: "0 4px 12px rgba(220, 39, 67, 0.2)",
                  }}
                >
                  <RefreshCw size={13} className={isPublishing ? "animate-spin" : ""} />
                  {isPublishing ? "Publishing..." : "Publish to Instagram"}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "#059669", fontWeight: 700 }}>
                  <Check size={14} />
                  Published to Instagram
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
