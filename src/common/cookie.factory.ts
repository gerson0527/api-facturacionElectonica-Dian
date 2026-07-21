import { CookieOptions } from "express";

const isProduction = process.env.NODE_ENV === "production";
const isHabilitacion = process.env.NODE_ENV === "habilitacion";
const isSecureEnv = isProduction || isHabilitacion;

export interface CookieFactoryOptions {
  isProduction: boolean;
  isHabilitacion: boolean;
}

export function buildAccessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: "lax",
    path: "/",
  };
}

export function buildRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: "lax",
    path: "/",
  };
}

export function buildClearAccessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: "lax",
    path: "/",
  };
}

export function buildClearRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: "lax",
    path: "/",
  };
}
