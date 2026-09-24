"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { UserAvatar } from "@/components/VideoComponents";
import { useApp, mapBackendChannel, type ChannelProfile } from "@/context/AppContext";
import { apiUrl, channelMeApiUrl } from "@/lib/api-config";
import { getSessionToken } from "@/lib/client";

// Backend rule (channel.validator.js): letters, numbers, ".", "_", "-"; 3–30.
// The backend lowercases handles, so lowercase is enforced here too.
const HANDLE_RE = /^[a-z0-9._-]{3,30}$/;

function bearer(): Record<string, string> {
  const t = getSessionToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function EditChannelContent() {
  const { user, channel: ctxChannel, refreshUser, triggerFeedRefresh, showToast } = useApp();

  /*
   * The page loads the signed-in user's channel itself from the backend's
   * GET /channel/me (Bearer). Previously it only waited for `channel` from
   * context, which the external-backend session never filled → the page
   * showed "Loading your channel..." forever.
   *   ready   → channel found, edit it (PUT /channel)
   *   missing → backend 404 "Channel not found" → same form creates it (POST /channel)
   *   error   → real backend/network error with Retry
   */
  const [channel, setChannel] = useState<ChannelProfile | null>(ctxChannel);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">(
    ctxChannel ? "ready" : "loading"
  );
  const [loadError, setLoadError] = useState("");

  const loadMyChannel = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");
    try {
      const res = await fetch(channelMeApiUrl(), {
        cache: "no-store",
        credentials: "include",
        headers: bearer(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const mapped = mapBackendChannel(data);
        if (mapped) {
          setChannel(mapped);
          setLoadState("ready");
          return;
        }
      }
      if (res.status === 404) {
        setChannel(null);
        setLoadState("missing");
        return;
      }
      setLoadError(
        res.status === 401
          ? "Your session has expired. Please sign in again."
          : (data && (data.message || data.error)) || `Could not load your channel (HTTP ${res.status}).`
      );
      setLoadState("error");
    } catch {
      setLoadError("Could not reach the server. Please check your connection and try again.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (ctxChannel) {
      setChannel(ctxChannel);
      setLoadState("ready");
    } else if (user) {
      loadMyChannel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxChannel, user?.id]);
  const router = useRouter();

  const [channelName, setChannelName] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "banner" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (channel) {
      setChannelName(channel.channelName || "");
      setHandle(channel.handle || "");
      setDescription(channel.description || "");
      setContactEmail(channel.contactEmail || "");
      setProfilePhotoUrl(channel.profilePhotoUrl);
      setBannerUrl(channel.bannerUrl);
      setLinks(Array.isArray(channel.links) ? channel.links : []);
    }
  }, [channel]);

  if (!user || loadState === "loading") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-sm text-zinc-500">
        Loading your channel...
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-sm">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
        <button
          type="button"
          onClick={loadMyChannel}
          className="mt-4 px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const uploadAsset = async (
    file: File,
    kind: "photo" | "banner"
  ): Promise<string | null> => {
    // Latest backend: PUT /channel/images, multipart field "logo" | "banner"
    // (the old /upload route does not exist). Needs an existing channel.
    if (!channel) {
      showToast("Save your channel first, then add images.", "error");
      return null;
    }
    const field = kind === "photo" ? "logo" : "banner";
    const formData = new FormData();
    formData.append(field, file);
    try {
      const res = await fetch(apiUrl("/channel/images"), {
        method: "PUT",
        body: formData,
        credentials: "include",
        headers: bearer(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast((data && (data.message || data.error)) || "Upload failed", "error");
        return null;
      }
      const updated = mapBackendChannel(data);
      if (updated) setChannel(updated);
      return ((kind === "photo" ? updated?.profilePhotoUrl : updated?.bannerUrl) || null) as
        | string
        | null;
    } catch {
      showToast("Unable to connect. Please try again.", "error");
      return null;
    }
  };

  const handleImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "photo" | "banner"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    const url = await uploadAsset(file, kind);
    setUploading(null);
    if (e.target) e.target.value = "";
    if (!url) return;
    if (kind === "photo") setProfilePhotoUrl(url);
    else setBannerUrl(url);
    setSaved(false);
  };

  const updateLink = (index: number, patch: Partial<{ label: string; url: string }>) => {
    setLinks((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    setSaved(false);

    if (!channelName.trim()) {
      setError("Channel name cannot be empty.");
      return;
    }
    if (channelName.trim().length < 3 || channelName.trim().length > 50) {
      setError("Channel name must be between 3 and 50 characters.");
      return;
    }
    if (!HANDLE_RE.test(handle.trim())) {
      setError(
        "Handle must be 3–30 characters and can only contain lowercase letters, numbers, dot (.), underscore (_) and hyphen (-)."
      );
      return;
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setError("Please enter a valid contact email, or leave it empty.");
      return;
    }

    setSaving(true);
    try {
      // Latest backend: PUT /channel (auth-protected; verified live — the old
      // PATCH /channels route does not exist). `logo`/`banner` are the
      // backend's own channel field names (as returned by GET /channel/:handle).
      // No channel yet (GET /channel/me → 404) → create it: POST /channel.
      const creating = !channel;
      const res = await fetch(apiUrl("/channel"), {
        method: creating ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", ...bearer() },
        credentials: "include",
        body: JSON.stringify({
          channelName: channelName.trim(),
          handle: handle.trim().toLowerCase(),
          description: description.trim(),
          contactEmail: contactEmail.trim(),
          profilePhotoUrl,
          bannerUrl,
          // Only real hosted URLs (images are uploaded via PUT /channel/images).
          ...(profilePhotoUrl && /^https?:\/\//.test(profilePhotoUrl) ? { logo: profilePhotoUrl } : {}),
          ...(bannerUrl && /^https?:\/\//.test(bannerUrl) ? { banner: bannerUrl } : {}),
          links: links.filter((l) => l.label.trim() && l.url.trim()),
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const details = Array.isArray(data?.errors)
          ? data.errors.map((x: any) => x?.msg).filter(Boolean).join(", ")
          : "";
        setError(
          details ||
            data?.message ||
            data?.error ||
            "Something went wrong. Please try again."
        );
        return;
      }

      // Only report success once the database update is confirmed.
      await refreshUser();
      triggerFeedRefresh();
      setSaved(true);
      showToast("Channel updated", "success");
      router.refresh();
      const savedChannel = mapBackendChannel(data);
      if (savedChannel) {
        setChannel(savedChannel);
        setLoadState("ready");
      }
      // Backend resolves channels by HANDLE only.
      router.push(
        `/channel/${encodeURIComponent(savedChannel?.handle || handle.trim().toLowerCase())}`
      );
    } catch {
      setError("Unable to connect. Please check your internet connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Edit channel</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Changes are saved to the database and appear everywhere immediately.
          </p>
        </div>
        <Link
          href="/you"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-xs font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 overflow-hidden"
        noValidate
      >
        {/* Banner */}
        <div className="relative h-40 sm:h-52 bg-gradient-to-r from-zinc-900 via-red-950/60 to-zinc-900">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Channel banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs uppercase tracking-widest">
              No banner yet
            </div>
          )}
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleImageChange(e, "banner")}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploading === "banner"}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/70 hover:bg-black/85 text-white text-xs font-semibold backdrop-blur cursor-pointer disabled:opacity-60"
          >
            {uploading === "banner" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span>{uploading === "banner" ? "Uploading..." : "Change banner"}</span>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4 -mt-14">
            <div className="relative">
              <UserAvatar
                name={channelName || user.displayName}
                avatarUrl={profilePhotoUrl}
                size="xl"
                className="ring-4 ring-white dark:ring-zinc-900"
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e, "photo")}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading === "photo"}
                aria-label="Change profile picture"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg cursor-pointer disabled:opacity-60"
              >
                {uploading === "photo" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="pt-10 text-xs text-zinc-500">
              Profile picture • recommended 800×800
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {saved && !error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Channel saved successfully.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                Channel name
              </label>
              <input
                type="text"
                required
                value={channelName}
                onChange={(e) => {
                  setChannelName(e.target.value);
                  setSaved(false);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                Handle
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={handle}
                  onChange={(e) => {
                    setHandle(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                    );
                    setSaved(false);
                  }}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
              placeholder="Tell viewers what your channel is about..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Contact email (shown on your About tab)
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                setSaved(false);
              }}
              placeholder="business@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                Channel links ({links.length}/6)
              </label>
              <button
                type="button"
                disabled={links.length >= 6}
                onClick={() => {
                  setLinks((prev) => [...prev, { label: "", url: "" }]);
                  setSaved(false);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add link</span>
              </button>
            </div>

            {links.length === 0 ? (
              <p className="text-xs text-zinc-500 p-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                No links yet. Add your website or social profiles.
              </p>
            ) : (
              <div className="space-y-2">
                {links.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => updateLink(idx, { label: e.target.value })}
                      placeholder="Label"
                      className="w-32 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateLink(idx, { url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLinks((prev) => prev.filter((_, i) => i !== idx));
                        setSaved(false);
                      }}
                      aria-label="Remove link"
                      className="p-2 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Link
              href="/you"
              className="px-5 py-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-semibold shadow cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saving ? "Saving changes..." : "Save"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function EditChannelPage() {
  return (
    <ProtectedRoute
      title="Sign in to edit your channel"
      description="Only the channel owner can edit channel details."
    >
      <EditChannelContent />
    </ProtectedRoute>
  );
}
