export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "b6-theme";

// Chạy đồng bộ trong <head>: lấy lựa chọn đã lưu, nếu chưa có thì theo hệ điều hành.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
