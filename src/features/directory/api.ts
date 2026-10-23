import "server-only";
import type { DirectoryBlockInput } from "@/lib/validation/directory";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { DirectoryBlockResponse, DirectorySearchResponse } from "@/types/api";

/** One page of «Buscar candidatos» (admin/manager; the function and the RPC re-check the role). */
export const searchCandidateDirectory = (query: Record<string, string>) =>
  invokeEdgeFunction<DirectorySearchResponse>("candidate-directory", { query });

/** v2-16: block or unblock one professional by the ref the organization sees. */
export const setDirectoryBlock = (input: DirectoryBlockInput) =>
  invokeEdgeFunction<DirectoryBlockResponse>("candidate-directory", { method: "PUT", body: input });
