import { CookieOptions } from "express";

export function getBaseCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  };
}

export function buildAccessCookieOptions(): CookieOptions {
  return {
    ...getBaseCookieOptions(),
    maxAge: 15 * 60 * 1000, // 15 minutos
  };
}

export function buildRefreshCookieOptions(): CookieOptions {
  return {
    ...getBaseCookieOptions(),
    path: "/v1/auth/refresh", // Restringido al endpoint de refresh
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  };
}

export function buildClearAccessCookieOptions(): CookieOptions {
  return {
    ...getBaseCookieOptions(),
    maxAge: 0,
  };
}

export function buildClearRefreshCookieOptions(): CookieOptions {
  return {
    ...getBaseCookieOptions(),
    path: "/v1/auth/refresh",
    maxAge: 0,
  };
}
