import "server-only";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { NoticeCountResponse, NoticeListResponse, NoticeReadResponse } from "@/types/api";

/** One page of the caller's notices, newest first. */
export const listNotices = (offset: number, limit: number) =>
  invokeEdgeFunction<NoticeListResponse>("notifications", {
    query: { offset: String(offset), limit: String(limit) },
  });

/** The shell's bell. */
export const getUnreadNoticeCount = () =>
  invokeEdgeFunction<NoticeCountResponse>("notifications", { query: { view: "count" } });

export const markNoticeRead = (id: string) =>
  invokeEdgeFunction<NoticeReadResponse>("notifications", { method: "PATCH", body: { id } });

export const markAllNoticesRead = () =>
  invokeEdgeFunction<NoticeReadResponse>("notifications", { method: "PATCH", body: { all: true } });
