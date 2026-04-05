import type { NextFunction, Request, Response } from "express";

import { supabase } from "../integrations/supabase";

type AuthenticatedRequest = Request & { authUserId?: string };

function extractBearerToken(authorization?: string) {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractBearerToken(req.header("authorization"));

  if (!token) {
    if (!supabase) {
      req.authUserId = req.header("x-user-id") ?? "demo-user";
      return next();
    }

    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    if (!supabase) {
      const [, payload = ""] = token.split(".");
      const decoded = payload ? JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) : null;
      req.authUserId =
        typeof decoded?.sub === "string" && decoded.sub.length ? decoded.sub : token;
      return next();
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user?.id) {
      return res.status(401).json({ error: "Invalid or expired auth token" });
    }

    req.authUserId = data.user.id;
    return next();
  } catch {
    return res.status(401).json({ error: "Authentication check failed" });
  }
}

export type { AuthenticatedRequest };
