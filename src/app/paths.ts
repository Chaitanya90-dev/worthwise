export const PUBLIC_HOME_PATH = "/";
export const LOGIN_PATH = "/login";
export const APP_BASE_PATH = "/app";

export const appPath = (path = "") => {
  if (!path || path === "/") {
    return APP_BASE_PATH;
  }

  return path.startsWith("/")
    ? `${APP_BASE_PATH}${path}`
    : `${APP_BASE_PATH}/${path}`;
};

export const loginPath = (options?: {
  mode?: "signin" | "signup";
  demo?: boolean;
}) => {
  const search = new URLSearchParams();

  if (options?.mode && options.mode !== "signin") {
    search.set("mode", options.mode);
  }

  if (options?.demo) {
    search.set("demo", "1");
  }

  const query = search.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
};
