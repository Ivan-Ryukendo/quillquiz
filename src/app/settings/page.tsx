"use client";

import { useState, useEffect } from "react";
import { getSettings, saveSettings } from "@/lib/storage/settings-store";
import type { AppSettings } from "@/lib/markdown/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    useDemoMode: true,
  });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      if (settings.geminiApiKey) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Say hello in one word." }] }],
            }),
          }
        );
        if (res.ok) {
          setTestResult("Gemini API key works!");
        } else {
          setTestResult(`Gemini key failed: ${res.status}`);
        }
      } else {
        setTestResult("No Gemini API key set.");
      }
    } catch (err) {
      setTestResult(
        err instanceof Error ? err.message : "Test failed."
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium block mb-1">
            Gemini API Key
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Get a free key from{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Google AI Studio
            </a>
          </p>
          <input
            type="password"
            value={settings.geminiApiKey ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, geminiApiKey: e.target.value || undefined })
            }
            placeholder="AIza..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-transparent"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">
            OpenRouter API Key (optional fallback)
          </label>
          <input
            type="password"
            value={settings.openrouterApiKey ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                openrouterApiKey: e.target.value || undefined,
              })
            }
            placeholder="sk-or-..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-transparent"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="demoMode"
            checked={settings.useDemoMode}
            onChange={(e) =>
              setSettings({ ...settings, useDemoMode: e.target.checked })
            }
            className="w-4 h-4"
          />
          <label htmlFor="demoMode" className="text-sm">
            Enable Demo Mode (use shared server key as last resort)
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            {saved ? "Saved!" : "Save Settings"}
          </button>
          <button
            onClick={handleTestKey}
            disabled={testing}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test API Key"}
          </button>
        </div>

        {testResult && (
          <p
            className={`text-sm ${
              testResult.includes("works")
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {testResult}
          </p>
        )}
      </div>
    </div>
  );
}
