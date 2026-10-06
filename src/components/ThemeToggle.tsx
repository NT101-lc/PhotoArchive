"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { IconMoon, IconSun } from "./Icons";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Icon hiển thị bằng CSS (dark:) nên không cần state → không lệch hydrate.
 * Chưa chọn thủ công thì đi theo theme hệ điều hành, kể cả khi hệ điều hành đổi.
 */
export function ThemeToggle() {
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {}
      applyTheme(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }

  return (
    <button type="button" onClick={toggle} className="btn btn-icon" title="Đổi giao diện sáng / tối" aria-label="Đổi giao diện sáng / tối">
      <IconMoon className="dark:hidden" />
      <IconSun className="hidden dark:block" />
    </button>
  );
}
