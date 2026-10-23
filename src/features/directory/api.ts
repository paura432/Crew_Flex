import "server-only";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { DirectorySearchResponse } from "@/types/api";

/** One page of «Buscar candidatos» (admin/manager; the function and the RPC re-check the role). Read-only. */
export const searchCandidateDirectory = (query: Record<string, string>) =>
  invokeEdgeFunction<DirectorySearchResponse>("candidate-directory", { query });
